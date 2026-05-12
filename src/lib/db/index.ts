/**
 * SQLite connection — better-sqlite3 + Drizzle.
 *
 * On first import we ensure the schema exists by running every table's
 * CREATE TABLE statement (idempotent via IF NOT EXISTS). For a real
 * deployment we'd switch to drizzle-kit migrations; for local-first
 * single-user usage this is simpler and zero-friction.
 */

import "server-only";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { promises as fs } from "node:fs";
import path from "node:path";
import * as schema from "./schema";

const dbPath = process.env.DATABASE_URL ?? "./data/director.db";
const absoluteDbPath = path.resolve(process.cwd(), dbPath);

declare global {
  // eslint-disable-next-line no-var
  var __director_sqlite__: Database.Database | undefined;
}

function openDb(): Database.Database {
  if (!globalThis.__director_sqlite__) {
    // Ensure parent dir exists synchronously — Database() is sync.
    const dir = path.dirname(absoluteDbPath);
    try {
      // node:fs sync alternative without importing again
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      require("node:fs").mkdirSync(dir, { recursive: true });
    } catch {
      /* tolerate */
    }
    const conn = new Database(absoluteDbPath);
    conn.pragma("journal_mode = WAL");
    conn.pragma("foreign_keys = ON");
    bootstrap(conn);
    globalThis.__director_sqlite__ = conn;
  }
  return globalThis.__director_sqlite__;
}

function bootstrap(conn: Database.Database) {
  conn.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      ratio TEXT NOT NULL DEFAULT '1280:720',
      budget_usd REAL NOT NULL DEFAULT 5,
      spent_usd REAL NOT NULL DEFAULT 0,
      final_video_path TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );

    CREATE TABLE IF NOT EXISTS "references" (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      kind TEXT NOT NULL CHECK (kind IN ('character','location','style')),
      name TEXT NOT NULL,
      tag TEXT NOT NULL,
      description TEXT DEFAULT '',
      image_path TEXT NOT NULL,
      image_url TEXT,
      seed INTEGER,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );
    CREATE INDEX IF NOT EXISTS idx_refs_project ON "references"(project_id);

    CREATE TABLE IF NOT EXISTS shots (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      position INTEGER NOT NULL,
      prompt TEXT NOT NULL,
      model TEXT NOT NULL DEFAULT 'gen4.5',
      ratio TEXT NOT NULL DEFAULT '1280:720',
      duration INTEGER NOT NULL DEFAULT 5,
      reference_tags TEXT NOT NULL DEFAULT '[]',
      seed INTEGER,
      keyframe_path TEXT,
      video_path TEXT,
      status TEXT NOT NULL DEFAULT 'draft',
      last_error TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );
    CREATE INDEX IF NOT EXISTS idx_shots_project_position ON shots(project_id, position);

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      shot_id TEXT REFERENCES shots(id) ON DELETE SET NULL,
      reference_id TEXT REFERENCES "references"(id) ON DELETE SET NULL,
      runway_id TEXT,
      kind TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      model TEXT,
      prompt_text TEXT,
      output_path TEXT,
      output_url TEXT,
      cost_usd REAL NOT NULL DEFAULT 0,
      error_message TEXT,
      started_at INTEGER,
      finished_at INTEGER,
      created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );
    CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS compositions (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
      voiceover_text TEXT,
      voiceover_voice TEXT,
      voiceover_path TEXT,
      music_prompt TEXT,
      music_path TEXT,
      music_volume REAL NOT NULL DEFAULT 0.25,
      crossfade_seconds REAL NOT NULL DEFAULT 0.4,
      final_path TEXT,
      updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
    );
  `);
}

export const db = drizzle(openDb(), { schema });
export { schema };

export async function ensureAssetsDir(projectId: string): Promise<string> {
  const root = path.resolve(process.cwd(), process.env.ASSETS_DIR ?? "./data/assets");
  const dir = path.join(root, projectId);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}
