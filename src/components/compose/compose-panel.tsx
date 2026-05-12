"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Download, Film, Loader2, Mic, Music2, Scissors, Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";
import type { Composition, Project, Reference, Shot, Task } from "@/lib/db/schema";
import { useTimeline } from "@/lib/hooks/use-timeline";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { ProjectHeader } from "@/components/shell/project-header";
import { TaskQueue } from "@/components/queue/task-queue";
import {
  composeFinalAction,
  generateMusicAction,
  generateVoiceoverAction,
} from "@/lib/actions/composition";
import { remixShotAction, backgroundRemoveAction } from "@/lib/actions/generation";
import { formatUSD } from "@/lib/utils";

const VOICES = [
  { value: "Rachel", label: "Rachel — warm, professional" },
  { value: "Adam", label: "Adam — calm, deep" },
  { value: "Bella", label: "Bella — soft, narrative" },
  { value: "Antoni", label: "Antoni — confident, mid-range" },
  { value: "Sam", label: "Sam — bright, conversational" },
];

export function ComposePanel({
  project,
  initialComposition,
  initialShots,
  initialReferences,
  initialTasks,
}: {
  project: Project;
  initialComposition: Composition | null;
  initialShots: Shot[];
  initialReferences: Reference[];
  initialTasks: Task[];
}) {
  const { snapshot } = useTimeline({
    project,
    references: initialReferences,
    shots: initialShots,
    tasks: initialTasks,
    composition: initialComposition,
  });

  const composition = snapshot.composition;
  const renderedShots = snapshot.shots.filter((s) => s.status === "complete" && s.videoPath);
  const totalDuration = renderedShots.reduce((acc, s) => acc + s.duration, 0);

  const [voText, setVoText] = React.useState(composition?.voiceoverText ?? "");
  const [voVoice, setVoVoice] = React.useState(composition?.voiceoverVoice ?? "Rachel");
  const [musicPrompt, setMusicPrompt] = React.useState(composition?.musicPrompt ?? "");
  const [crossfade, setCrossfade] = React.useState(composition?.crossfadeSeconds ?? 0.4);
  const [musicVolume, setMusicVolume] = React.useState(composition?.musicVolume ?? 0.25);
  const [voPending, startVo] = React.useTransition();
  const [muPending, startMu] = React.useTransition();
  const [coPending, startCo] = React.useTransition();

  function makeVoiceover() {
    if (!voText.trim()) return toast.error("Write the voiceover script first");
    startVo(async () => {
      try {
        await generateVoiceoverAction({ projectId: project.id, text: voText.trim(), voice: voVoice });
        toast.success("Voiceover ready");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Voiceover failed");
      }
    });
  }

  function makeMusic() {
    if (!musicPrompt.trim()) return toast.error("Describe the music you want");
    startMu(async () => {
      try {
        await generateMusicAction({
          projectId: project.id,
          prompt: musicPrompt.trim(),
          durationSeconds: Math.max(5, totalDuration),
        });
        toast.success("Music ready");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Music failed");
      }
    });
  }

  function compose() {
    if (renderedShots.length === 0) return toast.error("No rendered shots to stitch");
    startCo(async () => {
      try {
        await composeFinalAction({
          projectId: project.id,
          crossfadeSeconds: crossfade,
          musicVolume,
        });
        toast.success("Final cut ready");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Compose failed");
      }
    });
  }

  return (
    <div className="flex flex-col">
      <ProjectHeader project={snapshot.project} shots={snapshot.shots} tasks={snapshot.tasks} />

      <div className="grid gap-6 px-6 pb-12 lg:px-8 lg:grid-cols-[1.4fr_1fr]">
        <section className="space-y-4">
          <Card>
            <CardContent className="p-5">
              <Header
                icon={<Film className="h-3.5 w-3.5" />}
                title="Final cut"
                subtitle={`${renderedShots.length} clip${renderedShots.length === 1 ? "" : "s"} · ${totalDuration}s · ${project.ratio}`}
                badge={composition?.finalPath ? <Badge variant="success">Delivered</Badge> : null}
              />

              <FinalPreview projectId={project.id} finalPath={composition?.finalPath} />

              <div className="mt-5 grid gap-4">
                <SliderRow
                  label="Crossfade"
                  value={crossfade}
                  onChange={setCrossfade}
                  min={0}
                  max={1.5}
                  step={0.05}
                  format={(v) => `${v.toFixed(2)}s`}
                  hint="0 = hard cuts. 0.4 is cinematic, 1+ is dreamy."
                />
                <SliderRow
                  label="Music volume"
                  value={musicVolume}
                  onChange={setMusicVolume}
                  min={0}
                  max={1}
                  step={0.05}
                  format={(v) => `${Math.round(v * 100)}%`}
                  hint="Dialogue-led pieces sit best at 12–25%."
                />
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <Button onClick={compose} disabled={coPending || renderedShots.length === 0}>
                  {coPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                  {coPending ? "Stitching…" : "Compose final cut"}
                </Button>
                {composition?.finalPath ? (
                  <Button
                    asChild
                    variant="glass"
                    size="default"
                  >
                    <a
                      href={`/api/assets/${project.id}?path=${encodeURIComponent(
                        composition.finalPath.split("/").pop() ?? "",
                      )}`}
                      download
                    >
                      <Download className="h-3.5 w-3.5" /> Download mp4
                    </a>
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>

          <RemixGrid project={project} shots={snapshot.shots} references={snapshot.references} />
        </section>

        <aside className="space-y-4">
          <Card>
            <CardContent className="p-5">
              <Header
                icon={<Mic className="h-3.5 w-3.5" />}
                title="Voiceover"
                subtitle={composition?.voiceoverPath ? "Ready · re-generate to replace" : "Not generated yet"}
              />
              <div className="mt-3 grid gap-3">
                <Textarea
                  value={voText}
                  onChange={(e) => setVoText(e.target.value)}
                  rows={4}
                  placeholder="She walked in already knowing…"
                />
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={voVoice}
                    onChange={(e) => setVoVoice(e.target.value)}
                    className="rounded-md border border-input bg-background/50 px-3 py-2 text-sm"
                  >
                    {VOICES.map((v) => (
                      <option key={v.value} value={v.value}>
                        {v.label}
                      </option>
                    ))}
                  </select>
                  <Button onClick={makeVoiceover} disabled={voPending}>
                    {voPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
                    Generate
                  </Button>
                </div>
                {composition?.voiceoverPath ? (
                  /* eslint-disable-next-line jsx-a11y/media-has-caption */
                  <audio
                    controls
                    src={`/api/assets/${project.id}?path=${encodeURIComponent(
                      composition.voiceoverPath.split("/").pop() ?? "",
                    )}`}
                    className="w-full"
                  />
                ) : null}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <Header
                icon={<Music2 className="h-3.5 w-3.5" />}
                title="Music bed"
                subtitle={composition?.musicPath ? "Ready" : "Optional — adds depth"}
              />
              <div className="mt-3 grid gap-3">
                <Input
                  value={musicPrompt}
                  onChange={(e) => setMusicPrompt(e.target.value)}
                  placeholder="Tense ambient pad, slow heartbeat, low strings"
                />
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">
                    Duration ≈ {Math.max(5, totalDuration)}s · {formatUSD(0.02)}
                  </span>
                  <Button size="sm" onClick={makeMusic} disabled={muPending}>
                    {muPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
                    Generate
                  </Button>
                </div>
                {composition?.musicPath ? (
                  /* eslint-disable-next-line jsx-a11y/media-has-caption */
                  <audio
                    controls
                    src={`/api/assets/${project.id}?path=${encodeURIComponent(
                      composition.musicPath.split("/").pop() ?? "",
                    )}`}
                    className="w-full"
                  />
                ) : null}
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>

      <TaskQueue tasks={snapshot.tasks} />
    </div>
  );
}

function Header({
  icon,
  title,
  subtitle,
  badge,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  badge?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
          {icon} {title}
        </div>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
      {badge}
    </div>
  );
}

function FinalPreview({ projectId, finalPath }: { projectId: string; finalPath?: string | null }) {
  if (!finalPath) {
    return (
      <div className="mt-4 grid aspect-video place-items-center rounded-xl border border-dashed border-border/70 bg-background/40 text-xs text-muted-foreground">
        Compose to see the final cut here
      </div>
    );
  }
  return (
    /* eslint-disable-next-line jsx-a11y/media-has-caption */
    <video
      src={`/api/assets/${projectId}?path=${encodeURIComponent(finalPath.split("/").pop() ?? "")}`}
      controls
      className="mt-4 aspect-video w-full overflow-hidden rounded-xl border border-border/60 bg-black"
    />
  );
}

function SliderRow({
  label,
  value,
  onChange,
  min,
  max,
  step,
  format,
  hint,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
  step: number;
  format: (n: number) => string;
  hint?: string;
}) {
  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <span className="font-mono text-xs tabular-nums text-muted-foreground">{format(value)}</span>
      </div>
      <Slider min={min} max={max} step={step} value={[value]} onValueChange={(v) => onChange(v[0] ?? min)} />
      {hint ? <p className="text-[10px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function RemixGrid({
  project,
  shots,
  references,
}: {
  project: Project;
  shots: Shot[];
  references: Reference[];
}) {
  const rendered = shots.filter((s) => s.videoPath && s.status === "complete");
  if (rendered.length === 0) return null;
  return (
    <Card>
      <CardContent className="p-5">
        <Header
          icon={<Wand2 className="h-3.5 w-3.5" />}
          title="Post passes"
          subtitle="Aleph remix, restyle, and background isolate on any rendered clip"
        />
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {rendered.map((shot) => (
            <RemixCard key={shot.id} project={project} shot={shot} references={references} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function RemixCard({
  project,
  shot,
  references,
}: {
  project: Project;
  shot: Shot;
  references: Reference[];
}) {
  const [prompt, setPrompt] = React.useState("");
  const [refTag, setRefTag] = React.useState<string | "">("");
  const [pending, startPending] = React.useTransition();

  function remix() {
    if (!prompt.trim()) return toast.error("Describe the look you want");
    startPending(async () => {
      try {
        await remixShotAction({
          projectId: project.id,
          shotId: shot.id,
          prompt: prompt.trim(),
          referenceTag: refTag || undefined,
        });
        toast.success("Remix complete");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Remix failed");
      }
    });
  }
  function bgRemove() {
    startPending(async () => {
      try {
        await backgroundRemoveAction({ projectId: project.id, shotId: shot.id });
        toast.success("Background isolated");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "BG remove failed");
      }
    });
  }

  const styleRefs = references.filter((r) => r.kind === "style");

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-border/60 bg-background/40 p-3"
    >
      <div className="flex items-center gap-2">
        <span className="font-mono text-[10px] text-muted-foreground">
          #{(shot.position + 1).toString().padStart(2, "0")}
        </span>
        <p className="line-clamp-1 text-xs text-muted-foreground">{shot.prompt}</p>
      </div>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <video
        src={`/api/assets/${project.id}?path=${encodeURIComponent(shot.videoPath!.split("/").pop() ?? "")}`}
        muted
        loop
        playsInline
        onMouseEnter={(e) => (e.currentTarget as HTMLVideoElement).play().catch(() => {})}
        onMouseLeave={(e) => (e.currentTarget as HTMLVideoElement).pause()}
        className="mt-2 aspect-video w-full overflow-hidden rounded-md bg-black object-cover"
      />
      <div className="mt-2 grid gap-2">
        <Input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Anime cel-shaded, dynamic line work…"
          className="h-8 text-xs"
        />
        {styleRefs.length > 0 ? (
          <select
            value={refTag}
            onChange={(e) => setRefTag(e.target.value)}
            className="rounded-md border border-input bg-background/50 px-2 py-1.5 text-xs"
          >
            <option value="">No style reference</option>
            {styleRefs.map((r) => (
              <option key={r.id} value={r.tag}>
                @{r.tag} ({r.name})
              </option>
            ))}
          </select>
        ) : null}
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={remix} disabled={pending} className="h-8 text-[11px]">
            {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wand2 className="h-3 w-3" />}
            Remix
          </Button>
          <Button
            size="sm"
            variant="glass"
            onClick={bgRemove}
            disabled={pending}
            className="h-8 text-[11px]"
            title="Isolate the subject with aleph"
          >
            <Scissors className="h-3 w-3" /> Cutout
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
