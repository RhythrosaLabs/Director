import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

/** Top-level production. */
export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").default(""),
  ratio: text("ratio").notNull().default("1280:720"),
  budgetUsd: real("budget_usd").notNull().default(5),
  spentUsd: real("spent_usd").notNull().default(0),
  finalVideoPath: text("final_video_path"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

/**
 * A recurring character, location, or style. Tag is the slug referenced in
 * prompts with @Tag syntax; imagePath is the locked reference frame.
 */
export const references = sqliteTable("references", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  kind: text("kind", { enum: ["character", "location", "style"] }).notNull(),
  name: text("name").notNull(),
  tag: text("tag").notNull(),
  description: text("description").default(""),
  imagePath: text("image_path").notNull(),
  imageUrl: text("image_url"),
  seed: integer("seed"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

/** A single shot in the production timeline. */
export const shots = sqliteTable("shots", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  position: integer("position").notNull(),
  prompt: text("prompt").notNull(),
  model: text("model").notNull().default("gen4.5"),
  ratio: text("ratio").notNull().default("1280:720"),
  duration: integer("duration").notNull().default(5),
  /** JSON array of reference tags this shot uses. */
  referenceTags: text("reference_tags").notNull().default("[]"),
  seed: integer("seed"),
  keyframePath: text("keyframe_path"),
  videoPath: text("video_path"),
  status: text("status", {
    enum: ["draft", "queued", "rendering", "complete", "failed"],
  })
    .notNull()
    .default("draft"),
  lastError: text("last_error"),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

/**
 * Long-running Runway tasks. One row per submitted job so the UI can
 * poll progress, surface errors, and tie outputs back to the shot they
 * belong to.
 */
export const tasks = sqliteTable("tasks", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  shotId: text("shot_id").references(() => shots.id, { onDelete: "set null" }),
  referenceId: text("reference_id").references(() => references.id, { onDelete: "set null" }),
  /** Runway task id (from POST response). */
  runwayId: text("runway_id"),
  kind: text("kind", {
    enum: [
      "keyframe",
      "shot",
      "remix",
      "bg_remove",
      "restyle",
      "voiceover",
      "sfx",
      "dub",
    ],
  }).notNull(),
  status: text("status", {
    enum: ["pending", "running", "succeeded", "failed", "cancelled"],
  })
    .notNull()
    .default("pending"),
  model: text("model"),
  promptText: text("prompt_text"),
  /** Local file path of the downloaded output. */
  outputPath: text("output_path"),
  /** Remote URL Runway returned. */
  outputUrl: text("output_url"),
  /** Cost we charged against the project's budget (USD). */
  costUsd: real("cost_usd").notNull().default(0),
  errorMessage: text("error_message"),
  startedAt: integer("started_at", { mode: "timestamp_ms" }),
  finishedAt: integer("finished_at", { mode: "timestamp_ms" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

/** The final composition (one row per project). */
export const compositions = sqliteTable("compositions", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" })
    .unique(),
  voiceoverText: text("voiceover_text"),
  voiceoverVoice: text("voiceover_voice"),
  voiceoverPath: text("voiceover_path"),
  musicPrompt: text("music_prompt"),
  musicPath: text("music_path"),
  musicVolume: real("music_volume").notNull().default(0.25),
  crossfadeSeconds: real("crossfade_seconds").notNull().default(0.4),
  finalPath: text("final_path"),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch() * 1000)`),
});

export type Project = typeof projects.$inferSelect;
export type Reference = typeof references.$inferSelect;
export type Shot = typeof shots.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type Composition = typeof compositions.$inferSelect;
export type ReferenceKind = "character" | "location" | "style";
export type ShotStatus = "draft" | "queued" | "rendering" | "complete" | "failed";
export type TaskKind = Task["kind"];
export type TaskStatus = Task["status"];
