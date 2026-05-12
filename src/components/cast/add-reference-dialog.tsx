"use client";

import * as React from "react";
import { Loader2, Sparkles, Upload, Wand2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import type { ReferenceKind } from "@/lib/db/schema";
import { IMAGE_MODELS, estimateImageCost, type ImageModelName } from "@/lib/runway/models";
import { generateReferenceAction, uploadReferenceAction } from "@/lib/actions/cast";
import { formatUSD, slugTag } from "@/lib/utils";

export function AddReferenceDialog({
  projectId,
  open,
  onOpenChange,
  initialKind,
}: {
  projectId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialKind: ReferenceKind;
}) {
  const [mode, setMode] = React.useState<"generate" | "upload">("generate");
  const [kind, setKind] = React.useState<ReferenceKind>(initialKind);
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [prompt, setPrompt] = React.useState("");
  const [model, setModel] = React.useState<ImageModelName>("gen4_image");
  const [seed, setSeed] = React.useState<number | undefined>();
  const [imageDataUrl, setImageDataUrl] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (open) setKind(initialKind);
  }, [open, initialKind]);

  function reset() {
    setName("");
    setDescription("");
    setPrompt("");
    setImageDataUrl(null);
    setSeed(undefined);
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setImageDataUrl(typeof reader.result === "string" ? reader.result : null);
    reader.readAsDataURL(f);
  }

  function submit() {
    if (!name.trim()) return toast.error("Give this reference a name");

    if (mode === "generate") {
      if (!prompt.trim()) return toast.error("Write a prompt to generate the reference");
      startTransition(async () => {
        try {
          await generateReferenceAction({
            projectId,
            kind,
            name: name.trim(),
            description: description.trim(),
            prompt: prompt.trim(),
            model,
            seed,
            ratio: "1280:720",
          });
          toast.success(`${name} added to the cast`);
          onOpenChange(false);
          reset();
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Generation failed");
        }
      });
    } else {
      if (!imageDataUrl) return toast.error("Choose an image to upload");
      startTransition(async () => {
        try {
          await uploadReferenceAction({
            projectId,
            kind,
            name: name.trim(),
            description: description.trim(),
            imageDataUrl,
          });
          toast.success(`${name} added to the cast`);
          onOpenChange(false);
          reset();
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Upload failed");
        }
      });
    }
  }

  const tag = slugTag(name || "ref");
  const cost = estimateImageCost(model);

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(true) : (onOpenChange(false), reset()))}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Add to cast</DialogTitle>
          <DialogDescription>
            Lock a recurring character, location, or style. References are reused on every shot that
            mentions <code className="rounded bg-muted px-1.5 py-0.5 text-[10px]">@{tag}</code>.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-1.5">
          <Label>Kind</Label>
          <div className="grid grid-cols-3 gap-2">
            {(["character", "location", "style"] as ReferenceKind[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                  kind === k
                    ? "border-primary/50 bg-primary/10 text-foreground"
                    : "border-border bg-card/40 text-muted-foreground hover:bg-card"
                }`}
              >
                <span className="capitalize">{k}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-1.5">
          <Label>Name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={kind === "character" ? "Ava" : kind === "location" ? "Office" : "Noir"}
            autoFocus
          />
          {name ? (
            <div className="text-[11px] text-muted-foreground">
              Tag: <Badge variant={kind} className="text-[10px]">@{tag}</Badge>
            </div>
          ) : null}
        </div>

        <div className="grid gap-1.5">
          <Label>Description</Label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="One-line note — used to disambiguate in prompts"
          />
        </div>

        <Tabs value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="generate">
              <Wand2 className="h-3.5 w-3.5" /> Generate
            </TabsTrigger>
            <TabsTrigger value="upload">
              <Upload className="h-3.5 w-3.5" /> Upload
            </TabsTrigger>
          </TabsList>

          <TabsContent value="generate" className="grid gap-3">
            <div className="grid gap-1.5">
              <Label>Prompt</Label>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={
                  kind === "character"
                    ? "Portrait of Ava, 30s, dark hair, jade earrings, neutral studio backdrop"
                    : kind === "location"
                      ? "Open-plan office, late afternoon light, polished concrete floor"
                      : "Noir style — high-contrast monochrome, deep shadows, hard rim lighting"
                }
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Model</Label>
                <Select value={model} onValueChange={(v) => setModel(v as ImageModelName)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.entries(IMAGE_MODELS) as [ImageModelName, (typeof IMAGE_MODELS)[ImageModelName]][]).map(
                      ([m, s]) => (
                        <SelectItem key={m} value={m}>
                          <span className="font-mono text-xs">{m}</span> — {s.description}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Seed (optional)</Label>
                <Input
                  type="number"
                  value={seed ?? ""}
                  onChange={(e) => setSeed(e.target.value ? Number(e.target.value) : undefined)}
                  placeholder="lock identity"
                  className="font-mono"
                />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-xs">
              <span className="inline-flex items-center gap-2 text-muted-foreground">
                <Sparkles className="h-3 w-3" /> Estimated cost
              </span>
              <span className="font-mono tabular-nums">{formatUSD(cost)}</span>
            </div>
          </TabsContent>

          <TabsContent value="upload" className="grid gap-3">
            <label className="group relative flex h-44 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/70 bg-background/40 transition-colors hover:border-primary/50 hover:bg-background/60">
              {imageDataUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={imageDataUrl} alt="preview" className="absolute inset-0 h-full w-full rounded-xl object-cover" />
              ) : (
                <>
                  <Upload className="h-5 w-5 text-muted-foreground transition-transform group-hover:-translate-y-0.5" />
                  <span className="text-xs text-muted-foreground">Click to choose an image</span>
                </>
              )}
              <input type="file" accept="image/*" className="hidden" onChange={onFile} />
            </label>
            <p className="text-[11px] text-muted-foreground">
              Use a clean, well-lit shot. The model will reuse whatever the reference shows — including
              unintended details. A busy background "leaks" into every output.
            </p>
          </TabsContent>
        </Tabs>

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {pending ? "Working…" : mode === "generate" ? "Generate" : "Add"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
