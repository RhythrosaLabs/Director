"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  Download,
  Film,
  ImageIcon,
  Music2,
  FileText,
  Search,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { relativeTime } from "@/lib/utils";

type AssetKind = "video" | "image" | "audio" | "other";

interface FileEntry {
  name: string;
  size: number;
  mtime: number;
  kind: AssetKind;
}

const KIND_FILTERS: { value: AssetKind | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "video", label: "Video" },
  { value: "image", label: "Image" },
  { value: "audio", label: "Audio" },
];

export function AssetsBrowser({
  projectId,
  projectName,
  files,
}: {
  projectId: string;
  projectName: string;
  files: FileEntry[];
}) {
  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState<AssetKind | "all">("all");

  const visible = files.filter((f) => {
    if (filter !== "all" && f.kind !== filter) return false;
    if (query && !f.name.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="mx-auto max-w-7xl px-6 py-10 lg:px-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl tracking-tight">Assets</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Everything Director Studio has generated for{" "}
            <span className="font-medium text-foreground">{projectName}</span>.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by filename"
              className="h-9 w-64 pl-8"
            />
          </div>
        </div>
      </header>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {KIND_FILTERS.map((k) => (
          <button
            key={k.value}
            onClick={() => setFilter(k.value)}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
              filter === k.value
                ? "border-primary/50 bg-primary/10 text-foreground"
                : "border-border bg-card/40 text-muted-foreground hover:bg-card"
            }`}
          >
            {k.label}
            <span className="ml-1.5 font-mono text-[10px] text-muted-foreground">
              {k.value === "all"
                ? files.length
                : files.filter((f) => f.kind === k.value).length}
            </span>
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-border/70 bg-card/30 p-12 text-center text-sm text-muted-foreground">
          {files.length === 0
            ? "No assets yet — render a shot or compose a final cut to populate this."
            : "Nothing matches that filter."}
        </div>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visible.map((file, i) => (
            <AssetCard key={file.name} projectId={projectId} file={file} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}

function AssetCard({
  projectId,
  file,
  index,
}: {
  projectId: string;
  file: FileEntry;
  index: number;
}) {
  const src = `/api/assets/${projectId}?path=${encodeURIComponent(file.name)}`;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.025 * index, ease: [0.16, 1, 0.3, 1] }}
      className="group overflow-hidden rounded-xl border border-border/60 bg-card/60 transition-colors hover:border-border"
    >
      <div className="relative aspect-video overflow-hidden bg-gradient-to-br from-muted to-background">
        {file.kind === "video" ? (
          /* eslint-disable-next-line jsx-a11y/media-has-caption */
          <video
            src={src}
            muted
            loop
            playsInline
            onMouseEnter={(e) => (e.currentTarget as HTMLVideoElement).play().catch(() => {})}
            onMouseLeave={(e) => (e.currentTarget as HTMLVideoElement).pause()}
            className="h-full w-full object-cover"
          />
        ) : file.kind === "image" ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={src} alt={file.name} className="h-full w-full object-cover" />
        ) : file.kind === "audio" ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-4">
            <Music2 className="h-6 w-6 text-muted-foreground" />
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <audio src={src} controls className="w-full" />
          </div>
        ) : (
          <div className="flex h-full items-center justify-center">
            <FileText className="h-6 w-6 text-muted-foreground" />
          </div>
        )}
        <Badge variant="muted" className="absolute left-2 top-2 text-[9px] backdrop-blur-md">
          {kindIcon(file.kind)} {file.kind}
        </Badge>
      </div>
      <div className="flex items-center justify-between gap-2 px-3 py-2">
        <div className="min-w-0">
          <p className="truncate font-mono text-[11px]">{file.name}</p>
          <p className="text-[10px] text-muted-foreground">
            {formatSize(file.size)} · {relativeTime(file.mtime)}
          </p>
        </div>
        <Button asChild size="icon" variant="ghost" aria-label="Download">
          <a href={src} download>
            <Download className="h-3.5 w-3.5" />
          </a>
        </Button>
      </div>
    </motion.div>
  );
}

function kindIcon(k: AssetKind) {
  if (k === "video") return <Film className="h-3 w-3" />;
  if (k === "image") return <ImageIcon className="h-3 w-3" />;
  if (k === "audio") return <Music2 className="h-3 w-3" />;
  return <FileText className="h-3 w-3" />;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
