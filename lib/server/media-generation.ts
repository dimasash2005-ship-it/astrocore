// Server-only. Never import from a "use client" file.
//
// WHERE TO PUT THIS FILE: lib/server/media-generation.ts
//
// Single entry point for "generate an image/video from a prompt" —
// used by both app/api/generate-media/route.ts (the manual Gallery
// button) and app/api/chat/route.ts (an agent calling it as a tool
// mid-conversation). Keeping the logic in one place means both paths
// stay in sync automatically.
//
// This is synchronous from the caller's perspective: it submits the
// job to Leonardo and polls until it's done (or times out), then
// returns the final URL. Simpler than a job-queue/webhook setup, at
// the cost of a slow HTTP response — see the maxDuration note in
// app/api/generate-media/route.ts regarding Vercel's function time limit.

import { createClient } from "@/lib/supabase/server"
import { decryptSecret } from "@/lib/server/encryption"
import {
  createImageGeneration,
  createImageToVideo,
  getGeneration,
  type LeonardoGenerationResult,
} from "@/lib/server/leonardo"

export type GenerateMediaParams = {
  userId: string
  providerId: string
  prompt: string
  mediaType: "image" | "video"
  width?: number
  height?: number
}

export type GenerateMediaResult = {
  url: string
  mediaType: "image" | "video"
}

const POLL_INTERVAL_MS = 2_000
const MAX_POLL_MS = 55_000 // stay under a 60s function timeout with margin

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function pollUntilDone(apiKey: string, generationId: string): Promise<LeonardoGenerationResult> {
  const start = Date.now()
  while (Date.now() - start < MAX_POLL_MS) {
    const result = await getGeneration(apiKey, generationId)
    if (result.status === "COMPLETE") return result
    if (result.status === "FAILED") throw new Error("Генерація не вдалася на боці Leonardo.")
    await sleep(POLL_INTERVAL_MS)
  }
  throw new Error("Час очікування генерації вичерпано. Спробуйте ще раз.")
}

export async function generateMedia(params: GenerateMediaParams): Promise<GenerateMediaResult> {
  const supabase = await createClient()

  const { data: provider, error } = await supabase
    .from("providers")
    .select("id, slug, api_key, encrypted_api_key")
    .eq("id", params.providerId)
    .eq("user_id", params.userId)
    .single()

  if (error || !provider) {
    throw new Error("Провайдера не знайдено або він вам не належить.")
  }
  if (provider.slug !== "leonardo") {
    throw new Error("Цей провайдер не підтримує генерацію зображень/відео.")
  }

  let apiKey: string
  try {
    apiKey = provider.encrypted_api_key ? decryptSecret(provider.encrypted_api_key) : (provider.api_key ?? "")
  } catch {
    throw new Error("Не вдалося розшифрувати ключ провайдера.")
  }
  if (!apiKey) {
    throw new Error("У провайдера відсутній API ключ.")
  }

  if (params.mediaType === "image") {
    const { generationId } = await createImageGeneration(apiKey, {
      prompt: params.prompt,
      width: params.width,
      height: params.height,
    })
    const result = await pollUntilDone(apiKey, generationId)
    const image = result.images[0]
    if (!image) throw new Error("Leonardo не повернув жодного зображення.")
    return { url: image.url, mediaType: "image" }
  }

  // Video: Leonardo needs an existing generated image first, then
  // animates it (Motion). So we generate a base image, then feed its
  // image id into the image-to-video call.
  const { generationId: imageGenId } = await createImageGeneration(apiKey, {
    prompt: params.prompt,
    width: params.width,
    height: params.height,
  })
  const baseImageResult = await pollUntilDone(apiKey, imageGenId)
  const baseImage = baseImageResult.images[0]
  if (!baseImage) throw new Error("Не вдалося створити базове зображення для відео.")

  const { generationId: videoGenId } = await createImageToVideo(apiKey, {
    imageId: baseImage.id,
    prompt: params.prompt,
  })
  const videoResult = await pollUntilDone(apiKey, videoGenId)
  const videoImage = videoResult.images.find(img => img.motionMP4Url)
  if (!videoImage?.motionMP4Url) throw new Error("Leonardo не повернув відео.")

  return { url: videoImage.motionMP4Url, mediaType: "video" }
}