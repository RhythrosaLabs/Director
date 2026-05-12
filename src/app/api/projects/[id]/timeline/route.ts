import { NextResponse } from "next/server";
import {
  getComposition,
  getProject,
  listReferences,
  listShots,
  listTasks,
} from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const project = await getProject(id);
  if (!project) return NextResponse.json({ error: "not found" }, { status: 404 });
  const [shots, references, tasks, composition] = await Promise.all([
    listShots(id),
    listReferences(id),
    listTasks(id, 30),
    getComposition(id),
  ]);
  return NextResponse.json({ project, shots, references, tasks, composition });
}
