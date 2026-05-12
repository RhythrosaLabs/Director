# Troubleshooting

If your problem isn't here, please open an issue — the goal is for this file to grow until first-run friction approaches zero.

---

## Install

### `better-sqlite3` fails to build / "Could not locate the bindings file"

`better-sqlite3` ships a prebuilt native module for common Node versions. If the prebuild misses your runtime, pnpm sometimes silently skips the postinstall.

**Fix**:

```bash
pnpm rebuild better-sqlite3
# or, if that still fails:
cd node_modules/.pnpm/better-sqlite3@*/node_modules/better-sqlite3
npm run install
```

If you see a `node-gyp` error, you're missing build tools:

| Platform | Command |
| --- | --- |
| macOS | `xcode-select --install` |
| Debian/Ubuntu | `sudo apt-get install build-essential python3` |
| Windows | `npm install --global windows-build-tools` (older Node) or install the Visual Studio C++ build tools. |

### `pnpm install` warns "Ignored build scripts"

pnpm 9+ requires you to opt in to running native build scripts. The repo ships an `.npmrc` that allows the ones we need. If you cloned before this was added, run:

```bash
pnpm rebuild
```

---

## Runtime

### Sidebar shows "API key not set"

Your `RUNWAYML_API_SECRET` isn't being picked up by the Next.js server. Check, in order:

1. `.env` exists in the repo root (not in `src/`).
2. The value has no quotes and no trailing whitespace: `RUNWAYML_API_SECRET=key_xxxxx`, not `RUNWAYML_API_SECRET="key_xxxxx"`.
3. You restarted `pnpm dev` after editing `.env`.

### "Runway 401" when rendering

Runway rejected the key. Likely causes:

- The key is for a different account than the one with credits.
- The key has been revoked.
- Your account has zero credits left — the sidebar chip will show `0 credits`.

Generate a new key at <https://dev.runwayml.com>.

### "Runway 400 — Invalid input"

The model rejected your request. Most common reasons:

- Wrong duration for the model — `veo3` only supports 8s, `gen4.5` only 5/10. The shot editor snaps to valid values, but if you've imported a storyboard from elsewhere it may not.
- An invalid aspect ratio — `gen4_image` accepts specific ratios; the dropdown shows the supported ones.
- A reference image that's too small, too large, or in an unsupported format. Use 1024×1024 or larger PNG/JPEG.

### Tasks never finish (stuck "Live")

Most Runway tasks complete in 30–180s. If a task is stuck for more than five minutes:

1. Open the task in the bottom dock and note its Runway task id.
2. Open the [Runway dashboard](https://dev.runwayml.com) → Tasks; check the real status.
3. If it's done there but not here, the polling might have stalled. Refresh the page; the in-app status will reconcile.
4. If it's actually stuck on Runway's side, that's a Runway outage — wait or retry.

### "ffmpeg not found" when composing

The compose step needs ffmpeg on your `PATH`. See [SETUP.md → step 3](./SETUP.md#3-install-ffmpeg). After installing, restart `pnpm dev`.

### "Non-monotonic DTS" or audio out of sync after compose

Happens when the rendered clips have slightly different codec parameters. Set `--crossfade` to any non-zero value on the Compose page (or pass `0.01`) — that switches the stitch to the complex filter graph, which normalizes timebases.

---

## UI

### The Drag handle does nothing

Drag-reorder is handled by Framer Motion's `Reorder` primitive. Make sure your browser is reasonably modern (Chrome / Edge / Firefox / Safari from the last two years). If you're on an old browser, the cards still click-to-select but won't drag.

### Hot reload doesn't pick up changes to `.env`

Next.js only reads `.env` at server start. Stop `pnpm dev` (`Ctrl-C`) and start it again.

### Port 8888 is in use

The dev server runs on `8888` by default. To change:

```bash
PORT=4000 pnpm dev   # nope, this doesn't work
# instead, edit package.json: "dev": "next dev --turbo -p 4000"
```

---

## Data

### How do I reset?

Delete `./data/`. All projects, references, rendered media, and the SQLite DB will be gone. The app rebuilds the schema on next start.

### How do I back up?

`./data/` is the whole state. `tar -czf backup.tgz data/` or copy the directory to another machine.

### Can I move data between machines?

Yes. Stop the app, copy `./data/` to the new machine, start the app there. Paths in the DB are absolute though, so if you move the repo to a different location you may need to re-render some assets. (We're tracking this; relative paths are on the roadmap.)

---

## Still stuck?

Open an issue: <https://github.com/RhythrosaLabs/director-studio/issues/new>

Include:
- Your OS + Node version (`node --version`).
- The exact error message.
- Whether it happened on first run or only after some action (and which one).
