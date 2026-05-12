# Director Studio

> One canvas for **cast / storyboard / render / compose** — a beautiful UI on top of Runway's full API, with the production intelligence of OpenMontage, the skills of `runwayml/skills`, the agentic surface of Director, and the consistency mindset of ViMax — fused into one app.

![Director Studio cover](public/cover.png)

## What this is

A local-first Next.js 15 app that lets you produce a full short-form film without leaving the browser:

- **Cast** recurring characters, locations, and styles — each one anchored by a locked reference image. Every prompt that mentions `@Tag` reuses that identity.
- **Storyboard** the shots: drag to reorder, inline-edit prompts, pick a model per shot (gen4.5 / seedance2 / veo3.x / gen4_turbo), see cost before you spend.
- **Render** with Runway. Every shot generates a keyframe (with references) first, then animates it via image-to-video — the technique that actually keeps faces and places consistent across cuts. Live progress in the bottom dock.
- **Remix / restyle / cutout** any rendered shot with `gen4_aleph` — restyle the whole production with a single reference image, swap a background, isolate the subject.
- **Compose** the final cut: generate voiceover (eleven_multilingual_v2) and music (eleven_text_to_sound_v2), set crossfade + music gain, and stitch into a single mp4 with ffmpeg.

All persisted to a local SQLite file. No cloud, no accounts.

## Quick start

```bash
# 1. Install
pnpm i        # or npm i / yarn / bun i

# 2. Configure your Runway key
cp .env.example .env
# then edit .env and paste your RUNWAYML_API_SECRET
# (get one at https://dev.runwayml.com/)

# 3. ffmpeg is required for stitching
# macOS:    brew install ffmpeg
# Debian:   sudo apt-get install ffmpeg
# Windows:  https://www.gyan.dev/ffmpeg/builds/

# 4. Run
pnpm dev
# open http://localhost:3000
```

The SQLite database and generated media are written to `data/` (gitignored). Wipe `data/` to reset the app.

## Tech

| Layer        | Choice                                                   |
| ------------ | -------------------------------------------------------- |
| Framework    | Next.js 15 (App Router, Server Actions, Turbopack)       |
| UI           | Tailwind v3 + shadcn/ui (Radix primitives) + Framer Motion |
| State        | Server Components + RQ-style polling on `/api/.../timeline` |
| DB           | SQLite via `better-sqlite3` + Drizzle ORM                |
| Generation   | Runway dev API — gen4 image/video, aleph, veo3.x, eleven |
| Composition  | ffmpeg (concat demuxer + xfade/amix for crossfades)      |

## Project structure

```
src/
├── app/                       Next.js routes
│   ├── (landing) page.tsx     Hero + project list
│   ├── projects/new/          Create a production
│   └── projects/[id]/         Director / Assets / Compose
├── components/
│   ├── ui/                    shadcn primitives (button, card, dialog, …)
│   ├── shell/                 AppShell, sidebar, command palette, hero
│   ├── cast/                  Cast panel + add-reference dialog
│   ├── storyboard/            Drag-reorder timeline + shot editor
│   ├── queue/                 Live task queue dock
│   └── compose/               Final cut, voiceover, music, remix grid
└── lib/
    ├── runway/                TS port of OpenMontage's Runway client
    ├── db/                    SQLite + Drizzle schema + queries
    ├── actions/               Server actions (projects, cast, shots, generation, composition)
    └── hooks/                 useTimeline (auto-polling)
```

## Capability surface

| Operation                  | Runway model            | Where it surfaces                          |
| -------------------------- | ----------------------- | ------------------------------------------ |
| Text-to-image (references) | `gen4_image`            | Cast registry · keyframe step              |
| Text-to-video              | `gen4.5`, `veo3.x`      | Shot render (no references)                |
| Image-to-video             | `gen4_turbo`, `gen4.5`  | Shot render (with keyframe)                |
| Long-duration video        | `seedance2`             | Shot render when duration > 10s            |
| Video-to-video remix       | `gen4_aleph`            | Compose → Post passes (per-shot remix)     |
| Background isolate         | `gen4_aleph` (cutout)   | Compose → Cutout button on any rendered shot |
| Voiceover                  | `eleven_multilingual_v2`| Compose → Voiceover                        |
| Music bed                  | `eleven_text_to_sound_v2` | Compose → Music                          |
| Final mp4                  | ffmpeg                  | Compose → Compose final cut                |

## Keyboard

| Shortcut | Action            |
| -------- | ----------------- |
| `⌘K`     | Command palette   |
| `N`      | New project       |

## Push this to a new private GitHub repo

Director Studio is currently a local working tree. To publish it as the private `RhythrosaLabs/director-studio` repo:

```bash
# from /home/user/director-studio (or wherever you ended up)
gh auth login                                          # if you haven't already
gh repo create RhythrosaLabs/director-studio --private --source . --remote origin --description "Hyperintelligent video production. One canvas for cast / storyboard / render / compose, on Runway."
git init
git add .
git commit -m "Initial commit: Director Studio v0.1 — Next.js UI for the Runway production suite"
git branch -M main
git push -u origin main
```

If you prefer not to use the `gh` CLI:

```bash
# 1. Create the empty repo on https://github.com/organizations/RhythrosaLabs/repositories/new (private)
# 2. Then:
git init
git add .
git commit -m "Initial commit: Director Studio v0.1"
git branch -M main
git remote add origin git@github.com:RhythrosaLabs/director-studio.git
git push -u origin main
```

## License

UNLICENSED (private project). Pulls in dependencies under MIT/ISC/Apache-2.0 — see `package.json`.
