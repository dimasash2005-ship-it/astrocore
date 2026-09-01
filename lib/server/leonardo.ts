// Server-only. Never import from a "use client" file.
//
// Wraps Leonardo.Ai's REST API (https://docs.leonardo.ai/reference).
// The base URL is fixed/trusted, so this calls fetch() directly rather
// than routing through lib/server/safe-fetch.ts (that SSRF guard exists
// specifically for the "custom" provider slug, where the URL comes from
// the user — not needed here since cloud.leonardo.ai is hardcoded).
//
// WHERE TO PUT THIS FILE: lib/server/leonardo.ts

const LEONARDO_BASE = "https://cloud.leonardo.ai/api/rest/v1";
const REQUEST_TIMEOUT_MS = 20_000;

// Leonardo Phoenix — a solid general-purpose text-to-image model.
// Swap this if you want a different default; modelId can also be
// passed per-call.
const DEFAULT_MODEL_ID = "6bef9f1b-29cb-40c7-b9df-32b51c1f67d3";

class LeonardoApiError extends Error {}

async function leonardoFetch(apiKey: string, path: string, init: RequestInit = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${LEONARDO_BASE}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
        ...(init.headers ?? {}),
      },
    });
    const text = await res.text();
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      /* non-JSON body, leave json null */
    }
    if (!res.ok) {
      const message = json?.error || json?.message || `Leonardo API error (HTTP ${res.status})`;
      throw new LeonardoApiError(message);
    }
    return json;
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new LeonardoApiError("Leonardo API request timed out.");
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ─── Image generation ──────────────────────────────────────────

export type LeonardoImageParams = {
  prompt: string;
  modelId?: string;
  width?: number;
  height?: number;
  numImages?: number;
  alchemy?: boolean;
};

export async function createImageGeneration(apiKey: string, params: LeonardoImageParams) {
  const body = {
    prompt: params.prompt,
    modelId: params.modelId ?? DEFAULT_MODEL_ID,
    width: params.width ?? 1024,
    height: params.height ?? 1024,
    num_images: params.numImages ?? 1,
    alchemy: params.alchemy ?? false,
  };
  const json = await leonardoFetch(apiKey, "/generations", {
    method: "POST",
    body: JSON.stringify(body),
  });
  const generationId = json?.sdGenerationJob?.generationId as string | undefined;
  if (!generationId) throw new LeonardoApiError("Leonardo did not return a generationId.");
  return { generationId };
}

// ─── Image-to-video (Motion 2.0) ───────────────────────────────
// `imageId` must be the *image* id from a completed generation
// (generated_images[].id from getGeneration below) — not the
// generationId itself.

export type LeonardoVideoParams = {
  imageId: string;
  prompt?: string;
  resolution?: "RESOLUTION_480" | "RESOLUTION_720";
};

export async function createImageToVideo(apiKey: string, params: LeonardoVideoParams) {
  const body = {
    imageType: "GENERATED",
    isPublic: false,
    resolution: params.resolution ?? "RESOLUTION_480",
    imageId: params.imageId,
    prompt: params.prompt,
    frameInterpolation: true,
    promptEnhance: true,
  };
  const json = await leonardoFetch(apiKey, "/generations-image-to-video", {
    method: "POST",
    body: JSON.stringify(body),
  });
  const generationId =
    json?.motionSvdGenerationJob?.generationId ?? json?.sdGenerationJob?.generationId;
  if (!generationId) {
    throw new LeonardoApiError("Leonardo did not return a generationId for the video job.");
  }
  return { generationId };
}

// ─── Poll status / fetch result ────────────────────────────────

export type LeonardoGenerationResult = {
  status: "PENDING" | "COMPLETE" | "FAILED";
  images: { id: string; url: string; motionMP4Url: string | null }[];
};

export async function getGeneration(
  apiKey: string,
  generationId: string
): Promise<LeonardoGenerationResult> {
  const json = await leonardoFetch(apiKey, `/generations/${generationId}`);
  const gen = json?.generations_by_pk;
  if (!gen) throw new LeonardoApiError("Generation not found.");

  const status = (gen.status as "PENDING" | "COMPLETE" | "FAILED") ?? "PENDING";
  const images = (gen.generated_images ?? []).map((img: any) => ({
    id: img.id,
    url: img.url,
    motionMP4Url: img.motionMP4URL ?? null,
  }));

  return { status, images };
}