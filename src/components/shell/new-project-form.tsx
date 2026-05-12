"use client";

import * as React from "react";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { COMMON_RATIOS } from "@/lib/runway/models";
import { createProjectAction } from "@/lib/actions/projects";

const PRESETS = [
  {
    name: "Cinematic short",
    description: "Hero shots, narrative beats, voiceover-driven",
    ratio: "1280:720",
    budgetUsd: 8,
  },
  {
    name: "Social vertical",
    description: "Reels / Shorts / TikTok — 9:16, fast cuts",
    ratio: "720:1280",
    budgetUsd: 4,
  },
  {
    name: "Product film",
    description: "Long takes with seedance2, consistent product reference",
    ratio: "1280:720",
    budgetUsd: 12,
  },
  {
    name: "Music video",
    description: "Reactive crossfades, style-anchored",
    ratio: "1280:720",
    budgetUsd: 10,
  },
];

export function NewProjectForm() {
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [ratio, setRatio] = React.useState("1280:720");
  const [budget, setBudget] = React.useState(5);
  const [pending, startTransition] = React.useTransition();

  function applyPreset(p: (typeof PRESETS)[number]) {
    setRatio(p.ratio);
    setBudget(p.budgetUsd);
    if (!name) setName(p.name);
    if (!description) setDescription(p.description);
  }

  function submit() {
    if (!name.trim()) {
      toast.error("Give your production a name first.");
      return;
    }
    startTransition(async () => {
      try {
        await createProjectAction({
          name: name.trim(),
          description: description.trim(),
          ratio,
          budgetUsd: budget,
        });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Failed to create project");
      }
    });
  }

  return (
    <div className="grid gap-6">
      <div>
        <Label>Quick start</Label>
        <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {PRESETS.map((p) => (
            <button
              key={p.name}
              type="button"
              onClick={() => applyPreset(p)}
              className="group rounded-xl border border-border/60 bg-card/60 p-4 text-left transition-all hover:border-primary/40 hover:bg-card hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-primary opacity-60 transition-opacity group-hover:opacity-100" />
                <span className="text-sm font-medium">{p.name}</span>
              </div>
              <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">{p.description}</p>
              <div className="mt-3 flex items-center justify-between text-[10px] text-muted-foreground">
                <span className="font-mono">{p.ratio}</span>
                <span className="font-mono">${p.budgetUsd}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      <Card>
        <CardContent className="grid gap-5 p-6">
          <div className="grid gap-1.5">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. SIGNAL FROM TOMORROW"
              autoFocus
              className="text-base"
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="desc">Description</Label>
            <Textarea
              id="desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this piece about? Who's in it? What's the mood?"
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-1.5">
              <Label>Aspect ratio</Label>
              <Select value={ratio} onValueChange={setRatio}>
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
              <Label htmlFor="budget">Budget (USD)</Label>
              <Input
                id="budget"
                type="number"
                min={1}
                max={500}
                step={1}
                value={budget}
                onChange={(e) => setBudget(Number(e.target.value) || 0)}
                className="font-mono tabular-nums"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-2">
        <Button variant="ghost" onClick={() => history.back()} type="button">
          Cancel
        </Button>
        <Button onClick={submit} disabled={pending} size="lg">
          {pending ? "Creating…" : "Open the director"}
        </Button>
      </div>
    </div>
  );
}
