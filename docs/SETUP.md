# First-time setup

Five minutes from clone to first rendered shot. This guide assumes you've never touched Runway or Next.js — if you're already comfortable with both, the quick start in the [README](../README.md#-quick-start) is enough.

## 1. Install Node.js (if you don't have it)

| Platform | Command |
| --- | --- |
| macOS (Homebrew) | `brew install node@22` |
| macOS / Linux (nvm) | `curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh \| bash && nvm install 22 && nvm use 22` |
| Windows | Download the LTS installer from [nodejs.org](https://nodejs.org). |

Verify:

```bash
node --version   # should print v18.17 or higher (v22 recommended)
```

## 2. Install pnpm (recommended)

pnpm is faster and the lockfile is checked in. Skip if you prefer npm or yarn.

```bash
npm install -g pnpm
```

## 3. Install ffmpeg

Required for the final stitch step. The app will run without it, but you'll get an error when you click **Compose final cut**.

| Platform | Command |
| --- | --- |
| macOS | `brew install ffmpeg` |
| Debian / Ubuntu | `sudo apt-get install ffmpeg` |
| Fedora / RHEL | `sudo dnf install ffmpeg` |
| Windows | Download a static build from [gyan.dev](https://www.gyan.dev/ffmpeg/builds/) and add it to your `PATH`. |

Verify:

```bash
ffmpeg -version | head -1
```

## 4. Get a Runway developer key

1. Sign up at <https://dev.runwayml.com>.
2. Add prepaid credits — $10 minimum is enough for ~10–20 short productions.
3. Create an API key. Copy it; you'll paste it in step 6.

## 5. Clone the repo

```bash
git clone https://github.com/RhythrosaLabs/director-studio.git
cd director-studio
pnpm install
```

The install step builds `better-sqlite3` against your local Node — if that fails, see [TROUBLESHOOTING.md](./TROUBLESHOOTING.md).

## 6. Configure

```bash
cp .env.example .env
```

Open `.env` in your editor and paste your Runway key:

```env
RUNWAYML_API_SECRET=key_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

That is the only required variable. The other entries (`DATABASE_URL`, `ASSETS_DIR`) work out of the box.

## 7. Run

```bash
pnpm dev
```

Open <http://localhost:8888>. The sidebar should show a green "credits" chip — if it shows amber, your API key isn't being picked up; restart `pnpm dev` after editing `.env`.

## Your first production

The README's [5-minute starter](../README.md#first-timer-heres-a-5-minute-starter) walks you through it. tl;dr:

1. **New project** → pick a preset → name it.
2. **Add a character** in the Cast panel (generate one reference image with `gen4_image`).
3. **Add a shot** — write a prompt that mentions your character with `@Tag`. Render it.
4. Repeat for 3–5 shots.
5. **Compose** tab → voiceover + music + Compose final cut → download mp4.

Total spend: ~$2–$5.

## What to do next

- Read [`docs/TROUBLESHOOTING.md`](./TROUBLESHOOTING.md) if anything went sideways.
- Read the [README capability table](../README.md#-capabilities-surface) to see what else the app can do (remix, restyle, cutout, dubbing).
- File an issue for any rough edge you hit — first-run friction reports are the most valuable kind right now.
