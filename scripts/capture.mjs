#!/usr/bin/env node
/**
 * Capture real PNG screenshots of the running app at http://localhost:8888.
 *
 * Usage:
 *   pnpm dlx playwright install chromium    # one-time
 *   pnpm screenshots                         # alias for `node scripts/capture.mjs`
 *
 * Outputs:
 *   docs/screenshots/01-landing.png
 *   docs/screenshots/02-director.png
 *   docs/screenshots/03-cast.png
 *   docs/screenshots/04-compose.png
 *
 * The README still points at the SVGs by default; swap the extension once
 * you have PNGs you're happy with.
 */

import { chromium } from "playwright";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";

const BASE = process.env.BASE_URL ?? "http://localhost:8888";
const OUT = path.resolve("docs/screenshots");

if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });

const shots = [
  { name: "01-landing.png", path: "/" },
  { name: "02-director.png", path: "/projects" }, // adjust to a real project id after creating one
];

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1600, height: 1000 },
  deviceScaleFactor: 2,
  colorScheme: "dark",
});
const page = await ctx.newPage();

for (const shot of shots) {
  const url = BASE + shot.path;
  process.stdout.write(`· ${url} → ${shot.name}\n`);
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(800); // let motion settle
  await page.screenshot({
    path: path.join(OUT, shot.name),
    fullPage: false,
    type: "png",
    scale: "device",
  });
}

await browser.close();
console.log("Done. Open docs/screenshots/ to review.");
