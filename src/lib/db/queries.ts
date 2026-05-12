import "server-only";
import { and, asc, desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db, schema } from "./index";
import type { ReferenceKind, ShotStatus, TaskKind, TaskStatus } from "./schema";
import { slugTag } from "../utils";

export type ProjectWithCounts = schema.Project & {
  shotCount: number;
  referenceCount: number;
};

export function newId(prefix: string) {
  return `${prefix}_${nanoid(12)}`;
}

// ── Projects ─────────────────────────────────────────────

export async function listProjects(): Promise<ProjectWithCounts[]> {
  const rows = await db.select().from(schema.projects).orderBy(desc(schema.projects.updatedAt)).all();
  const out: ProjectWithCounts[] = [];
  for (const p of rows) {
    const shotCount = (await db.select().from(schema.shots).where(eq(schema.shots.projectId, p.id))).length;
    const referenceCount = (
      await db.select().from(schema.references).where(eq(schema.references.projectId, p.id))
    ).length;
    out.push({ ...p, shotCount, referenceCount });
  }
  return out;
}

export async function getProject(id: string) {
  return (await db.select().from(schema.projects).where(eq(schema.projects.id, id))).at(0) ?? null;
}

export async function createProject(args: {
  name: string;
  description?: string;
  ratio?: string;
  budgetUsd?: number;
}) {
  const id = newId("proj");
  await db.insert(schema.projects).values({
    id,
    name: args.name,
    description: args.description ?? "",
    ratio: args.ratio ?? "1280:720",
    budgetUsd: args.budgetUsd ?? 5,
  });
  await db.insert(schema.compositions).values({ id: newId("comp"), projectId: id });
  return id;
}

export async function updateProject(id: string, patch: Partial<schema.Project>) {
  await db
    .update(schema.projects)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(schema.projects.id, id));
}

export async function deleteProject(id: string) {
  await db.delete(schema.projects).where(eq(schema.projects.id, id));
}

export async function chargeBudget(projectId: string, deltaUsd: number) {
  const p = await getProject(projectId);
  if (!p) return;
  await updateProject(projectId, { spentUsd: (p.spentUsd ?? 0) + deltaUsd });
}

// ── References ───────────────────────────────────────────

export async function listReferences(projectId: string) {
  return db
    .select()
    .from(schema.references)
    .where(eq(schema.references.projectId, projectId))
    .orderBy(asc(schema.references.kind), asc(schema.references.name))
    .all();
}

export async function listReferencesByKind(projectId: string, kind: ReferenceKind) {
  return db
    .select()
    .from(schema.references)
    .where(and(eq(schema.references.projectId, projectId), eq(schema.references.kind, kind)))
    .all();
}

export async function createReference(args: {
  projectId: string;
  kind: ReferenceKind;
  name: string;
  imagePath: string;
  imageUrl?: string;
  description?: string;
  seed?: number;
}) {
  const id = newId("ref");
  const tag = slugTag(args.name);
  await db.insert(schema.references).values({
    id,
    projectId: args.projectId,
    kind: args.kind,
    name: args.name,
    tag,
    description: args.description ?? "",
    imagePath: args.imagePath,
    imageUrl: args.imageUrl,
    seed: args.seed,
  });
  return id;
}

export async function deleteReference(id: string) {
  await db.delete(schema.references).where(eq(schema.references.id, id));
}

// ── Shots ────────────────────────────────────────────────

export async function listShots(projectId: string) {
  return db
    .select()
    .from(schema.shots)
    .where(eq(schema.shots.projectId, projectId))
    .orderBy(asc(schema.shots.position))
    .all();
}

export async function getShot(id: string) {
  return (await db.select().from(schema.shots).where(eq(schema.shots.id, id))).at(0) ?? null;
}

export async function nextShotPosition(projectId: string) {
  const rows = await db.select().from(schema.shots).where(eq(schema.shots.projectId, projectId)).all();
  return rows.length === 0 ? 0 : Math.max(...rows.map((s) => s.position)) + 1;
}

export async function createShot(args: {
  projectId: string;
  prompt: string;
  model?: string;
  ratio?: string;
  duration?: number;
  referenceTags?: string[];
  seed?: number;
}) {
  const id = newId("shot");
  const position = await nextShotPosition(args.projectId);
  await db.insert(schema.shots).values({
    id,
    projectId: args.projectId,
    position,
    prompt: args.prompt,
    model: args.model ?? "gen4.5",
    ratio: args.ratio ?? "1280:720",
    duration: args.duration ?? 5,
    referenceTags: JSON.stringify(args.referenceTags ?? []),
    seed: args.seed,
    status: "draft",
  });
  return id;
}

export async function updateShot(id: string, patch: Partial<schema.Shot> & { referenceTags?: string[] }) {
  const data: Partial<schema.Shot> = { ...patch, updatedAt: new Date() };
  if (Array.isArray(patch.referenceTags)) {
    data.referenceTags = JSON.stringify(patch.referenceTags);
  }
  await db.update(schema.shots).set(data).where(eq(schema.shots.id, id));
}

export async function setShotStatus(id: string, status: ShotStatus, lastError?: string | null) {
  await db
    .update(schema.shots)
    .set({ status, lastError: lastError ?? null, updatedAt: new Date() })
    .where(eq(schema.shots.id, id));
}

export async function deleteShot(id: string) {
  await db.delete(schema.shots).where(eq(schema.shots.id, id));
}

export async function reorderShots(projectId: string, orderedIds: string[]) {
  for (let i = 0; i < orderedIds.length; i++) {
    await db
      .update(schema.shots)
      .set({ position: i, updatedAt: new Date() })
      .where(and(eq(schema.shots.id, orderedIds[i]), eq(schema.shots.projectId, projectId)));
  }
}

// ── Tasks ────────────────────────────────────────────────

export async function listTasks(projectId: string, limit = 60) {
  const rows = await db
    .select()
    .from(schema.tasks)
    .where(eq(schema.tasks.projectId, projectId))
    .orderBy(desc(schema.tasks.createdAt))
    .all();
  return rows.slice(0, limit);
}

export async function createTask(args: {
  projectId: string;
  kind: TaskKind;
  model?: string;
  promptText?: string;
  shotId?: string | null;
  referenceId?: string | null;
  costUsd?: number;
}) {
  const id = newId("task");
  await db.insert(schema.tasks).values({
    id,
    projectId: args.projectId,
    shotId: args.shotId ?? null,
    referenceId: args.referenceId ?? null,
    kind: args.kind,
    model: args.model,
    promptText: args.promptText,
    status: "pending",
    costUsd: args.costUsd ?? 0,
  });
  return id;
}

export async function updateTask(id: string, patch: Partial<schema.Task>) {
  await db.update(schema.tasks).set(patch).where(eq(schema.tasks.id, id));
}

export async function getTask(id: string) {
  return (await db.select().from(schema.tasks).where(eq(schema.tasks.id, id))).at(0) ?? null;
}

export async function setTaskStatus(
  id: string,
  status: TaskStatus,
  extra: Partial<schema.Task> = {},
) {
  await db
    .update(schema.tasks)
    .set({ status, ...extra })
    .where(eq(schema.tasks.id, id));
}

// ── Composition ──────────────────────────────────────────

export async function getComposition(projectId: string) {
  return (
    (await db.select().from(schema.compositions).where(eq(schema.compositions.projectId, projectId))).at(0) ??
    null
  );
}

export async function upsertComposition(projectId: string, patch: Partial<schema.Composition>) {
  const current = await getComposition(projectId);
  if (!current) {
    await db.insert(schema.compositions).values({ id: newId("comp"), projectId, ...patch });
    return;
  }
  await db
    .update(schema.compositions)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(schema.compositions.projectId, projectId));
}
