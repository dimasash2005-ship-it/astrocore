import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { generateMedia } from "@/lib/server/media-generation"

// Image generation usually takes 15–30s; video (base image + motion)
// can take 1–2 minutes. Vercel's default function timeout is 10s on
// Hobby — this raises it. Hobby supports up to 60s; if you're on Pro
// you can raise this further (up to 300s) if video generation still
// times out for you.
export const maxDuration = 60

interface GenerateBody {
  prompt?: string
  mediaType?: "image" | "video"
  providerId?: string
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await req.json().catch(() => null)) as GenerateBody | null
    if (!body) {
      return NextResponse.json({ error: "Некоректне тіло запиту." }, { status: 400 })
    }

    const prompt = (body.prompt ?? "").trim()
    if (!prompt) {
      return NextResponse.json({ error: "Введіть опис (промпт)." }, { status: 400 })
    }
    if (prompt.length > 1500) {
      return NextResponse.json({ error: "Промпт занадто довгий." }, { status: 400 })
    }

    const mediaType = body.mediaType === "video" ? "video" : "image"

    const providerId = (body.providerId ?? "").trim()
    if (!providerId) {
      return NextResponse.json({ error: "Оберіть провайдера Leonardo AI." }, { status: 400 })
    }

    const result = await generateMedia({
      userId: user.id,
      providerId,
      prompt,
      mediaType,
    })

    return NextResponse.json(result)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error("[POST /api/generate-media] error:", msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}