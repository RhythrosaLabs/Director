"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  createShot,
  deleteShot,
  listShots,
  reorderShots,
  updateShot,
} from "../db/queries";
import { VIDEO_MODELS, type VideoModelName } from "../runway/models";

const ModelEnum = z.enum(Object.keys(VIDEO_MODELS) as [VideoModelName, ...VideoModelName[]]);

const CreateShotSchema = z.object({
  projectId: z.string(),
  prompt: z.string().min(1).max(2000).default(""),
  model: ModelEnum.default("gen4.5"),
  ratio: z.string().default("1280:720"),
  duration: z.coerce.number().int().min(1).max(15).default(5),
  referenceTags: z.array(z.string()).default([]),
  seed: z.coerce.number().int().optional(),
});

const UpdateShotSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  prompt: z.string().max(2000).optional(),
  model: ModelEnum.optional(),
  ratio: z.string().optional(),
  duration: z.coerce.number().int().min(1).max(15).optional(),
  referenceTags: z.array(z.string()).optional(),
  seed: z.coerce.number().int().optional(),
});

export async function listShotsAction(projectId: string) {
  return listShots(projectId);
}

export async function createShotAction(input: z.infer<typeof CreateShotSchema>) {
  const parsed = CreateShotSchema.parse(input);
  const id = await createShot(parsed);
  revalidatePath(`/projects/${parsed.projectId}`);
  return id;
}

export async function updateShotAction(input: z.infer<typeof UpdateShotSchema>) {
  const parsed = UpdateShotSchema.parse(input);
  const { id, projectId, referenceTags, ...rest } = parsed;
  // updateShot accepts an optional string[] of referenceTags and JSON-encodes it.
  await updateShot(id, { ...rest, ...(referenceTags ? { referenceTags } : {}) });
  revalidatePath(`/projects/${projectId}`);
}

export async function deleteShotAction(projectId: string, id: string) {
  await deleteShot(id);
  revalidatePath(`/projects/${projectId}`);
}

export async function reorderShotsAction(projectId: string, orderedIds: string[]) {
  await reorderShots(projectId, orderedIds);
  revalidatePath(`/projects/${projectId}`);
}
