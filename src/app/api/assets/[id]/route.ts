import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { getProject } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

/**
 * Serve files from data/assets/<project_id>/<filename>.
 *
 * Path is normalized and confined to the project's assets dir to prevent
 * traversal. Returns 404 when the file is missing rather than leaking which
 * paths exist.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const requested = url.searchParams.get("path");
  if (!requested) return NextResponse.json({ error: "path required" }, { status: 400 });

  const project = await getProject(id);
  if (!project) return NextResponse.json({ error: "not found" }, { status: 404 });

  const root = path.resolve(process.cwd(), process.env.ASSETS_DIR ?? "./data/assets", id);
  const resolved = path.resolve(root, path.basename(requested));
  if (!resolved.startsWith(root + path.sep) && resolved !== root) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  try {
    const buf = await fs.readFile(resolved);
    const ext = path.extname(resolved).slice(1).toLowerCase();
    const mime =
      ext === "mp4"
        ? "video/mp4"
        : ext === "mp3"
          ? "audio/mpeg"
          : ext === "png"
            ? "image/png"
            : ext === "jpg" || ext === "jpeg"
              ? "image/jpeg"
              : ext === "webp"
                ? "image/webp"
                : "application/octet-stream";
    return new NextResponse(buf, { headers: { "Content-Type": mime, "Cache-Control": "private, max-age=60" } });
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
}
