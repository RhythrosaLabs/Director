import { notFound } from "next/navigation";
import { promises as fs } from "node:fs";
import path from "node:path";
import { AppShell } from "@/components/shell/app-shell";
import { AssetsBrowser } from "@/components/shell/assets-browser";
import { getProject } from "@/lib/db/queries";

export default async function AssetsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) return notFound();

  const root = path.resolve(process.cwd(), process.env.ASSETS_DIR ?? "./data/assets", id);
  let files: { name: string; size: number; mtime: number; kind: "video" | "image" | "audio" | "other" }[] = [];
  try {
    const entries = await fs.readdir(root);
    files = (
      await Promise.all(
        entries.map(async (entry) => {
          const full = path.join(root, entry);
          const stat = await fs.stat(full);
          if (!stat.isFile()) return null;
          const ext = path.extname(entry).toLowerCase();
          const kind: "video" | "image" | "audio" | "other" =
            [".mp4", ".mov", ".webm"].includes(ext)
              ? "video"
              : [".png", ".jpg", ".jpeg", ".webp"].includes(ext)
                ? "image"
                : [".mp3", ".wav", ".m4a"].includes(ext)
                  ? "audio"
                  : "other";
          return { name: entry, size: stat.size, mtime: stat.mtimeMs, kind };
        }),
      )
    )
      .filter((x): x is NonNullable<typeof x> => x != null)
      .sort((a, b) => b.mtime - a.mtime);
  } catch {
    /* no assets dir yet — empty state */
  }

  return (
    <AppShell projectId={id}>
      <AssetsBrowser projectId={id} projectName={project.name} files={files} />
    </AppShell>
  );
}
