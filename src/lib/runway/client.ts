/**
 * Low-level Runway HTTP client (TypeScript port of OpenMontage's lib/providers/runway/client.py).
 *
 * Server-only — never bundled to the browser. All routes that call this
 * read RUNWAYML_API_SECRET from the env on demand.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import {
  API_BASE,
  API_VERSION,
  REFERENCE_TAG_MAX_LEN,
  type VideoModelName,
  type ImageModelName,
  bestDuration,
} from "./models";

export class RunwayError extends Error {
  status: number;
  payload?: unknown;
  constructor(status: number, message: string, payload?: unknown) {
    super(`Runway ${status}: ${message}`);
    this.status = status;
    this.payload = payload;
    this.name = "RunwayError";
  }
}

export interface TaskState {
  id: string;
  status: "PENDING" | "RUNNING" | "SUCCEEDED" | "FAILED" | "CANCELLED" | string;
  output?: string[] | string;
  failure?: string;
  failureCode?: string;
  raw: Record<string, unknown>;
}

export interface RunwayClientOptions {
  apiKey?: string;
  baseUrl?: string;
  allowedMediaHosts?: string[];
}

export class RunwayClient {
  private apiKey: string;
  private baseUrl: string;
  private allowedHosts: Set<string>;

  constructor(opts: RunwayClientOptions = {}) {
    const key = opts.apiKey ?? process.env.RUNWAYML_API_SECRET;
    if (!key) {
      throw new RunwayError(
        401,
        "RUNWAYML_API_SECRET is not set. Add it to .env or your shell.",
      );
    }
    this.apiKey = key;
    this.baseUrl = (opts.baseUrl ?? API_BASE).replace(/\/+$/, "");
    const envHosts = (process.env.RUNWAY_ALLOWED_MEDIA_HOSTS ?? "")
      .split(",")
      .map((h) => h.trim())
      .filter(Boolean);
    this.allowedHosts = new Set(
      (opts.allowedMediaHosts ?? envHosts).map((h) => h.toLowerCase()),
    );
  }

  // ── HTTP plumbing ────────────────────────────────────

  private headers(extra?: Record<string, string>): HeadersInit {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      "X-Runway-Version": API_VERSION,
      "Content-Type": "application/json",
      ...extra,
    };
  }

  private async request<T = unknown>(
    method: "GET" | "POST",
    pathname: string,
    body?: unknown,
    { retries = 3 }: { retries?: number } = {},
  ): Promise<T> {
    const delays = [4000, 12000, 30000];
    let lastErr: RunwayError | null = null;
    for (let attempt = 0; attempt <= retries; attempt++) {
      const res = await fetch(`${this.baseUrl}${pathname}`, {
        method,
        headers: this.headers(),
        body: body ? JSON.stringify(body) : undefined,
        // Runway tasks short-poll; default fetch is enough.
      });
      if (res.ok) {
        if (res.status === 204) return undefined as T;
        return (await res.json()) as T;
      }
      const text = await res.text();
      lastErr = new RunwayError(res.status, parseError(res.status, text), safeJson(text));
      if ([429, 502, 503, 504].includes(res.status) && attempt < retries) {
        await sleep(delays[Math.min(attempt, delays.length - 1)]);
        continue;
      }
      throw lastErr;
    }
    throw lastErr ?? new RunwayError(0, "unknown failure");
  }

  // ── Introspection ────────────────────────────────────

  getOrganization() {
    return this.request<Record<string, unknown>>("GET", "/v1/organization");
  }

  getTask(taskId: string): Promise<TaskState> {
    return this.request<TaskState>("GET", `/v1/tasks/${encodeURIComponent(taskId)}`);
  }

  cancelTask(taskId: string) {
    return this.request("POST", `/v1/tasks/${encodeURIComponent(taskId)}/cancel`);
  }

  // ── Upload + URL resolution ──────────────────────────

  private validateUrl(url: string) {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") {
      throw new RunwayError(0, `unsupported URL scheme: ${u.protocol}`);
    }
    if (this.allowedHosts.size > 0) {
      const host = u.hostname.toLowerCase();
      if (!this.allowedHosts.has(host)) {
        throw new RunwayError(
          0,
          `host '${host}' not in RUNWAY_ALLOWED_MEDIA_HOSTS (${[...this.allowedHosts].join(",")})`,
        );
      }
    }
  }

  async uploadFile(localPath: string, ttl: "ephemeral" | "permanent" = "ephemeral"): Promise<string> {
    const filename = path.basename(localPath);
    const init = await this.request<{
      uploadUrl: string;
      fields?: Record<string, string>;
      runwayUri: string;
    }>("POST", "/v1/uploads", { filename, type: ttl });

    const data = await fs.readFile(localPath);
    const form = new FormData();
    for (const [k, v] of Object.entries(init.fields ?? {})) form.append(k, v);
    const blob = new Blob([data]);
    form.append("file", blob, filename);

    const res = await fetch(init.uploadUrl, { method: "POST", body: form });
    if (!res.ok) {
      throw new RunwayError(res.status, `upload to S3 failed: ${(await res.text()).slice(0, 300)}`);
    }
    return init.runwayUri;
  }

  async ensureUrl(pathOrUrl: string): Promise<string> {
    if (pathOrUrl.startsWith("runway://")) return pathOrUrl;
    if (/^https?:\/\//i.test(pathOrUrl)) {
      this.validateUrl(pathOrUrl);
      return pathOrUrl;
    }
    return this.uploadFile(pathOrUrl);
  }

  // ── Generation primitives ────────────────────────────

  async textToVideo(params: {
    prompt: string;
    model?: VideoModelName;
    ratio?: string;
    duration?: number;
    seed?: number;
    extra?: Record<string, unknown>;
  }): Promise<string> {
    const model = params.model ?? "gen4.5";
    const body = {
      model,
      promptText: params.prompt,
      ratio: params.ratio ?? "1280:720",
      duration: bestDuration(model, params.duration ?? 5),
      ...(params.seed != null ? { seed: params.seed } : {}),
      ...(params.extra ?? {}),
    };
    const res = await this.request<{ id: string }>("POST", "/v1/text_to_video", body);
    return res.id;
  }

  async imageToVideo(params: {
    image: string;
    prompt?: string;
    model?: VideoModelName;
    ratio?: string;
    duration?: number;
    lastFrame?: string;
    seed?: number;
    extra?: Record<string, unknown>;
  }): Promise<string> {
    const model = params.model ?? "gen4_turbo";
    const body: Record<string, unknown> = {
      model,
      promptImage: await this.ensureUrl(params.image),
      promptText: params.prompt ?? "",
      ratio: params.ratio ?? "1280:720",
      duration: bestDuration(model, params.duration ?? 5),
    };
    if (params.lastFrame) body.lastFrameImage = await this.ensureUrl(params.lastFrame);
    if (params.seed != null) body.seed = params.seed;
    Object.assign(body, params.extra ?? {});
    const res = await this.request<{ id: string }>("POST", "/v1/image_to_video", body);
    return res.id;
  }

  async videoToVideo(params: {
    video: string;
    prompt: string;
    model?: VideoModelName;
    ratio?: string;
    duration?: number;
    referenceImage?: string;
    seed?: number;
    extra?: Record<string, unknown>;
  }): Promise<string> {
    const model = params.model ?? "gen4_aleph";
    const body: Record<string, unknown> = {
      model,
      videoUri: await this.ensureUrl(params.video),
      promptText: params.prompt,
      ratio: params.ratio ?? "1280:720",
      duration: bestDuration(model, params.duration ?? 5),
    };
    if (params.referenceImage) body.referenceImage = await this.ensureUrl(params.referenceImage);
    if (params.seed != null) body.seed = params.seed;
    Object.assign(body, params.extra ?? {});
    const res = await this.request<{ id: string }>("POST", "/v1/video_to_video", body);
    return res.id;
  }

  async textToImage(params: {
    prompt: string;
    model?: ImageModelName;
    ratio?: string;
    references?: Record<string, string>;
    seed?: number;
    extra?: Record<string, unknown>;
  }): Promise<string> {
    const body: Record<string, unknown> = {
      model: params.model ?? "gen4_image",
      promptText: params.prompt,
      ratio: params.ratio ?? "1280:720",
    };
    if (params.references && Object.keys(params.references).length) {
      body.referenceImages = await Promise.all(
        Object.entries(params.references).map(async ([tag, src]) => {
          validateTag(tag);
          return { tag, uri: await this.ensureUrl(src) };
        }),
      );
    }
    if (params.seed != null) body.seed = params.seed;
    Object.assign(body, params.extra ?? {});
    const res = await this.request<{ id: string }>("POST", "/v1/text_to_image", body);
    return res.id;
  }

  // ── Audio ────────────────────────────────────────────

  async textToSpeech(text: string, voice: string, model = "eleven_multilingual_v2"): Promise<string> {
    const res = await this.request<{ id: string }>("POST", "/v1/text_to_speech", {
      model,
      text,
      voice,
    });
    return res.id;
  }

  async soundEffect(prompt: string, durationSeconds = 5): Promise<string> {
    const res = await this.request<{ id: string }>("POST", "/v1/sound_effect", {
      model: "eleven_text_to_sound_v2",
      text: prompt,
      durationSeconds,
    });
    return res.id;
  }

  async voiceDubbing(audio: string, targetLanguage: string, sourceLanguage?: string): Promise<string> {
    const body: Record<string, unknown> = {
      model: "eleven_voice_dubbing",
      audio: await this.ensureUrl(audio),
      targetLanguage,
    };
    if (sourceLanguage) body.sourceLanguage = sourceLanguage;
    const res = await this.request<{ id: string }>("POST", "/v1/voice_dubbing", body);
    return res.id;
  }

  // ── Download helper ──────────────────────────────────

  async download(url: string, dest: string): Promise<string> {
    const res = await fetch(url);
    if (!res.ok) throw new RunwayError(res.status, `download failed: ${url}`);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    const buf = Buffer.from(await res.arrayBuffer());
    await fs.writeFile(dest, buf);
    return path.resolve(dest);
  }
}

// ── helpers ─────────────────────────────────────────────

export function validateTag(tag: string) {
  if (!tag || tag.length > REFERENCE_TAG_MAX_LEN) {
    throw new RunwayError(0, `reference tag '${tag}' must be 1..${REFERENCE_TAG_MAX_LEN} characters`);
  }
  if (!/^[A-Za-z0-9_]+$/.test(tag)) {
    throw new RunwayError(0, `reference tag '${tag}' must be alnum or underscore`);
  }
}

function parseError(status: number, text: string): string {
  try {
    const data = JSON.parse(text);
    let msg = data.error || data.message || text.slice(0, 300);
    if (Array.isArray(data.issues) && data.issues.length) {
      const parts = data.issues.map(
        (i: { path?: string[]; message?: string }) => `${i.path?.at(-1) ?? "?"}: ${i.message ?? ""}`,
      );
      msg = `${msg} [${parts.join("; ")}]`;
    }
    if (status === 401) return `auth failed — check RUNWAYML_API_SECRET. ${msg}`;
    if (status === 400) return `invalid input — ${msg}`;
    return msg;
  } catch {
    return text?.slice(0, 300) || `HTTP ${status}`;
  }
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export function firstOutput(task: TaskState): string | null {
  const out = task.output;
  if (Array.isArray(out)) return out[0] ?? null;
  if (typeof out === "string") return out || null;
  return null;
}
