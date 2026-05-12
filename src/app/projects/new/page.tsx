import { AppShell } from "@/components/shell/app-shell";
import { NewProjectForm } from "@/components/shell/new-project-form";

export default function NewProjectPage() {
  return (
    <AppShell>
      <div className="mx-auto max-w-3xl px-6 py-16 lg:px-10">
        <div className="mb-8">
          <h1 className="font-display text-4xl tracking-tight">Start a new production</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            A production groups a cast, a storyboard, rendered shots, and a final composition under one budget.
            You can change everything later.
          </p>
        </div>
        <NewProjectForm />
      </div>
    </AppShell>
  );
}
