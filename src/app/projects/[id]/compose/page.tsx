import { notFound } from "next/navigation";
import {
  getComposition,
  getProject,
  listReferences,
  listShots,
  listTasks,
} from "@/lib/db/queries";
import { AppShell } from "@/components/shell/app-shell";
import { ComposePanel } from "@/components/compose/compose-panel";

export default async function ComposePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = await getProject(id);
  if (!project) return notFound();

  const [composition, shots, references, tasks] = await Promise.all([
    getComposition(id),
    listShots(id),
    listReferences(id),
    listTasks(id, 30),
  ]);

  return (
    <AppShell projectId={id}>
      <ComposePanel
        project={project}
        initialComposition={composition}
        initialShots={shots}
        initialReferences={references}
        initialTasks={tasks}
      />
    </AppShell>
  );
}
