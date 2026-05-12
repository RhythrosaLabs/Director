"use client";

import * as React from "react";
import type { Composition, Project, Reference, Shot, Task } from "@/lib/db/schema";

export interface TimelineSnapshot {
  project: Project;
  shots: Shot[];
  references: Reference[];
  tasks: Task[];
  composition: Composition | null;
}

/** Polls the project timeline at 2.5s, faster (1.2s) when any task is running. */
export function useTimeline(initial: TimelineSnapshot) {
  const [snapshot, setSnapshot] = React.useState<TimelineSnapshot>(initial);
  const isRunning = snapshot.tasks.some((t) => t.status === "running" || t.status === "pending");
  const intervalRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    async function tick() {
      try {
        const res = await fetch(`/api/projects/${initial.project.id}/timeline`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const data = (await res.json()) as TimelineSnapshot;
        if (!cancelled) setSnapshot(data);
      } catch {
        /* ignore — next tick will try again */
      }
    }

    const ms = isRunning ? 1200 : 2500;
    intervalRef.current = window.setInterval(tick, ms);
    return () => {
      cancelled = true;
      if (intervalRef.current != null) window.clearInterval(intervalRef.current);
    };
    // re-arm when running-state flips so we change polling cadence
  }, [initial.project.id, isRunning]);

  return { snapshot, setSnapshot };
}
