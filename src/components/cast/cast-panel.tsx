"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Users, MapPin, Sparkles } from "lucide-react";
import type { Reference, ReferenceKind } from "@/lib/db/schema";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ReferenceCard } from "./reference-card";
import { AddReferenceDialog } from "./add-reference-dialog";

export function CastPanel({
  projectId,
  references,
  activeTags,
}: {
  projectId: string;
  references: Reference[];
  activeTags: string[];
}) {
  const [tab, setTab] = React.useState<ReferenceKind>("character");
  const [addOpen, setAddOpen] = React.useState(false);

  const grouped: Record<ReferenceKind, Reference[]> = {
    character: references.filter((r) => r.kind === "character"),
    location: references.filter((r) => r.kind === "location"),
    style: references.filter((r) => r.kind === "style"),
  };

  return (
    <div className="rounded-2xl border border-border/60 bg-card/40 p-4 backdrop-blur">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-lg">Cast</h3>
        <Button size="sm" variant="ghost" onClick={() => setAddOpen(true)}>
          <Plus className="h-3.5 w-3.5" /> Add
        </Button>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as ReferenceKind)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="character">
            <Users className="h-3.5 w-3.5 text-[hsl(var(--character))]" /> People
            <span className="ml-1 font-mono text-[10px] text-muted-foreground">
              {grouped.character.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="location">
            <MapPin className="h-3.5 w-3.5 text-[hsl(var(--location))]" /> Places
            <span className="ml-1 font-mono text-[10px] text-muted-foreground">
              {grouped.location.length}
            </span>
          </TabsTrigger>
          <TabsTrigger value="style">
            <Sparkles className="h-3.5 w-3.5 text-[hsl(var(--style))]" /> Styles
            <span className="ml-1 font-mono text-[10px] text-muted-foreground">
              {grouped.style.length}
            </span>
          </TabsTrigger>
        </TabsList>

        {(["character", "location", "style"] as ReferenceKind[]).map((kind) => (
          <TabsContent key={kind} value={kind}>
            <AnimatePresence mode="popLayout">
              {grouped[kind].length === 0 ? (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="mt-4 rounded-xl border border-dashed border-border/70 bg-background/40 p-6 text-center text-xs text-muted-foreground"
                >
                  <div className="mx-auto mb-2 h-8 w-8 rounded-full bg-muted" />
                  No {kind === "style" ? "styles" : kind + "s"} yet.
                  <br />
                  Reference one image per recurring{" "}
                  {kind === "character" ? "person" : kind} to lock continuity.
                  <Button
                    size="sm"
                    variant="link"
                    className="mt-2"
                    onClick={() => setAddOpen(true)}
                  >
                    Add the first one →
                  </Button>
                </motion.div>
              ) : (
                <motion.div
                  key="list"
                  className="mt-3 grid grid-cols-1 gap-2"
                  layout
                >
                  {grouped[kind].map((ref) => (
                    <ReferenceCard
                      key={ref.id}
                      projectId={projectId}
                      reference={ref}
                      active={activeTags.includes(ref.tag)}
                    />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </TabsContent>
        ))}
      </Tabs>

      <AddReferenceDialog
        projectId={projectId}
        open={addOpen}
        onOpenChange={setAddOpen}
        initialKind={tab}
      />
    </div>
  );
}
