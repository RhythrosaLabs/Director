"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Film, Sparkles, Users, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const lines = [
  { word: "Cast", color: "hsl(var(--character))" },
  { word: "Storyboard", color: "hsl(var(--location))" },
  { word: "Render", color: "hsl(var(--primary))" },
  { word: "Compose", color: "hsl(var(--style))" },
];

export function Hero({ hasProjects }: { hasProjects: boolean }) {
  return (
    <section className="relative isolate overflow-hidden rounded-3xl border border-border/60 bg-card/40 px-6 py-14 backdrop-blur-xl lg:px-12 lg:py-20">
      <div className="absolute inset-0 -z-10 bg-aurora opacity-80" />
      <div className="absolute inset-0 -z-10 grain opacity-50" />
      <div className="grid items-start gap-12 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <motion.span
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="pill border border-primary/30 bg-primary/10 text-primary"
          >
            <Sparkles className="h-3 w-3" /> Powered by Runway · gen4 · veo3 · seedance2 · aleph
          </motion.span>

          <motion.h1
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.05 }}
            className="mt-6 font-display text-5xl leading-[1.05] text-balance tracking-tight md:text-6xl lg:text-7xl"
          >
            One canvas for{" "}
            <span className="relative inline-flex flex-wrap gap-x-3">
              {lines.map((l, i) => (
                <motion.span
                  key={l.word}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.2 + i * 0.08 }}
                  style={{ color: l.color }}
                  className="italic"
                >
                  {l.word}
                  {i < lines.length - 1 ? <span className="text-foreground/40">/</span> : "."}
                </motion.span>
              ))}
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="mt-5 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground"
          >
            Director Studio is the unified front-end for OpenMontage, Runway skills, Director agents, and ViMax —
            cast a recurring character, storyboard a sequence, watch each shot render live, then stitch a final
            cut with voiceover and music. All on Runway. All in one place.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.7 }}
            className="mt-8 flex flex-wrap items-center gap-3"
          >
            <Button asChild size="xl" className="group">
              <Link href="/projects/new">
                {hasProjects ? "New production" : "Start your first production"}
                <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </Button>
            <Button asChild variant="glass" size="xl">
              <Link href="https://docs.dev.runwayml.com/api/" target="_blank">
                Runway API docs
              </Link>
            </Button>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.4 }}
          className="grid grid-cols-2 gap-3"
        >
          <Feature
            icon={<Users className="h-4 w-4 text-[hsl(var(--character))]" />}
            title="Cast & continuity"
            body="Lock characters, locations, and styles once. Reuse @Tag references across every shot."
          />
          <Feature
            icon={<Film className="h-4 w-4 text-[hsl(var(--location))]" />}
            title="Storyboard editor"
            body="Drag to reorder. Inline-edit prompts. See cost before you spend."
          />
          <Feature
            icon={<Sparkles className="h-4 w-4 text-primary" />}
            title="Live generation"
            body="Submit to Runway. Watch tasks roll in. Preview thumbnails as they finish."
          />
          <Feature
            icon={<Wand2 className="h-4 w-4 text-[hsl(var(--style))]" />}
            title="Remix & compose"
            body="gen4_aleph restyle, background swap. Stitch with voiceover and music. Export mp4."
          />
        </motion.div>
      </div>
    </section>
  );
}

function Feature({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-border/60 bg-background/60 p-4 transition-colors hover:bg-background/80">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-sm font-medium">{title}</span>
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );
}
