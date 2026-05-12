import { notFound } from "next/navigation";
import {
  getComposition,
  getProject,
  listReferences,
  listShots,
  listTasks,
} from "@/lib/db/queries";
import { AppShell } from "@/components/shell/app-shell";
import { DirectorView } from "@/components/shell/director-view";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) return notFound();

  const [references, shots, tasks, composition] = await Promise.all([
    listReferences(id),
    listShots(id),
    listTasks(id, 40),
    getComposition(id),
  ]);

  return (
    <AppShell projectId={id}>
      <DirectorView
        project={project}
        initialReferences={references}
        initialShots={shots}
        initialTasks={tasks}
        initialComposition={composition}
      />
    </AppShell>
  );
}
