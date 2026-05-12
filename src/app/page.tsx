import Link from "next/link";
import { listProjects } from "@/lib/db/queries";
import { AppShell } from "@/components/shell/app-shell";
import { Hero } from "@/components/shell/hero";
import { ProjectCard } from "@/components/shell/project-card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default async function Home() {
  const projects = await listProjects();
  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-6 pb-24 pt-10 lg:px-10">
        <Hero hasProjects={projects.length > 0} />
        <section className="mt-16">
          <header className="flex items-end justify-between">
            <div>
              <h2 className="font-display text-2xl">Your productions</h2>
              <p className="text-sm text-muted-foreground">
                {projects.length === 0
                  ? "Nothing here yet — start your first project."
                  : `${projects.length} ${projects.length === 1 ? "project" : "projects"} in motion.`}
              </p>
            </div>
            <Button asChild>
              <Link href="/projects/new">
                <Plus className="h-4 w-4" /> New project
              </Link>
            </Button>
          </header>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p, i) => (
              <ProjectCard key={p.id} project={p} index={i} />
            ))}
            {projects.length === 0 ? (
              <Link
                href="/projects/new"
                className="group relative col-span-full flex h-48 items-center justify-center rounded-xl border border-dashed border-border/70 bg-card/30 text-sm text-muted-foreground transition-colors hover:bg-card/60 hover:text-foreground"
              >
                <span className="absolute inset-0 rounded-xl bg-aurora opacity-0 transition-opacity group-hover:opacity-60" />
                <span className="relative inline-flex items-center gap-2">
                  <Plus className="h-4 w-4" /> Start your first production
                </span>
              </Link>
            ) : null}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
