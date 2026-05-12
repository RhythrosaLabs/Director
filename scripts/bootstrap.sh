#!/usr/bin/env bash
# Director Studio — one-command bootstrap.
#
# Creates the private GitHub repo, pushes the current working tree, sets a
# description and a curated list of topics, and (optionally) uploads the
# screenshot SVGs. Safe to re-run: every step checks if the work is already
# done.
#
# Usage:
#   scripts/bootstrap.sh                 # default: RhythrosaLabs/director-studio (private)
#   OWNER=youruser VISIBILITY=public scripts/bootstrap.sh
#
# Requires:
#   - gh (https://cli.github.com)  — `gh auth login` once if you haven't.
#   - git
#
# That's it. Run from the repo root.

set -euo pipefail

OWNER="${OWNER:-RhythrosaLabs}"
NAME="${NAME:-director-studio}"
VISIBILITY="${VISIBILITY:-private}"  # private | public | internal
DESCRIPTION="${DESCRIPTION:-Hyperintelligent video production — one canvas for cast, storyboard, render, compose. Powered by Runway.}"
HOMEPAGE="${HOMEPAGE:-https://github.com/${OWNER}/${NAME}}"

# Curated topics — short and searchable.
TOPICS=(
  runway
  runway-api
  video-generation
  ai-video
  gen4
  veo3
  seedance
  aleph
  nextjs
  tailwindcss
  shadcn-ui
  framer-motion
  sqlite
  local-first
  creative-tools
  agentic-video
  storyboard
  film-tools
)

bold() { printf "\033[1m%s\033[0m\n" "$*"; }
say()  { printf "  · %s\n" "$*"; }
die()  { printf "\033[31m✗ %s\033[0m\n" "$*" >&2; exit 1; }

# ── preflight ────────────────────────────────────────────

bold "Director Studio · GitHub bootstrap"

command -v git >/dev/null || die "git is not installed."
command -v gh  >/dev/null || die "GitHub CLI 'gh' is not installed. https://cli.github.com"

if ! gh auth status >/dev/null 2>&1; then
  bold "1/6 · Authorize gh"
  gh auth login
fi
say "GitHub CLI is authenticated."

# ── ensure local git history ──────────────────────────────

if [ ! -d .git ]; then
  bold "2/6 · Initialise git history"
  git init -q
  git branch -M main
fi

if [ -z "$(git status --porcelain --untracked-files=no)" ] && [ -z "$(git log --oneline 2>/dev/null)" ]; then
  bold "  · staging initial commit"
  git add -A
  git -c commit.gpgsign=false commit -q -m "Initial commit: Director Studio v0.1"
elif [ -n "$(git status --porcelain)" ]; then
  bold "  · committing pending changes"
  git add -A
  git -c commit.gpgsign=false commit -q -m "Polish pass before publishing"
fi
say "Local history ready: $(git log --oneline | wc -l | tr -d ' ') commit(s)."

# ── create remote if missing ──────────────────────────────

if gh repo view "${OWNER}/${NAME}" >/dev/null 2>&1; then
  bold "3/6 · Repo already exists at ${OWNER}/${NAME}"
else
  bold "3/6 · Creating ${VISIBILITY} repo ${OWNER}/${NAME}"
  gh repo create "${OWNER}/${NAME}" \
    --"${VISIBILITY}" \
    --description "${DESCRIPTION}" \
    --homepage "${HOMEPAGE}" \
    --source . \
    --remote origin \
    --push
  say "Created and pushed initial commit."
fi

# ── ensure 'origin' points at the repo and push current branch ──

if ! git remote get-url origin >/dev/null 2>&1; then
  git remote add origin "https://github.com/${OWNER}/${NAME}.git"
fi
bold "4/6 · Pushing main"
git push -u origin main
say "Pushed."

# ── topics ───────────────────────────────────────────────

bold "5/6 · Applying topics"
gh api -X PUT "repos/${OWNER}/${NAME}/topics" \
  -H "Accept: application/vnd.github.mercy-preview+json" \
  -f "names[]=${TOPICS[0]}" \
  $(printf -- " -f names[]=%s" "${TOPICS[@]:1}") >/dev/null
say "Applied ${#TOPICS[@]} topics: ${TOPICS[*]}"

# ── description (in case the repo already existed) ────────

gh repo edit "${OWNER}/${NAME}" \
  --description "${DESCRIPTION}" \
  --homepage "${HOMEPAGE}" \
  >/dev/null
say "Description & homepage synced."

# ── done ─────────────────────────────────────────────────

bold "6/6 · Done"
say "View:    https://github.com/${OWNER}/${NAME}"
say "Clone:   git clone git@github.com:${OWNER}/${NAME}.git"
say "Settings: https://github.com/${OWNER}/${NAME}/settings"

cat <<'EOF'

Next:
  · Replace the SVG screenshots in docs/screenshots/ with real PNGs once
    you've used the app for a real production.
  · Optional: pnpm screenshots (Playwright captures the running localhost:8888).
  · Optional: gh release create v0.1.0 --notes-from-tag

Happy filming.
EOF
