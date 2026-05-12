"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  CheckCircle2,
  ChevronDown,
  Image as ImageIcon,
  Music2,
  Mic,
  Wand2,
  Loader2,
  AlertCircle,
  Clapperboard,
  Globe2,
  Scissors,
} from "lucide-react";
import type { Task, TaskKind } from "@/lib/db/schema";
import { formatUSD, relativeTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

const KIND_META: Record<TaskKind, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  keyframe: { label: "Keyframe", icon: ImageIcon },
  shot: { label: "Shot", icon: Clapperboard },
  remix: { label: "Remix", icon: Wand2 },
  bg_remove: { label: "BG remove", icon: Scissors },
  restyle: { label: "Restyle", icon: Wand2 },
  voiceover: { label: "Voiceover", icon: Mic },
  sfx: { label: "Music", icon: Music2 },
  dub: { label: "Dub", icon: Globe2 },
};

export function TaskQueue({ tasks }: { tasks: Task[] }) {
  const [open, setOpen] = React.useState(true);
  const running = tasks.filter((t) => t.status === "running" || t.status === "pending");
  const recentDone = tasks.filter((t) => t.status === "succeeded").slice(0, 5);
  const recentFailed = tasks.filter((t) => t.status === "failed").slice(0, 3);

  const visible = [...running, ...recentDone, ...recentFailed].slice(0, 12);

  if (tasks.length === 0) return null;

  return (
    <div className="sticky bottom-0 z-20 mt-6 border-t border-border/60 bg-card/70 backdrop-blur-xl">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-6 py-2 text-left lg:px-8"
      >
        <Activity className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-medium">
          Generation queue
        </span>
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {running.length} live · {recentDone.length} done · {recentFailed.length} failed
        </span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          className="ml-auto text-muted-foreground"
        >
          <ChevronDown className="h-3.5 w-3.5" />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="flex gap-2 overflow-x-auto px-6 pb-3 scrollbar-thin lg:px-8">
              {visible.map((t) => (
                <TaskCard key={t.id} task={t} />
              ))}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function TaskCard({ task }: { task: Task }) {
  const meta = KIND_META[task.kind] ?? { label: task.kind, icon: Activity };
  const Icon = meta.icon;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      className="w-[240px] shrink-0 rounded-lg border border-border/60 bg-background/40 p-3"
    >
      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-medium">{meta.label}</span>
        <StatusBadge status={task.status} />
      </div>
      {task.model ? (
        <div className="mt-1 font-mono text-[10px] text-muted-foreground">{task.model}</div>
      ) : null}
      {task.promptText ? (
        <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">{task.promptText}</p>
      ) : null}
      {task.errorMessage ? (
        <p className="mt-1.5 line-clamp-3 text-[10px] text-destructive">
          {task.errorMessage}
        </p>
      ) : null}
      <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
        <span>{relativeTime(task.startedAt ?? task.createdAt)}</span>
        <span className="font-mono tabular-nums">{formatUSD(task.costUsd, 3)}</span>
      </div>
    </motion.div>
  );
}

function StatusBadge({ status }: { status: Task["status"] }) {
  if (status === "running" || status === "pending")
    return (
      <Badge variant="default" className="ml-auto text-[9px]">
        <Loader2 className="h-2.5 w-2.5 animate-spin" /> Live
      </Badge>
    );
  if (status === "succeeded")
    return (
      <Badge variant="success" className="ml-auto text-[9px]">
        <CheckCircle2 className="h-2.5 w-2.5" /> Done
      </Badge>
    );
  if (status === "failed")
    return (
      <Badge variant="destructive" className="ml-auto text-[9px]">
        <AlertCircle className="h-2.5 w-2.5" /> Fail
      </Badge>
    );
  return <Badge variant="muted" className="ml-auto text-[9px]">{status}</Badge>;
}
