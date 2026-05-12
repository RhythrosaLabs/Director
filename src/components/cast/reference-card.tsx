"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Reference } from "@/lib/db/schema";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { deleteReferenceAction } from "@/lib/actions/cast";

export function ReferenceCard({
  projectId,
  reference,
  active,
}: {
  projectId: string;
  reference: Reference;
  active: boolean;
}) {
  const [pending, startTransition] = React.useTransition();
  const variant = reference.kind as "character" | "location" | "style";
  const imageSrc = `/api/assets/${projectId}?path=${encodeURIComponent(
    reference.imagePath.split("/").pop() ?? "",
  )}`;

  function remove() {
    if (!confirm(`Remove ${reference.name} from the cast?`)) return;
    startTransition(async () => {
      try {
        await deleteReferenceAction(projectId, reference.id);
        toast.success(`Removed ${reference.name}`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not remove");
      }
    });
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25 }}
      className={cn(
        "group relative flex items-center gap-3 rounded-xl border border-border/60 bg-card/60 p-2 transition-all hover:border-border",
        active && "border-primary/40 bg-primary/[0.04] ring-1 ring-primary/30",
      )}
    >
      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-border/60 bg-muted">
        {/* Using <img> rather than next/image so we don't trip the optimizer on local API routes. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imageSrc} alt={reference.name} className="h-full w-full object-cover" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{reference.name}</span>
          <Badge variant={variant} className="text-[9px]">@{reference.tag}</Badge>
        </div>
        {reference.description ? (
          <p className="line-clamp-1 text-[11px] text-muted-foreground">{reference.description}</p>
        ) : null}
      </div>
      <Button
        size="icon"
        variant="ghost"
        className="opacity-0 transition-opacity group-hover:opacity-100"
        onClick={remove}
        disabled={pending}
        aria-label={`Remove ${reference.name}`}
      >
        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
      </Button>
    </motion.div>
  );
}
