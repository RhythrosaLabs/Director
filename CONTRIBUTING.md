# Contributing to Director Studio

Thanks for being here. Director Studio's success is going to be measured by how quickly a first-time visitor can ship their first 30-second film — so every kind of contribution helps, especially the ones that file down rough edges.

## Ways to help

| If you can spare… | Try… |
| --- | --- |
| 5 minutes | Open an issue describing the first friction you hit on a fresh clone. |
| 30 minutes | Fix a small thing on the list of [good first issues](https://github.com/RhythrosaLabs/director-studio/labels/good%20first%20issue). |
| An afternoon | Wire up a new Runway endpoint (e.g. `voice_isolation`) — pattern in `src/lib/actions/`. |
| A weekend | Record a video tutorial; ship it as a PR to `docs/`. |

## Development setup

```bash
git clone https://github.com/RhythrosaLabs/director-studio.git
cd director-studio
pnpm install
cp .env.example .env   # paste your RUNWAYML_API_SECRET
pnpm dev               # http://localhost:8888
```

You can iterate on most things without spending Runway credit — the cast panel, storyboard editor, and compose page all render their controls before any paid call.

## Commands

| | |
| --- | --- |
| `pnpm dev` | Dev server on port 8888 (Turbopack). |
| `pnpm build && pnpm start` | Production build + serve. |
| `pnpm typecheck` | `tsc --noEmit`. Must pass before opening a PR. |
| `pnpm lint` | ESLint. Must pass. |
| `pnpm db:studio` | Drizzle Studio for inspecting / editing the SQLite database. |

## Code style

- TypeScript strict; no `any` without a `// reason:` comment.
- Server-only code lives in `src/lib/{db,actions}/` and `src/app/api/`. Anything that imports `better-sqlite3` or reads `RUNWAYML_API_SECRET` must be server-side.
- UI primitives in `src/components/ui/` follow shadcn conventions — Radix + cva + `cn`.
- Aesthetic principles: **generous spacing**, **motion that earns its keep**, **font-mono for numerals**, **no emoji in product UI** (we ship one in the headline only).

## Adding a new Runway operation

Three files, in order:

1. **`src/lib/runway/client.ts`** — add a method that submits the job and returns the Runway task id.
2. **`src/lib/actions/<feature>.ts`** — wrap the client call in a `"use server"` action that creates a `Task` row, polls, downloads, and updates the relevant entity.
3. **A UI surface** — either a new button on an existing panel (`compose-panel.tsx`, `shot-editor.tsx`) or a dedicated component.

Always:
- Estimate cost before the call. Refuse if it would exceed `project.budgetUsd`.
- Persist a `Task` row so the live queue surfaces progress.
- Charge `project.spentUsd` only after the call succeeds.

## Pull requests

- Keep PRs focused — one feature or one fix per PR.
- Run `pnpm typecheck && pnpm lint` locally before opening.
- Include a short "before / after" GIF or screenshot for UI changes.
- New routes should ship with a one-line entry under the relevant README table.

## Reporting first-run friction

This is high-value feedback. Open an issue with the label `first-run` describing:

1. Your OS and Node version.
2. Where the steps in the README stopped matching reality.
3. The exact error message (or a screenshot).

Issues like _"on macOS Sonoma, ffmpeg lives at `/opt/homebrew/bin/ffmpeg` and the README should mention `brew install ffmpeg`"_ are exactly the right shape.

## Code of conduct

Be kind. Assume good intent. We're a small project trying to make something nice — let's keep it pleasant.

## License

By contributing, you agree your changes are licensed under the [MIT License](./LICENSE).
