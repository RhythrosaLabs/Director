"use server";

import { promises as fs } from "node:fs";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ensureAssetsDir } from "../db";
import {
  chargeBudget,
  createTask,
  getProject,
  getShot,
  listReferences,
  setShotStatus,
  setTaskStatus,
  updateShot,
} from "../db/queries";
import { RunwayClient, firstOutput, type TaskState } from "../runway/client";
import {
  estimateImageCost,
  estimateVideoCost,
  type VideoModelName,
} from "../runway/models";

const RenderShotSchema = z.object({
  projectId: z.string(),
  shotId: z.string(),
  /** When true, generates a fresh keyframe first even if one already exists. */
  regenerateKeyframe: z.boolean().default(false),
});

const RemixShotSchema = z.object({
  projectId: z.string(),
  shotId: z.string(),
  prompt: z.string().min(1).max(2000),
  /** Optional named style/reference image to bias the look. */
  referenceTag: z.string().optional(),
});

const BackgroundRemoveSchema = z.object({
  projectId: z.string(),
  shotId: z.string(),
  prompt: z
    .string()
    .default(
      "transparent black background, isolate subject only, clean matte, no fringing",
    ),
});

/**
 * Render a shot end-to-end: (optional) keyframe → clip. Charges the
 * project's budget, surfaces a Task row the UI polls for status, and
 * updates the shot's video_path / keyframe_path on success.
 */
export async function renderShotAction(input: z.infer<typeof RenderShotSchema>) {
  const parsed = RenderShotSchema.parse(input);
  const project = await getProject(parsed.projectId);
  if (!project) throw new Error("project not found");
  const shot = await getShot(parsed.shotId);
  if (!shot || shot.projectId !== parsed.projectId) throw new Error("shot not found");

  const tags: string[] = JSON.parse(shot.referenceTags || "[]");
  const refs = await listReferences(parsed.projectId);
  const refsByTag = new Map(refs.map((r) => [r.tag, r]));
  const usedRefs = tags
    .map((t) => refsByTag.get(t))
    .filter((r): r is NonNullable<typeof r> => r != null);

  const clipCost = estimateVideoCost(shot.model as VideoModelName, shot.duration);
  const needsKeyframe = (usedRefs.length > 0 && (!shot.keyframePath || parsed.regenerateKeyframe));
  const keyframeCost = needsKeyframe ? estimateImageCost("gen4_image") : 0;
  const total = clipCost + keyframeCost;
  if ((project.spentUsd ?? 0) + total > project.budgetUsd + 0.001) {
    throw new Error(
      `over budget: this shot would cost $${total.toFixed(2)} but only $${(project.budgetUsd - project.spentUsd).toFixed(2)} remains.`,
    );
  }

  await setShotStatus(shot.id, "queued");
  const dir = await ensureAssetsDir(parsed.projectId);
  const client = new RunwayClient();

  let keyframePath = shot.keyframePath;
  if (needsKeyframe) {
    const kfTaskId = await createTask({
      projectId: parsed.projectId,
      kind: "keyframe",
      model: "gen4_image",
      promptText: shot.prompt,
      shotId: shot.id,
      costUsd: keyframeCost,
    });
    await setTaskStatus(kfTaskId, "running", { startedAt: new Date() });
    try {
      const references: Record<string, string> = {};
      for (const r of usedRefs) references[r.tag] = r.imagePath;
      const runwayId = await client.textToImage({
        prompt: shot.prompt,
        ratio: shot.ratio,
        references,
        seed: shot.seed ?? undefined,
      });
      await setTaskStatus(kfTaskId, "running", { runwayId });
      const done = await pollTask(client, runwayId);
      const url = firstOutput(done);
      if (!url) throw new Error("keyframe returned no output");
      keyframePath = path.join(dir, `shot_${shot.id}_keyframe.png`);
      await client.download(url, keyframePath);
      await setTaskStatus(kfTaskId, "succeeded", {
        outputPath: keyframePath,
        outputUrl: url,
        finishedAt: new Date(),
      });
      await updateShot(shot.id, { keyframePath });
      await chargeBudget(parsed.projectId, keyframeCost);
    } catch (err: unknown) {
      await setTaskStatus(kfTaskId, "failed", {
        errorMessage: err instanceof Error ? err.message : String(err),
        finishedAt: new Date(),
      });
      await setShotStatus(shot.id, "failed", err instanceof Error ? err.message : String(err));
      revalidatePath(`/projects/${parsed.projectId}`);
      throw err;
    }
  }

  await setShotStatus(shot.id, "rendering");
  const clipTaskId = await createTask({
    projectId: parsed.projectId,
    kind: "shot",
    model: shot.model,
    promptText: shot.prompt,
    shotId: shot.id,
    costUsd: clipCost,
  });
  await setTaskStatus(clipTaskId, "running", { startedAt: new Date() });

  try {
    const runwayId = keyframePath
      ? await client.imageToVideo({
          image: keyframePath,
          prompt: shot.prompt,
          model: shot.model as VideoModelName,
          ratio: shot.ratio,
          duration: shot.duration,
          seed: shot.seed ?? undefined,
        })
      : await client.textToVideo({
          prompt: shot.prompt,
          model: shot.model as VideoModelName,
          ratio: shot.ratio,
          duration: shot.duration,
          seed: shot.seed ?? undefined,
        });
    await setTaskStatus(clipTaskId, "running", { runwayId });
    const done = await pollTask(client, runwayId);
    const url = firstOutput(done);
    if (!url) throw new Error("shot returned no output");
    const dest = path.join(dir, `shot_${shot.id}.mp4`);
    await client.download(url, dest);
    await setTaskStatus(clipTaskId, "succeeded", {
      outputPath: dest,
      outputUrl: url,
      finishedAt: new Date(),
    });
    await updateShot(shot.id, { videoPath: dest });
    await setShotStatus(shot.id, "complete");
    await chargeBudget(parsed.projectId, clipCost);
  } catch (err: unknown) {
    await setTaskStatus(clipTaskId, "failed", {
      errorMessage: err instanceof Error ? err.message : String(err),
      finishedAt: new Date(),
    });
    await setShotStatus(shot.id, "failed", err instanceof Error ? err.message : String(err));
    revalidatePath(`/projects/${parsed.projectId}`);
    throw err;
  }

  revalidatePath(`/projects/${parsed.projectId}`);
}

/** Remix an existing rendered shot with gen4_aleph. */
export async function remixShotAction(input: z.infer<typeof RemixShotSchema>) {
  const parsed = RemixShotSchema.parse(input);
  const project = await getProject(parsed.projectId);
  if (!project) throw new Error("project not found");
  const shot = await getShot(parsed.shotId);
  if (!shot?.videoPath) throw new Error("shot has no rendered video yet");
  const cost = estimateVideoCost("gen4_aleph", shot.duration);
  if ((project.spentUsd ?? 0) + cost > project.budgetUsd + 0.001) {
    throw new Error("over budget");
  }

  const refs = await listReferences(parsed.projectId);
  const refImage = parsed.referenceTag
    ? refs.find((r) => r.tag === parsed.referenceTag)?.imagePath
    : undefined;

  const taskId = await createTask({
    projectId: parsed.projectId,
    kind: "remix",
    model: "gen4_aleph",
    promptText: parsed.prompt,
    shotId: shot.id,
    costUsd: cost,
  });
  await setTaskStatus(taskId, "running", { startedAt: new Date() });
  const client = new RunwayClient();
  try {
    const runwayId = await client.videoToVideo({
      video: shot.videoPath,
      prompt: parsed.prompt,
      duration: shot.duration,
      ratio: shot.ratio,
      referenceImage: refImage,
    });
    await setTaskStatus(taskId, "running", { runwayId });
    const done = await pollTask(client, runwayId);
    const url = firstOutput(done);
    if (!url) throw new Error("remix returned no output");
    const dir = await ensureAssetsDir(parsed.projectId);
    const dest = path.join(dir, `remix_${shot.id}_${Date.now()}.mp4`);
    await client.download(url, dest);
    await setTaskStatus(taskId, "succeeded", {
      outputPath: dest,
      outputUrl: url,
      finishedAt: new Date(),
    });
    await updateShot(shot.id, { videoPath: dest });
    await chargeBudget(parsed.projectId, cost);
  } catch (err: unknown) {
    await setTaskStatus(taskId, "failed", {
      errorMessage: err instanceof Error ? err.message : String(err),
      finishedAt: new Date(),
    });
    throw err;
  }
  revalidatePath(`/projects/${parsed.projectId}`);
}

/** Background removal — convenience wrapper over remix with an isolate-subject prompt. */
export async function backgroundRemoveAction(input: z.infer<typeof BackgroundRemoveSchema>) {
  const parsed = BackgroundRemoveSchema.parse(input);
  return remixShotAction({
    projectId: parsed.projectId,
    shotId: parsed.shotId,
    prompt: parsed.prompt,
  });
}

async function pollTask(client: RunwayClient, runwayId: string): Promise<TaskState> {
  const start = Date.now();
  const timeoutMs = 15 * 60 * 1000;
  while (Date.now() - start < timeoutMs) {
    const task = await client.getTask(runwayId);
    if (task.status === "SUCCEEDED") return task;
    if (task.status === "FAILED" || task.status === "CANCELLED") {
      throw new Error(`Runway task ${task.status.toLowerCase()}: ${task.failure ?? task.failureCode ?? ""}`);
    }
    await sleep(4000);
  }
  throw new Error("Runway task timed out");
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function fileToDataUrl(filePath: string): Promise<string | null> {
  try {
    const buf = await fs.readFile(filePath);
    const ext = path.extname(filePath).slice(1).toLowerCase() || "png";
    const mime = ext === "jpg" ? "image/jpeg" : `image/${ext}`;
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}
