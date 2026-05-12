"use client";

import * as React from "react";
import Link from "next/link";
import { FileVideo, Layers, Clapperboard, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import type { Project, Shot, Task } from "@/lib/db/schema";
import { formatUSD } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function ProjectHeader({
  project,
  shots,
  tasks,
}: {
  project: Project;
  shots: Shot[];
  tasks: Task[];
}) {
  const completed = shots.filter((s) => s.status === "complete").length;
  const rendering = shots.filter((s) => s.status === "rendering" || s.status === "queued").length;
  const failed = shots.filter((s) => s.status === "failed").length;
  const pct = project.budgetUsd > 0 ? Math.min(100, (project.spentUsd / project.budgetUsd) * 100) : 0;
  const runningTasks = tasks.filter((t) => t.status === "running" || t.status === "pending").length;

  return (
    <header className="relative isolate overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-aurora opacity-50" />
      <div className="px-6 pb-6 pt-8 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Link href="/" className="hover:text-foreground">Projects</Link>
              <span>/</span>
              <span className="font-mono">{project.id}</span>
            </div>
            <h1 className="mt-1.5 font-display text-4xl tracking-tight">{project.name}</h1>
            {project.description ? (
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{project.description}</p>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <Button asChild variant="glass" size="sm">
              <Link href={`/projects/${project.id}/assets`}>
                <Layers className="h-3.5 w-3.5" /> Assets
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link href={`/projects/${project.id}/compose`}>
                <FileVideo className="h-3.5 w-3.5" /> Compose
              </Link>
            </Button>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat
            label="Shots"
            value={shots.length}
            icon={<Clapperboard className="h-3.5 w-3.5" />}
            sub={`${completed} done · ${rendering} live · ${failed} failed`}
          />
          <Stat
            label="Generating"
            value={runningTasks}
            icon={
              runningTasks > 0 ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3.5 w-3.5" />
              )
            }
            sub={runningTasks > 0 ? "Runway tasks live" : "Idle"}
            tone={runningTasks > 0 ? "primary" : "muted"}
          />
          <Stat
            label="Spent"
            value={formatUSD(project.spentUsd)}
            icon={<span className="font-mono text-[10px]">$</span>}
            sub={`Budget ${formatUSD(project.budgetUsd)}`}
          />
          <BudgetBar pct={pct} />
        </div>

        {failed > 0 ? (
          <Badge variant="warning" className="mt-3">
            <AlertCircle className="h-3 w-3" /> {failed} {failed === 1 ? "shot" : "shots"} failed — inspect and retry
          </Badge>
        ) : null}
      </div>
    </header>
  );
}

function Stat({
  label,
  value,
  icon,
  sub,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  sub?: string;
  tone?: "primary" | "muted";
}) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/50 p-3 backdrop-blur">
      <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
        <span>{label}</span>
        <span className={tone === "primary" ? "text-primary" : ""}>{icon}</span>
      </div>
      <div className="mt-1.5 font-mono text-2xl tabular-nums leading-none">{value}</div>
      {sub ? <div className="mt-1 text-[11px] text-muted-foreground">{sub}</div> : null}
    </div>
  );
}

function BudgetBar({ pct }: { pct: number }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/50 p-3 backdrop-blur">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Budget burn</div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-gradient-to-r from-primary via-[hsl(var(--style))] to-[hsl(var(--location))] transition-[width] duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>{pct.toFixed(0)}%</span>
        <span>{(100 - pct).toFixed(0)}% left</span>
      </div>
    </div>
  );
}
