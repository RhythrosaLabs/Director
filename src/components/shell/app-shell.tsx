"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  Clapperboard,
  Compass,
  FileVideo,
  Wand2,
  Layers,
  Sparkles,
  Keyboard,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./theme-toggle";
import { Button } from "@/components/ui/button";
import { CommandMenu } from "./command-menu";
import { OrgChip } from "./org-chip";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  match?: (pathname: string) => boolean;
  shortcut?: string;
}

export function AppShell({
  children,
  projectId,
}: {
  children: React.ReactNode;
  projectId?: string;
}) {
  const pathname = usePathname();
  const [commandOpen, setCommandOpen] = React.useState(false);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const globalNav: NavItem[] = [
    { href: "/", label: "Projects", icon: Compass },
    { href: "/projects/new", label: "New project", icon: Sparkles, shortcut: "N" },
  ];

  const projectNav: NavItem[] = projectId
    ? [
        {
          href: `/projects/${projectId}`,
          label: "Director",
          icon: Clapperboard,
          match: (p) => p === `/projects/${projectId}`,
        },
        {
          href: `/projects/${projectId}/assets`,
          label: "Assets",
          icon: Layers,
        },
        {
          href: `/projects/${projectId}/compose`,
          label: "Compose",
          icon: FileVideo,
        },
      ]
    : [];

  return (
    <div className="relative min-h-screen w-full">
      <CommandMenu open={commandOpen} onOpenChange={setCommandOpen} projectId={projectId} />
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[260px] flex-col border-r border-border/60 bg-card/30 backdrop-blur-xl md:flex">
        <div className="flex items-center gap-3 px-5 py-5">
          <Logo />
          <div className="flex flex-col leading-tight">
            <span className="font-display text-lg leading-none">Director</span>
            <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
              Studio
            </span>
          </div>
        </div>

        <nav className="flex flex-col gap-1 px-3">
          {globalNav.map((item) => (
            <NavLink key={item.href} item={item} pathname={pathname} />
          ))}
        </nav>

        {projectId ? (
          <>
            <div className="mt-6 px-5 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Project
            </div>
            <nav className="mt-2 flex flex-col gap-1 px-3">
              {projectNav.map((item) => (
                <NavLink key={item.href} item={item} pathname={pathname} />
              ))}
            </nav>
          </>
        ) : null}

        <div className="mt-auto flex flex-col gap-3 p-4">
          <Button
            variant="glass"
            size="sm"
            onClick={() => setCommandOpen(true)}
            className="justify-between w-full"
          >
            <span className="flex items-center gap-2 text-muted-foreground">
              <Wand2 className="h-3.5 w-3.5" /> Quick action
            </span>
            <span className="ml-auto flex items-center gap-1">
              <kbd className="rounded border border-border bg-muted/60 px-1.5 py-0.5 font-mono text-[10px] tracking-widest text-muted-foreground">
                ⌘K
              </kbd>
            </span>
          </Button>
          <OrgChip />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Keyboard className="h-3 w-3" /> Shortcuts
            </span>
            <ThemeToggle />
          </div>
        </div>
      </aside>

      <main className="md:ml-[260px]">
        <motion.div
          key={pathname}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
}

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = item.match ? item.match(pathname) : pathname === item.href || pathname.startsWith(item.href + "/");
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn(
        "group relative flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
        active
          ? "bg-accent text-foreground"
          : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
      )}
    >
      <Icon className={cn("h-4 w-4", active ? "text-primary" : "")} />
      <span className="flex-1">{item.label}</span>
      {item.shortcut ? (
        <kbd className="ml-auto rounded border border-border bg-muted/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
          {item.shortcut}
        </kbd>
      ) : null}
      {active ? (
        <motion.span
          layoutId="nav-active"
          className="absolute inset-y-1 left-0 w-0.5 rounded-r bg-primary"
        />
      ) : null}
    </Link>
  );
}

function Logo() {
  return (
    <div className="relative h-9 w-9 overflow-hidden rounded-lg bg-gradient-to-br from-primary/90 via-primary/40 to-primary/10 ring-1 ring-primary/30">
      <div className="absolute inset-0 grain opacity-50" />
      <svg viewBox="0 0 24 24" className="absolute inset-1 text-primary-foreground">
        <circle cx="12" cy="12" r="3.2" fill="currentColor" />
        <circle cx="4.6" cy="6.4" r="2.4" fill="currentColor" opacity={0.85} />
        <circle cx="19.4" cy="6.4" r="2.4" fill="currentColor" opacity={0.7} />
        <circle cx="4.6" cy="17.6" r="2.4" fill="currentColor" opacity={0.55} />
        <circle cx="19.4" cy="17.6" r="2.4" fill="currentColor" opacity={0.4} />
      </svg>
    </div>
  );
}
