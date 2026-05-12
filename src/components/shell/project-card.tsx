"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Clapperboard, Users, Wallet } from "lucide-react";
import type { ProjectWithCounts } from "@/lib/db/queries";
import { formatUSD, relativeTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export function ProjectCard({
  project,
  index,
}: {
  project: ProjectWithCounts;
  index: number;
}) {
  const pct = project.budgetUsd > 0 ? Math.min(100, (project.spentUsd / project.budgetUsd) * 100) : 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.04 * index, ease: [0.16, 1, 0.3, 1] }}
    >
      <Link
        href={`/projects/${project.id}`}
        className="group relative block overflow-hidden rounded-xl border border-border/60 bg-card/60 p-5 transition-all hover:border-border hover:bg-card hover:shadow-lg"
      >
        <div className="absolute -inset-px -z-10 rounded-xl bg-gradient-to-br from-primary/10 via-transparent to-[hsl(var(--location)/0.1)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

        <div className="flex items-center justify-between">
          <Badge variant={project.finalVideoPath ? "success" : "muted"}>
            {project.finalVideoPath ? "Delivered" : "Active"}
          </Badge>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {relativeTime(project.updatedAt)}
          </span>
        </div>

        <h3 className="mt-3 truncate font-display text-xl leading-tight">{project.name}</h3>
        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
          {project.description || "No description."}
        </p>

        <div className="mt-5 grid grid-cols-3 gap-3 text-xs">
          <Metric icon={<Clapperboard className="h-3 w-3" />} label="Shots" value={project.shotCount} />
          <Metric icon={<Users className="h-3 w-3" />} label="Cast" value={project.referenceCount} />
          <Metric icon={<Wallet className="h-3 w-3" />} label="Spent" value={formatUSD(project.spentUsd)} />
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
            <span>Budget</span>
            <span>
              {formatUSD(project.spentUsd, 2)} / {formatUSD(project.budgetUsd, 2)}
            </span>
          </div>
          <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-[hsl(var(--style))] transition-[width] duration-700"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/50 px-3 py-2">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
        {icon} {label}
      </div>
      <div className="mt-1 font-mono text-sm tabular-nums">{value}</div>
    </div>
  );
}
