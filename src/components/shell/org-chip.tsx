"use client";

import * as React from "react";
import { Coins, CircleAlert } from "lucide-react";

interface OrgState {
  ok: boolean;
  org?: {
    creditBalance?: number;
    tier?: { tierName?: string };
  };
  message?: string;
}

export function OrgChip() {
  const [state, setState] = React.useState<OrgState | null>(null);
  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/org", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setState(d);
      })
      .catch(() => {
        if (!cancelled) setState({ ok: false, message: "offline" });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!state) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-border/60 bg-card/40 px-3 py-2 text-xs text-muted-foreground">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-muted-foreground/60" />
        Checking Runway…
      </div>
    );
  }
  if (!state.ok) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-xs text-amber-500">
        <CircleAlert className="h-3.5 w-3.5" />
        <span className="truncate" title={state.message}>
          {state.message?.includes("RUNWAYML_API_SECRET") ? "API key not set" : "Runway unreachable"}
        </span>
      </div>
    );
  }
  const credits = state.org?.creditBalance ?? 0;
  const tier = state.org?.tier?.tierName ?? "Developer";
  return (
    <div className="flex items-center gap-2 rounded-md border border-border/60 bg-card/40 px-3 py-2 text-xs">
      <Coins className="h-3.5 w-3.5 text-primary" />
      <span className="font-mono tabular-nums">{credits.toLocaleString()}</span>
      <span className="text-muted-foreground">credits</span>
      <span className="ml-auto pill bg-muted/60 text-muted-foreground">{tier}</span>
    </div>
  );
}
