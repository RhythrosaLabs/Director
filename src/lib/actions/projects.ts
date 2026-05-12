"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  createProject,
  deleteProject,
  getProject,
  listProjects,
  updateProject,
} from "../db/queries";

const CreateProjectSchema = z.object({
  name: z.string().min(1, "name required").max(120),
  description: z.string().max(2000).default(""),
  ratio: z.string().default("1280:720"),
  budgetUsd: z.coerce.number().min(0).max(1000).default(5),
});

export async function listProjectsAction() {
  return listProjects();
}

export async function createProjectAction(input: z.infer<typeof CreateProjectSchema>) {
  const parsed = CreateProjectSchema.parse(input);
  const id = await createProject(parsed);
  revalidatePath("/");
  revalidatePath("/projects");
  redirect(`/projects/${id}`);
}

export async function updateProjectAction(id: string, patch: Partial<{
  name: string;
  description: string;
  ratio: string;
  budgetUsd: number;
}>) {
  await updateProject(id, patch);
  revalidatePath(`/projects/${id}`);
}

export async function deleteProjectAction(id: string) {
  const p = await getProject(id);
  if (!p) return;
  await deleteProject(id);
  revalidatePath("/");
  revalidatePath("/projects");
}
