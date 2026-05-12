"use client";

import * as React from "react";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import { Clapperboard, Trash2, GripVertical, Loader2, CheckCircle2, AlertCircle, Wand2 } from "lucide-react";
import { toast } from "sonner";
import type { Reference, Shot } from "@/lib/db/schema";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { deleteShotAction, reorderShotsAction } from "@/lib/actions/shots";
import { renderShotAction } from "@/lib/actions/generation";
import { estimateVideoCost, type VideoModelName } from "@/lib/runway/models";
import { formatUSD } from "@/lib/utils";

export function Storyboard({
  projectId,
  shots,
  selectedShotId,
  onSelect,
  references,
}: {
  projectId: string;
  shots: Shot[];
  selectedShotId: string | null;
  onSelect: (id: string) => void;
  references: Reference[];
}) {
  const [order, setOrder] = React.useState(shots);
  React.useEffect(() => setOrder(shots), [shots]);

  const refsByTag = new Map(references.map((r) => [r.tag, r]));

  function persistOrder(next: Shot[]) {
    setOrder(next);
    reorderShotsAction(projectId, next.map((s) => s.id)).catch((e) =>
      toast.error(e.message ?? "Could not reorder"),
    );
  }

  if (shots.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/70 bg-card/30 p-10 text-center">
        <Clapperboard className="mx-auto h-6 w-6 text-muted-foreground" />
        <h3 className="mt-3 font-display text-xl">An empty stage</h3>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
          Add your first shot. Each shot becomes a clip; together they become the production.
        </p>
      </div>
    );
  }

  return (
    <Reorder.Group
      axis="y"
      values={order}
      onReorder={persistOrder}
      className="grid gap-3"
    >
      {order.map((shot) => (
        <ShotCard
          key={shot.id}
          shot={shot}
          projectId={projectId}
          selected={shot.id === selectedShotId}
          onSelect={() => onSelect(shot.id)}
          references={refsByTag}
        />
      ))}
    </Reorder.Group>
  );
}

function ShotCard({
  shot,
  projectId,
  selected,
  onSelect,
  references,
}: {
  shot: Shot;
  projectId: string;
  selected: boolean;
  onSelect: () => void;
  references: Map<string, Reference>;
}) {
  const tags: string[] = safeTags(shot.referenceTags);
  const cost = estimateVideoCost(shot.model as VideoModelName, shot.duration);
  const [pending, startTransition] = React.useTransition();

  function render() {
    startTransition(async () => {
      try {
        await renderShotAction({ projectId, shotId: shot.id, regenerateKeyframe: false });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Render failed");
      }
    });
  }

  function remove(e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("Remove this shot?")) return;
    deleteShotAction(projectId, shot.id).catch((err) => toast.error(err.message ?? "Delete failed"));
  }

  return (
    <Reorder.Item
      value={shot}
      whileDrag={{ scale: 1.01, boxShadow: "0 24px 48px -16px hsl(var(--primary) / 0.35)" }}
      onClick={onSelect}
      className={cn(
        "group relative flex cursor-pointer items-stretch overflow-hidden rounded-xl border bg-card/60 transition-all hover:border-border",
        selected ? "border-primary/40 ring-1 ring-primary/30 bg-card" : "border-border/60",
      )}
    >
      {/* drag handle */}
      <div className="flex w-8 flex-col items-center justify-center border-r border-border/40 text-muted-foreground/40 group-hover:text-muted-foreground">
        <GripVertical className="h-3.5 w-3.5" />
      </div>

      {/* preview */}
      <div className="relative flex aspect-[16/9] w-44 items-center justify-center overflow-hidden bg-gradient-to-br from-muted to-background">
        {shot.videoPath ? (
          /* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/media-has-caption */
          <video
            src={`/api/assets/${projectId}?path=${encodeURIComponent(shot.videoPath.split("/").pop() ?? "")}`}
            className="h-full w-full object-cover"
            muted
            loop
            playsInline
            onMouseEnter={(e) => (e.currentTarget as HTMLVideoElement).play().catch(() => {})}
            onMouseLeave={(e) => (e.currentTarget as HTMLVideoElement).pause()}
          />
        ) : shot.keyframePath ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={`/api/assets/${projectId}?path=${encodeURIComponent(shot.keyframePath.split("/").pop() ?? "")}`}
            alt="keyframe"
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">no preview</span>
        )}
        <ShotStatusBadge status={shot.status} />
      </div>

      {/* meta */}
      <div className="flex min-w-0 flex-1 flex-col p-3">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
            #{(shot.position + 1).toString().padStart(2, "0")}
          </span>
          <Badge variant="outline" className="text-[10px]">
            <span className="font-mono">{shot.model}</span>
          </Badge>
          <Badge variant="muted" className="text-[10px]">
            {shot.duration}s
          </Badge>
          <Badge variant="muted" className="text-[10px]">
            {shot.ratio}
          </Badge>
        </div>
        <p className="mt-1.5 line-clamp-2 text-sm leading-snug">
          {shot.prompt || <span className="italic text-muted-foreground">empty prompt — click to write</span>}
        </p>
        <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-2">
          {tags.length > 0 ? (
            tags.map((tag) => {
              const r = references.get(tag);
              const variant = (r?.kind ?? "outline") as "character" | "location" | "style" | "outline";
              return (
                <Badge key={tag} variant={variant} className="text-[10px]">
                  @{tag}
                </Badge>
              );
            })
          ) : (
            <Badge variant="muted" className="text-[10px]">
              no references
            </Badge>
          )}
          <span className="ml-auto font-mono text-[10px] tabular-nums text-muted-foreground">
            {formatUSD(cost)}
          </span>
        </div>
      </div>

      {/* actions */}
      <div className="flex flex-col gap-1.5 border-l border-border/40 p-2">
        <Button
          size="sm"
          variant="default"
          onClick={(e) => {
            e.stopPropagation();
            render();
          }}
          disabled={pending || shot.status === "queued" || shot.status === "rendering"}
          className="h-8 text-[11px]"
        >
          {pending || shot.status === "rendering" || shot.status === "queued" ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Wand2 className="h-3 w-3" />
          )}
          Render
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={remove}
          aria-label="Delete shot"
          className="opacity-0 transition-opacity group-hover:opacity-100"
        >
          <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </div>
    </Reorder.Item>
  );
}

function ShotStatusBadge({ status }: { status: Shot["status"] }) {
  const map = {
    draft: { label: "Draft", icon: null, variant: "muted" as const },
    queued: { label: "Queued", icon: <Loader2 className="h-3 w-3 animate-spin" />, variant: "outline" as const },
    rendering: { label: "Rendering", icon: <Loader2 className="h-3 w-3 animate-spin" />, variant: "default" as const },
    complete: { label: "Ready", icon: <CheckCircle2 className="h-3 w-3" />, variant: "success" as const },
    failed: { label: "Failed", icon: <AlertCircle className="h-3 w-3" />, variant: "destructive" as const },
  };
  const m = map[status];
  return (
    <Badge
      variant={m.variant}
      className="absolute left-2 top-2 text-[9px] !leading-none backdrop-blur-md"
    >
      {m.icon}
      {m.label}
    </Badge>
  );
}

function safeTags(raw: string): string[] {
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}
