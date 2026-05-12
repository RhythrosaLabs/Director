/**
 * Runway model registry — mirrors lib/providers/runway/models.py from OpenMontage
 * so cost / duration logic stays consistent across the suite.
 */

export const API_BASE = "https://api.dev.runwayml.com";
export const API_VERSION = "2024-11-06";
export const REFERENCE_TAG_MAX_LEN = 16;
/** Approximate dollar value of one Runway credit (1000 credits ≈ $10 prepaid). */
export const CREDIT_USD = 0.01;

export type VideoModelName =
  | "seedance2"
  | "gen4.5"
  | "gen4_turbo"
  | "gen4_aleph"
  | "veo3"
  | "veo3.1"
  | "veo3.1_fast";

export type ImageModelName = "gen4_image" | "gen4_image_turbo" | "gemini_2.5_flash";

export type Endpoint = "text_to_video" | "image_to_video" | "video_to_video";

export interface VideoModelSpec {
  endpoints: Endpoint[];
  creditsPerSec: number;
  description: string;
  bestFor: string;
  durations: number[];
  defaultDuration: number;
}

export interface ImageModelSpec {
  creditsPerImage: number;
  description: string;
  supportsReferences: boolean;
}

export const VIDEO_MODELS: Record<VideoModelName, VideoModelSpec> = {
  seedance2: {
    endpoints: ["text_to_video", "image_to_video", "video_to_video"],
    creditsPerSec: 36,
    description: "Reference image + video, long duration (up to 15s).",
    bestFor: "Long-form continuity, product demos",
    durations: [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    defaultDuration: 5,
  },
  "gen4.5": {
    endpoints: ["text_to_video", "image_to_video"],
    creditsPerSec: 12,
    description: "High quality, general purpose.",
    bestFor: "Default for 5–10s narrative shots",
    durations: [5, 10],
    defaultDuration: 5,
  },
  gen4_turbo: {
    endpoints: ["image_to_video"],
    creditsPerSec: 5,
    description: "Fast, image-driven (image required).",
    bestFor: "Cheap animation of locked keyframes",
    durations: [5, 10],
    defaultDuration: 5,
  },
  gen4_aleph: {
    endpoints: ["video_to_video"],
    creditsPerSec: 15,
    description: "Video editing — restyle, swap backgrounds, mood transfer.",
    bestFor: "Remix / background work on existing footage",
    durations: [5, 10],
    defaultDuration: 5,
  },
  veo3: {
    endpoints: ["text_to_video", "image_to_video"],
    creditsPerSec: 40,
    description: "Premium quality, 8s only.",
    bestFor: "Hero shots and trailers",
    durations: [8],
    defaultDuration: 8,
  },
  "veo3.1": {
    endpoints: ["text_to_video", "image_to_video"],
    creditsPerSec: 30,
    description: "High quality Google model.",
    bestFor: "Premium 4/6/8s shots",
    durations: [4, 6, 8],
    defaultDuration: 8,
  },
  "veo3.1_fast": {
    endpoints: ["text_to_video", "image_to_video"],
    creditsPerSec: 12,
    description: "Fast Google model.",
    bestFor: "Quick iteration with veo3 look",
    durations: [4, 6, 8],
    defaultDuration: 8,
  },
};

export const IMAGE_MODELS: Record<ImageModelName, ImageModelSpec> = {
  gen4_image: {
    creditsPerImage: 8,
    description: "Highest quality; supports reference tags.",
    supportsReferences: true,
  },
  gen4_image_turbo: {
    creditsPerImage: 2,
    description: "Fast and cheap. References supported.",
    supportsReferences: true,
  },
  "gemini_2.5_flash": {
    creditsPerImage: 5,
    description: "Google Gemini (Nano Banana). References supported.",
    supportsReferences: true,
  },
};

export function modelsSupporting(op: Endpoint): VideoModelName[] {
  return (Object.entries(VIDEO_MODELS) as [VideoModelName, VideoModelSpec][])
    .filter(([, spec]) => spec.endpoints.includes(op))
    .map(([name]) => name);
}

export function bestDuration(model: VideoModelName, requested: number): number {
  const valid = VIDEO_MODELS[model]?.durations;
  if (!valid?.length || valid.includes(requested)) return requested;
  return valid.reduce((best, d) =>
    Math.abs(d - requested) < Math.abs(best - requested) ? d : best,
  );
}

export function estimateVideoCost(model: VideoModelName, duration: number): number {
  const spec = VIDEO_MODELS[model];
  return (spec?.creditsPerSec ?? 0) * duration * CREDIT_USD;
}

export function estimateImageCost(model: ImageModelName): number {
  return (IMAGE_MODELS[model]?.creditsPerImage ?? 0) * CREDIT_USD;
}

export const COMMON_RATIOS: { label: string; value: string }[] = [
  { label: "16:9 landscape", value: "1280:720" },
  { label: "9:16 vertical", value: "720:1280" },
  { label: "1:1 square", value: "960:960" },
  { label: "4:3 standard", value: "1104:832" },
  { label: "21:9 cinema", value: "1584:672" },
];
