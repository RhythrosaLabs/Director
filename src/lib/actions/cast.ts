"use server";

import { promises as fs } from "node:fs";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { RunwayClient, firstOutput } from "../runway/client";
import {
  IMAGE_MODELS,
  estimateImageCost,
  type ImageModelName,
} from "../runway/models";
import { ensureAssetsDir } from "../db";
import {
  chargeBudget,
  createReference,
  createTask,
  deleteReference,
  getProject,
  listReferences,
  setTaskStatus,
} from "../db/queries";
import type { ReferenceKind } from "../db/schema";

const GenerateReferenceSchema = z.object({
  projectId: z.string(),
  kind: z.enum(["character", "location", "style"]),
  name: z.string().min(1).max(120),
  description: z.string().max(2000).default(""),
  prompt: z.string().min(1).max(2000),
  model: z.enum(Object.keys(IMAGE_MODELS) as [ImageModelName, ...ImageModelName[]]).default("gen4_image"),
  ratio: z.string().default("1280:720"),
  seed: z.coerce.number().int().optional(),
});

const UploadReferenceSchema = z.object({
  projectId: z.string(),
  kind: z.enum(["character", "location", "style"]),
  name: z.string().min(1).max(120),
  description: z.string().max(2000).default(""),
  /** Base64 data URL, e.g. data:image/png;base64,... */
  imageDataUrl: z.string().min(20),
});

export async function listReferencesAction(projectId: string) {
  return listReferences(projectId);
}

/** Save an uploaded image as a new reference (no Runway call). */
export async function uploadReferenceAction(input: z.infer<typeof UploadReferenceSchema>) {
  const parsed = UploadReferenceSchema.parse(input);
  const project = await getProject(parsed.projectId);
  if (!project) throw new Error("project not found");

  const dir = await ensureAssetsDir(parsed.projectId);
  const match = parsed.imageDataUrl.match(/^data:(image\/[a-z0-9.+-]+);base64,(.*)$/i);
  if (!match) throw new Error("unsupported image format — expected data URL");
  const ext = match[1].split("/")[1].replace("jpeg", "jpg");
  const buf = Buffer.from(match[2], "base64");
  const filename = `ref_${Date.now()}.${ext}`;
  const dest = path.join(dir, filename);
  await fs.writeFile(dest, buf);

  await createReference({
    projectId: parsed.projectId,
    kind: parsed.kind as ReferenceKind,
    name: parsed.name,
    description: parsed.description,
    imagePath: dest,
  });
  revalidatePath(`/projects/${parsed.projectId}`);
}

/**
 * Generate a new reference frame with Runway gen4_image (or chosen model)
 * and register it as a character/location/style. Returns the new reference
 * id when complete.
 */
export async function generateReferenceAction(input: z.infer<typeof GenerateReferenceSchema>) {
  const parsed = GenerateReferenceSchema.parse(input);
  const project = await getProject(parsed.projectId);
  if (!project) throw new Error("project not found");

  const cost = estimateImageCost(parsed.model);
  if ((project.spentUsd ?? 0) + cost > project.budgetUsd + 0.001) {
    throw new Error(
      `over budget: spending $${cost.toFixed(2)} would exceed the project cap of $${project.budgetUsd.toFixed(2)}.`,
    );
  }

  const taskId = await createTask({
    projectId: parsed.projectId,
    kind: "keyframe",
    model: parsed.model,
    promptText: parsed.prompt,
    costUsd: cost,
  });
  await setTaskStatus(taskId, "running", { startedAt: new Date() });

  try {
    const client = new RunwayClient();
    const runwayId = await client.textToImage({
      prompt: parsed.prompt,
      model: parsed.model,
      ratio: parsed.ratio,
      seed: parsed.seed,
    });
    await setTaskStatus(taskId, "running", { runwayId });
    const finished = await pollTask(client, runwayId);
    const url = firstOutput(finished);
    if (!url) throw new Error("Runway returned no output");

    const dir = await ensureAssetsDir(parsed.projectId);
    const dest = path.join(dir, `ref_${Date.now()}.png`);
    await client.download(url, dest);

    await createReference({
      projectId: parsed.projectId,
      kind: parsed.kind as ReferenceKind,
      name: parsed.name,
      description: parsed.description,
      imagePath: dest,
      imageUrl: url,
      seed: parsed.seed,
    });
    await setTaskStatus(taskId, "succeeded", {
      outputPath: dest,
      outputUrl: url,
      finishedAt: new Date(),
    });
    await chargeBudget(parsed.projectId, cost);
    revalidatePath(`/projects/${parsed.projectId}`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    await setTaskStatus(taskId, "failed", { errorMessage: msg, finishedAt: new Date() });
    throw err;
  }
}

export async function deleteReferenceAction(projectId: string, referenceId: string) {
  await deleteReference(referenceId);
  revalidatePath(`/projects/${projectId}`);
}

async function pollTask(client: RunwayClient, runwayId: string) {
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
