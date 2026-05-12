# Changelog

All notable changes to Director Studio are documented here. Format roughly follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Planned
- Real PNG screenshots and a tutorial GIF (`scripts/capture.mjs`).
- Storyboard import from a screenplay.
- Project zip export / import.
- Multi-language dub surfaced on the Compose page.
- Hosted demo at `studio.rhythrosalabs.dev`.

## [0.1.0] — 2026-05-12

First public release.

### Added
- Local-first Next.js 15 app on port 8888 with Tailwind 3 + shadcn/ui.
- Cast registry: generate or upload character / location / style references; tags drive `@Tag`-prefixed prompts.
- Storyboard editor: drag-reorder shots, inline prompt editing, per-shot model / duration / ratio / seed, live cost estimate.
- Live render queue: bottom dock that polls every 1.2–2.5s and surfaces every Runway task with status, model, and cost.
- Compose page: voiceover (`eleven_multilingual_v2`), music bed (`eleven_text_to_sound_v2`), per-shot aleph remix / cutout, crossfade + music-volume sliders, ffmpeg final mp4.
- Assets browser: filterable grid of every generated asset with hover-play video previews and one-click download.
- Command palette (`⌘K`), light/dark themes, theme toggle with crossfade icon morph, aurora hero, film-grain texture.
- TypeScript port of OpenMontage's Runway client (`src/lib/runway/client.ts`).
- SQLite + Drizzle ORM schema for projects, references, shots, tasks, compositions.
- 18 offline tests on the underlying library logic (in OpenMontage upstream).
- One-command bootstrap script (`scripts/bootstrap.sh`) to create the GitHub repo, set topics, and push.

[Unreleased]: https://github.com/RhythrosaLabs/director-studio/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/RhythrosaLabs/director-studio/releases/tag/v0.1.0
