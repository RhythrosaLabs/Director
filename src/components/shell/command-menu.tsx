"use client";

import { useRouter } from "next/navigation";
import {
  Clapperboard,
  Compass,
  FileVideo,
  Layers,
  Plus,
  Sparkles,
  Wand2,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";

export function CommandMenu({
  open,
  onOpenChange,
  projectId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projectId?: string;
}) {
  const router = useRouter();
  function go(href: string) {
    onOpenChange(false);
    router.push(href);
  }
  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Type a command, or jump to anything…" />
      <CommandList>
        <CommandEmpty>No matches.</CommandEmpty>
        <CommandGroup heading="Navigate">
          <CommandItem onSelect={() => go("/")}>
            <Compass className="h-4 w-4" /> Projects
            <CommandShortcut>G P</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => go("/projects/new")}>
            <Plus className="h-4 w-4" /> New project
            <CommandShortcut>N</CommandShortcut>
          </CommandItem>
        </CommandGroup>
        {projectId ? (
          <>
            <CommandSeparator />
            <CommandGroup heading="This project">
              <CommandItem onSelect={() => go(`/projects/${projectId}`)}>
                <Clapperboard className="h-4 w-4" /> Director
              </CommandItem>
              <CommandItem onSelect={() => go(`/projects/${projectId}/assets`)}>
                <Layers className="h-4 w-4" /> Assets
              </CommandItem>
              <CommandItem onSelect={() => go(`/projects/${projectId}/compose`)}>
                <FileVideo className="h-4 w-4" /> Compose
              </CommandItem>
            </CommandGroup>
          </>
        ) : null}
        <CommandSeparator />
        <CommandGroup heading="Help">
          <CommandItem onSelect={() => window.open("https://docs.dev.runwayml.com/api/", "_blank")}>
            <Wand2 className="h-4 w-4" /> Runway API docs
          </CommandItem>
          <CommandItem onSelect={() => window.open("https://dev.runwayml.com/", "_blank")}>
            <Sparkles className="h-4 w-4" /> Account & credits
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
