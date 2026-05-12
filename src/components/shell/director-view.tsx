"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import type { Composition, Project, Reference, Shot, Task } from "@/lib/db/schema";
import { useTimeline } from "@/lib/hooks/use-timeline";
import { CastPanel } from "@/components/cast/cast-panel";
import { Storyboard } from "@/components/storyboard/storyboard";
import { ShotEditor } from "@/components/storyboard/shot-editor";
import { TaskQueue } from "@/components/queue/task-queue";
import { ProjectHeader } from "@/components/shell/project-header";
import { Button } from "@/components/ui/button";
import { createShotAction } from "@/lib/actions/shots";
import { toast } from "sonner";

export function DirectorView({
  project,
  initialReferences,
  initialShots,
  initialTasks,
  initialComposition,
}: {
  project: Project;
  initialReferences: Reference[];
  initialShots: Shot[];
  initialTasks: Task[];
  initialComposition: Composition | null;
}) {
  const { snapshot } = useTimeline({
    project,
    references: initialReferences,
    shots: initialShots,
    tasks: initialTasks,
    composition: initialComposition,
  });

  const [selectedShotId, setSelectedShotId] = React.useState<string | null>(
    initialShots[0]?.id ?? null,
  );
  const selectedShot =
    snapshot.shots.find((s) => s.id === selectedShotId) ?? snapshot.shots[0] ?? null;

  React.useEffect(() => {
    // When new shots arrive and nothing is selected, default to the first.
    if (!selectedShotId && snapshot.shots[0]) setSelectedShotId(snapshot.shots[0].id);
  }, [snapshot.shots, selectedShotId]);

  async function newShot() {
    try {
      const id = await createShotAction({
        projectId: project.id,
        prompt: "",
        ratio: project.ratio,
        duration: 5,
        model: "gen4.5",
        referenceTags: [],
      });
      setSelectedShotId(id);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add shot");
    }
  }

  return (
    <div className="flex flex-col">
      <ProjectHeader project={snapshot.project} shots={snapshot.shots} tasks={snapshot.tasks} />

      <motion.div
        layout
        className="grid flex-1 gap-4 px-6 pb-6 lg:px-8 lg:grid-cols-[280px_minmax(0,1fr)_380px]"
      >
        <aside className="order-2 lg:order-1">
          <CastPanel
            projectId={project.id}
            references={snapshot.references}
            activeTags={selectedShot ? safeJsonArray(selectedShot.referenceTags) : []}
          />
        </aside>

        <section className="order-1 lg:order-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-2xl">Storyboard</h2>
            <Button onClick={newShot} size="sm" variant="glass">
              <Plus className="h-3.5 w-3.5" /> Add shot
            </Button>
          </div>
          <Storyboard
            projectId={project.id}
            shots={snapshot.shots}
            selectedShotId={selectedShot?.id ?? null}
            onSelect={(id) => setSelectedShotId(id)}
            references={snapshot.references}
          />
        </section>

        <aside className="order-3">
          <ShotEditor
            project={snapshot.project}
            shot={selectedShot}
            references={snapshot.references}
            tasks={snapshot.tasks.filter((t) => t.shotId === selectedShot?.id)}
          />
        </aside>
      </motion.div>

      <TaskQueue tasks={snapshot.tasks} />
    </div>
  );
}

function safeJsonArray(raw: string): string[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}
