"use server";

import { promises as fs } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ensureAssetsDir } from "../db";
import {
  chargeBudget,
  createTask,
  getComposition,
  getProject,
  listShots,
  setTaskStatus,
  updateProject,
  upsertComposition,
} from "../db/queries";
import { RunwayClient, firstOutput } from "../runway/client";

const VoiceoverSchema = z.object({
  projectId: z.string(),
  text: z.string().min(1).max(4000),
  voice: z.string().min(1).max(120),
});

const MusicSchema = z.object({
  projectId: z.string(),
  prompt: z.string().min(1).max(2000),
  durationSeconds: z.coerce.number().min(1).max(120),
});

const ComposeSchema = z.object({
  projectId: z.string(),
  crossfadeSeconds: z.coerce.number().min(0).max(2).default(0.4),
  musicVolume: z.coerce.number().min(0).max(1).default(0.25),
  filename: z.string().default("final.mp4"),
});

export async function generateVoiceoverAction(input: z.infer<typeof VoiceoverSchema>) {
  const parsed = VoiceoverSchema.parse(input);
  const project = await getProject(parsed.projectId);
  if (!project) throw new Error("project not found");

  const charsCost = Math.ceil(parsed.text.length / 50) * 0.01;
  const taskId = await createTask({
    projectId: parsed.projectId,
    kind: "voiceover",
    model: "eleven_multilingual_v2",
    promptText: parsed.text.slice(0, 200),
    costUsd: charsCost,
  });
  await setTaskStatus(taskId, "running", { startedAt: new Date() });

  try {
    const client = new RunwayClient();
    const runwayId = await client.textToSpeech(parsed.text, parsed.voice);
    await setTaskStatus(taskId, "running", { runwayId });
    const done = await pollTask(client, runwayId);
    const url = firstOutput(done);
    if (!url) throw new Error("voiceover returned no output");
    const dir = await ensureAssetsDir(parsed.projectId);
    const dest = path.join(dir, "voiceover.mp3");
    await client.download(url, dest);
    await upsertComposition(parsed.projectId, {
      voiceoverText: parsed.text,
      voiceoverVoice: parsed.voice,
      voiceoverPath: dest,
    });
    await setTaskStatus(taskId, "succeeded", {
      outputPath: dest,
      outputUrl: url,
      finishedAt: new Date(),
    });
    await chargeBudget(parsed.projectId, charsCost);
  } catch (err: unknown) {
    await setTaskStatus(taskId, "failed", {
      errorMessage: err instanceof Error ? err.message : String(err),
      finishedAt: new Date(),
    });
    throw err;
  }
  revalidatePath(`/projects/${parsed.projectId}/compose`);
}

export async function generateMusicAction(input: z.infer<typeof MusicSchema>) {
  const parsed = MusicSchema.parse(input);
  const project = await getProject(parsed.projectId);
  if (!project) throw new Error("project not found");

  const cost = Math.max(1, Math.ceil(parsed.durationSeconds / 10)) * 0.01;
  const taskId = await createTask({
    projectId: parsed.projectId,
    kind: "sfx",
    model: "eleven_text_to_sound_v2",
    promptText: parsed.prompt,
    costUsd: cost,
  });
  await setTaskStatus(taskId, "running", { startedAt: new Date() });

  try {
    const client = new RunwayClient();
    const runwayId = await client.soundEffect(parsed.prompt, parsed.durationSeconds);
    await setTaskStatus(taskId, "running", { runwayId });
    const done = await pollTask(client, runwayId);
    const url = firstOutput(done);
    if (!url) throw new Error("music returned no output");
    const dir = await ensureAssetsDir(parsed.projectId);
    const dest = path.join(dir, "music.mp3");
    await client.download(url, dest);
    await upsertComposition(parsed.projectId, { musicPrompt: parsed.prompt, musicPath: dest });
    await setTaskStatus(taskId, "succeeded", {
      outputPath: dest,
      outputUrl: url,
      finishedAt: new Date(),
    });
    await chargeBudget(parsed.projectId, cost);
  } catch (err: unknown) {
    await setTaskStatus(taskId, "failed", {
      errorMessage: err instanceof Error ? err.message : String(err),
      finishedAt: new Date(),
    });
    throw err;
  }
  revalidatePath(`/projects/${parsed.projectId}/compose`);
}

/**
 * Stitch all rendered shots into a single mp4 with ffmpeg, optionally
 * mixing in voiceover and music. Updates project.finalVideoPath.
 */
export async function composeFinalAction(input: z.infer<typeof ComposeSchema>) {
  const parsed = ComposeSchema.parse(input);
  const project = await getProject(parsed.projectId);
  if (!project) throw new Error("project not found");
  const composition = await getComposition(parsed.projectId);
  const shots = (await listShots(parsed.projectId)).filter((s) => s.videoPath && s.status === "complete");
  if (shots.length === 0) throw new Error("no rendered shots to stitch");

  const dir = await ensureAssetsDir(parsed.projectId);
  const dest = path.join(dir, parsed.filename);
  const clips = shots.map((s) => s.videoPath!);
  const vo = composition?.voiceoverPath ?? null;
  const music = composition?.musicPath ?? null;

  await runFfmpegStitch({
    clips,
    voiceover: vo,
    music,
    musicVolume: parsed.musicVolume,
    crossfade: parsed.crossfadeSeconds,
    output: dest,
  });

  await upsertComposition(parsed.projectId, {
    crossfadeSeconds: parsed.crossfadeSeconds,
    musicVolume: parsed.musicVolume,
    finalPath: dest,
  });
  await updateProject(parsed.projectId, { finalVideoPath: dest });
  revalidatePath(`/projects/${parsed.projectId}`);
  revalidatePath(`/projects/${parsed.projectId}/compose`);
  return dest;
}

async function pollTask(client: RunwayClient, runwayId: string) {
  const start = Date.now();
  while (Date.now() - start < 15 * 60 * 1000) {
    const t = await client.getTask(runwayId);
    if (t.status === "SUCCEEDED") return t;
    if (t.status === "FAILED" || t.status === "CANCELLED") {
      throw new Error(`Runway task ${t.status.toLowerCase()}: ${t.failure ?? ""}`);
    }
    await new Promise((r) => setTimeout(r, 4000));
  }
  throw new Error("Runway task timed out");
}

async function runFfmpegStitch(opts: {
  clips: string[];
  voiceover: string | null;
  music: string | null;
  musicVolume: number;
  crossfade: number;
  output: string;
}) {
  const fast = opts.crossfade <= 0 && !opts.voiceover && !opts.music && opts.clips.length > 1;
  await fs.mkdir(path.dirname(opts.output), { recursive: true });

  if (fast) {
    const tmp = path.join(path.dirname(opts.output), `concat_${Date.now()}.txt`);
    const lines = opts.clips.map((c) => `file '${c.replace(/'/g, "'\\''")}'`).join("\n");
    await fs.writeFile(tmp, lines);
    try {
      await execFfmpeg([
        "-y", "-f", "concat", "-safe", "0", "-i", tmp, "-c", "copy", opts.output,
      ]);
    } finally {
      await fs.unlink(tmp).catch(() => {});
    }
    return;
  }

  const args: string[] = ["-y"];
  for (const c of opts.clips) args.push("-i", c);
  let nextIdx = opts.clips.length;
  let voIdx: number | null = null;
  let musicIdx: number | null = null;
  if (opts.voiceover) {
    args.push("-i", opts.voiceover);
    voIdx = nextIdx++;
  }
  if (opts.music) {
    args.push("-i", opts.music);
    musicIdx = nextIdx++;
  }

  let videoChain: string;
  if (opts.crossfade > 0 && opts.clips.length > 1) {
    let chain = "[0:v]";
    for (let i = 1; i < opts.clips.length; i++) {
      const offset = Math.max(0, i * 5 - opts.crossfade);
      const label = i < opts.clips.length - 1 ? `[v${i}]` : "[vout]";
      chain += `[${i}:v]xfade=transition=fade:duration=${opts.crossfade}:offset=${offset}${label}`;
      if (label !== "[vout]") chain += label;
      if (i < opts.clips.length - 1) chain += ";";
    }
    videoChain = chain;
  } else {
    const labels = opts.clips.map((_, i) => `[${i}:v:0]`).join("");
    videoChain = `${labels}concat=n=${opts.clips.length}:v=1:a=0[vout]`;
  }

  const audioLabels = opts.clips.map((_, i) => `[${i}:a:0]`).join("");
  const baseAudio = `${audioLabels}concat=n=${opts.clips.length}:v=0:a=1[base_a]`;

  const mixParts: string[] = ["[base_a]"];
  const extraFilters: string[] = [baseAudio];
  if (voIdx != null) mixParts.push(`[${voIdx}:a:0]`);
  if (musicIdx != null) {
    extraFilters.push(`[${musicIdx}:a:0]volume=${opts.musicVolume}[mus]`);
    mixParts.push("[mus]");
  }
  const mixFilter = `${mixParts.join("")}amix=inputs=${mixParts.length}:duration=longest[aout]`;

  const filterComplex = [videoChain, ...extraFilters, mixFilter].join(";");

  args.push(
    "-filter_complex", filterComplex,
    "-map", "[vout]", "-map", "[aout]",
    "-c:v", "libx264", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-shortest",
    opts.output,
  );
  await execFfmpeg(args);
}

function execFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("ffmpeg", args, { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    child.stderr?.on("data", (d) => (err += d.toString()));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited ${code}: ${err.slice(-500)}`));
    });
  });
}
