"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Loader2, Wand2, Sparkles, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import type { Project, Reference, Shot, Task } from "@/lib/db/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  COMMON_RATIOS,
  VIDEO_MODELS,
  bestDuration,
  estimateImageCost,
  estimateVideoCost,
  type VideoModelName,
} from "@/lib/runway/models";
import { updateShotAction } from "@/lib/actions/shots";
import { renderShotAction } from "@/lib/actions/generation";
import { formatUSD } from "@/lib/utils";

const DEBOUNCE_MS = 600;

export function ShotEditor({
  project,
  shot,
  references,
  tasks,
}: {
  project: Project;
  shot: Shot | null;
  references: Reference[];
  tasks: Task[];
}) {
  if (!shot) {
    return (
      <div className="flex h-full min-h-[380px] flex-col items-center justify-center rounded-2xl border border-dashed border-border/70 bg-card/30 p-6 text-center">
        <Sparkles className="h-5 w-5 text-muted-foreground" />
        <p className="mt-2 text-sm text-muted-foreground">
          Select a shot to edit, or add a new one.
        </p>
      </div>
    );
  }
  return <Editor key={shot.id} project={project} shot={shot} references={references} tasks={tasks} />;
}

function Editor({
  project,
  shot,
  references,
  tasks,
}: {
  project: Project;
  shot: Shot;
  references: Reference[];
  tasks: Task[];
}) {
  const [draft, setDraft] = React.useState({
    prompt: shot.prompt,
    model: shot.model as VideoModelName,
    ratio: shot.ratio,
    duration: shot.duration,
    seed: shot.seed ?? undefined,
    referenceTags: safeTags(shot.referenceTags),
  });
  const [pending, startTransition] = React.useTransition();
  const [renderPending, startRender] = React.useTransition();
  const dirtyTimer = React.useRef<number | null>(null);
  const [savedAt, setSavedAt] = React.useState<number | null>(null);

  React.useEffect(() => {
    setDraft({
      prompt: shot.prompt,
      model: shot.model as VideoModelName,
      ratio: shot.ratio,
      duration: shot.duration,
      seed: shot.seed ?? undefined,
      referenceTags: safeTags(shot.referenceTags),
    });
  }, [shot.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function persist(next: typeof draft) {
    if (dirtyTimer.current) window.clearTimeout(dirtyTimer.current);
    dirtyTimer.current = window.setTimeout(() => {
      startTransition(async () => {
        try {
          await updateShotAction({
            id: shot.id,
            projectId: project.id,
            ...next,
          });
          setSavedAt(Date.now());
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Save failed");
        }
      });
    }, DEBOUNCE_MS);
  }

  function update<K extends keyof typeof draft>(key: K, value: (typeof draft)[K]) {
    const next = { ...draft, [key]: value };
    if (key === "model" || key === "duration") {
      next.duration = bestDuration(next.model, next.duration);
    }
    setDraft(next);
    persist(next);
  }

  function toggleTag(tag: string) {
    const has = draft.referenceTags.includes(tag);
    const next = {
      ...draft,
      referenceTags: has
        ? draft.referenceTags.filter((t) => t !== tag)
        : [...draft.referenceTags, tag],
    };
    setDraft(next);
    persist(next);
  }

  function render() {
    if (!draft.prompt.trim()) return toast.error("Write a prompt first");
    startRender(async () => {
      try {
        await renderShotAction({ projectId: project.id, shotId: shot.id, regenerateKeyframe: false });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Render failed");
      }
    });
  }

  function regenKeyframe() {
    startRender(async () => {
      try {
        await renderShotAction({ projectId: project.id, shotId: shot.id, regenerateKeyframe: true });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Regen failed");
      }
    });
  }

  const spec = VIDEO_MODELS[draft.model];
  const usesRefs = draft.referenceTags.length > 0;
  const clipCost = estimateVideoCost(draft.model, draft.duration);
  const keyframeCost = usesRefs && !shot.keyframePath ? estimateImageCost("gen4_image") : 0;
  const totalCost = clipCost + keyframeCost;
  const overBudget = (project.spentUsd ?? 0) + totalCost > project.budgetUsd + 0.001;
  const liveTask = tasks.find((t) => t.status === "running" || t.status === "pending");
  const lastDone = tasks.find((t) => t.status === "succeeded");

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="sticky top-4 flex max-h-[calc(100vh-4rem)] flex-col rounded-2xl border border-border/60 bg-card/40 backdrop-blur"
    >
      <header className="flex items-center justify-between gap-2 border-b border-border/60 px-4 py-3">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Shot</div>
          <div className="font-mono text-sm">#{(shot.position + 1).toString().padStart(2, "0")}</div>
        </div>
        <div className="text-[10px] text-muted-foreground">
          {pending ? (
            <span className="inline-flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" /> Saving…
            </span>
          ) : savedAt ? (
            <span className="inline-flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-emerald-500" /> Saved
            </span>
          ) : null}
        </div>
      </header>

      <div className="flex-1 space-y-5 overflow-y-auto scrollbar-thin px-4 py-4">
        <PreviewBlock projectId={project.id} shot={shot} />

        <div className="grid gap-1.5">
          <Label>Prompt</Label>
          <Textarea
            value={draft.prompt}
            onChange={(e) => update("prompt", e.target.value)}
            rows={4}
            placeholder="@Ava enters @Office at golden hour, low-angle wide…"
            className="font-mono text-sm leading-relaxed"
          />
          <p className="text-[10px] text-muted-foreground">
            Tip: prefix references with <code className="rounded bg-muted px-1 py-0.5">@Tag</code> to anchor identity.
          </p>
        </div>

        <div className="grid gap-2">
          <Label>References for this shot</Label>
          <div className="flex flex-wrap gap-1.5">
            {references.length === 0 ? (
              <p className="text-[11px] text-muted-foreground">
                No cast yet — add characters, locations, or styles in the panel on the left.
              </p>
            ) : (
              references.map((ref) => {
                const active = draft.referenceTags.includes(ref.tag);
                return (
                  <button
                    type="button"
                    key={ref.id}
                    onClick={() => toggleTag(ref.tag)}
                    className={`rounded-full border px-2.5 py-1 text-[11px] leading-none transition-all ${
                      active
                        ? "border-primary/60 bg-primary/10 text-foreground"
                        : "border-border bg-card/40 text-muted-foreground hover:bg-card hover:text-foreground"
                    }`}
                  >
                    @{ref.tag}{" "}
                    <span className="ml-1 text-[9px] uppercase tracking-wider opacity-60">{ref.kind}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label>Model</Label>
            <Select value={draft.model} onValueChange={(v) => update("model", v as VideoModelName)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Generative</SelectLabel>
                  {(Object.entries(VIDEO_MODELS) as [VideoModelName, (typeof VIDEO_MODELS)[VideoModelName]][])
                    .filter(([, s]) => s.endpoints.includes("text_to_video") || s.endpoints.includes("image_to_video"))
                    .map(([m, s]) => (
                      <SelectItem key={m} value={m}>
                        <div className="flex w-full items-center justify-between gap-3">
                          <span className="font-mono text-xs">{m}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {s.creditsPerSec}cr/s · {s.durations.join(",")}s
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground">{spec.bestFor}</p>
          </div>
          <div className="grid gap-1.5">
            <Label>Duration</Label>
            <Select
              value={String(draft.duration)}
              onValueChange={(v) => update("duration", Number(v))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {spec.durations.map((d) => (
                  <SelectItem key={d} value={String(d)}>
                    {d}s
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="grid gap-1.5">
            <Label>Ratio</Label>
            <Select value={draft.ratio} onValueChange={(v) => update("ratio", v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COMMON_RATIOS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>Seed</Label>
            <Input
              type="number"
              value={draft.seed ?? ""}
              onChange={(e) => update("seed", e.target.value ? Number(e.target.value) : undefined)}
              placeholder="auto"
              className="font-mono"
            />
          </div>
        </div>

        <div className="rounded-lg border border-border/60 bg-background/50 p-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Estimated cost</span>
            <span className="font-mono tabular-nums">{formatUSD(totalCost)}</span>
          </div>
          {usesRefs ? (
            <div className="mt-1 text-[10px] text-muted-foreground">
              Includes a {formatUSD(keyframeCost)} keyframe pass{" "}
              {shot.keyframePath ? "(skipped — keyframe locked)" : ""}.
            </div>
          ) : null}
          {overBudget ? (
            <div className="mt-2 rounded bg-destructive/10 px-2 py-1 text-[10px] text-destructive">
              Over budget — increase project budget or reduce duration.
            </div>
          ) : null}
        </div>

        {liveTask ? (
          <div className="rounded-lg border border-primary/40 bg-primary/[0.04] p-3 text-xs">
            <div className="flex items-center gap-2 font-medium">
              <Loader2 className="h-3 w-3 animate-spin text-primary" /> {liveTask.kind} running
            </div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              Runway task id: <span className="font-mono">{liveTask.runwayId ?? "queued"}</span>
            </div>
          </div>
        ) : lastDone ? (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs text-emerald-500">
            <div className="inline-flex items-center gap-2">
              <CheckCircle2 className="h-3 w-3" /> Last task succeeded
            </div>
          </div>
        ) : null}
      </div>

      <footer className="flex items-center gap-2 border-t border-border/60 p-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={regenKeyframe}
          disabled={renderPending}
          title="Regenerate the keyframe before rendering the clip"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Keyframe
        </Button>
        <Button onClick={render} disabled={renderPending || overBudget} className="ml-auto">
          {renderPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
          {renderPending ? "Submitting…" : "Render shot"}
        </Button>
      </footer>
    </motion.div>
  );
}

function PreviewBlock({ projectId, shot }: { projectId: string; shot: Shot }) {
  if (!shot.videoPath && !shot.keyframePath) {
    return (
      <div className="grid h-40 place-items-center rounded-xl border border-dashed border-border/70 bg-background/40 text-xs text-muted-foreground">
        No preview yet — render to populate
      </div>
    );
  }
  if (shot.videoPath) {
    return (
      /* eslint-disable-next-line jsx-a11y/media-has-caption */
      <video
        src={`/api/assets/${projectId}?path=${encodeURIComponent(shot.videoPath.split("/").pop() ?? "")}`}
        controls
        className="aspect-video w-full overflow-hidden rounded-xl border border-border/60 bg-black"
      />
    );
  }
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={`/api/assets/${projectId}?path=${encodeURIComponent(shot.keyframePath!.split("/").pop() ?? "")}`}
      alt="keyframe"
      className="aspect-video w-full overflow-hidden rounded-xl border border-border/60 object-cover"
    />
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
