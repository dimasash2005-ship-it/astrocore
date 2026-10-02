#!/usr/bin/env node
// AsCore connector — runs on the user's own server next to OpenClaw.
// Installed and configured by connect-agent.sh (service: ascore-connector).
//
// It connects OUT to AsCore, so the server needs no open ports, domain or
// HTTPS — works on a VPS, a home server or a laptop behind a router.
//
//   loop:  agent_claim (every ~2s)  →  got a job?
//          → send it to the local OpenClaw Gateway (streaming)
//          → agent_report "progress" every ~2.5s with the text so far
//            (+ keep-alive every 20s while the agent is silent, e.g. using tools)
//          → agent_report "done" / "error"
//
// Voice replies: if the agent's answer points to an audio file — a line like
//   MEDIA: /tmp/tts/reply.mp3      (or a URL / [voice](file.ogg) link)
// — the connector uploads that file to AsCore and the reply shows up in the
// chat as a voice message. The owner sets up the voice (e.g. ElevenLabs) in
// OpenClaw itself; AsCore only delivers the audio.
//
// One job at a time. A job may run up to 30 minutes.
// Needs Node 18+ (global fetch). No npm dependencies.

import { execFile } from "node:child_process"
import { readFile, stat } from "node:fs/promises"
import { basename } from "node:path"

const env = process.env
const CFG = {
  supabaseUrl:  (env.SUPABASE_URL || "").replace(/\/+$/, ""),
  ascoreUrl:    (env.ASTROCORE_URL || "https://astrocore.one").replace(/\/+$/, ""),
  supabaseKey:  env.SUPABASE_KEY || "",
  apiKey:       env.ASTROCORE_API_KEY || "",
  gatewayUrl:   `http://127.0.0.1:${env.GATEWAY_PORT || 18789}/v1/chat/completions`,
  gatewayToken: env.GATEWAY_TOKEN || "",
}

const POLL_MS        = 2_000
const MAX_BACKOFF_MS = 30_000
const JOB_TIMEOUT_MS = 30 * 60_000
const PROGRESS_MS    = 2_500
const KEEPALIVE_MS   = 20_000

const log   = (...a) => console.log(...a)
const sleep = ms => new Promise(r => setTimeout(r, ms))

for (const [name, value] of Object.entries({
  SUPABASE_URL: CFG.supabaseUrl, SUPABASE_KEY: CFG.supabaseKey,
  ASTROCORE_API_KEY: CFG.apiKey, GATEWAY_TOKEN: CFG.gatewayToken,
})) {
  if (!value) {
    console.error(`Не задано ${name}. Запусти команду підключення з AsCore ще раз.`)
    process.exit(1)
  }
}

let agentVersion = null
execFile("openclaw", ["--version"], { timeout: 15_000 }, (_err, stdout) => {
  const m = String(stdout || "").match(/\d{4}\.\d+\.\d+/)
  if (m) agentVersion = m[0]
})

class KeyRejected extends Error {}

// ── AsCore (Supabase RPC) ────────────────────────────────────────

async function rpc(fn, args, timeoutMs = 30_000) {
  const headers = {
    apikey: CFG.supabaseKey,
    "Content-Type": "application/json",
    Accept: "application/json",
  }
  // Legacy anon keys are JWTs and also go in Authorization; new sb_publishable_ keys don't.
  if (CFG.supabaseKey.startsWith("eyJ")) headers.Authorization = `Bearer ${CFG.supabaseKey}`

  const res = await fetch(`${CFG.supabaseUrl}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers,
    body: JSON.stringify(args),
    signal: AbortSignal.timeout(timeoutMs),
  })
  const text = await res.text()
  if (!res.ok) {
    if (text.includes("invalid_key")) {
      throw new KeyRejected("AsCore не приймає ключ цього агента (його відкликали або видалили підключення). Підключи агента заново в AsCore.")
    }
    throw new Error(`${fn}: HTTP ${res.status} ${text.slice(0, 200)}`)
  }
  return text ? JSON.parse(text) : null
}

const claim = () =>
  rpc("agent_claim", { p_key: CFG.apiKey, p_version: agentVersion })

const report = (jobId, status, content) =>
  rpc("agent_report", { p_key: CFG.apiKey, p_job_id: jobId, p_status: status, p_content: content ?? null })

async function reportFinal(jobId, status, content) {
  let delay = 2_000
  for (let attempt = 1; attempt <= 6; attempt++) {
    try {
      await report(jobId, status, content)
      return
    } catch (e) {
      if (e instanceof KeyRejected) throw e
      log(`не вдалося відправити відповідь (спроба ${attempt}): ${e.message}`)
      await sleep(delay)
      delay = Math.min(delay * 2, 30_000)
    }
  }
  log(`відповідь на задачу ${jobId} втрачено: AsCore недоступний`)
}

// ── OpenClaw ─────────────────────────────────────────────────────

async function askGateway(payload, signal, onText) {
  const res = await fetch(CFG.gatewayUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${CFG.gatewayToken}`,
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: JSON.stringify({
      model: payload.model || "openclaw",
      messages: Array.isArray(payload.messages) ? payload.messages : [],
      stream: true,
      // Separate agent context per AsCore chat (same as the old stream route).
      user: payload.sessionId ? `astrocore-${payload.sessionId}` : "astrocore:openclaw",
    }),
    signal,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "")
    throw new Error(`OpenClaw Gateway HTTP ${res.status}: ${text.slice(0, 300)}`)
  }

  const type = res.headers.get("content-type") || ""
  if (!type.includes("text/event-stream") || !res.body) {
    const data = await res.json().catch(() => ({}))
    const content = data?.choices?.[0]?.message?.content
    onText(typeof content === "string" ? content : "")
    return
  }

  const decoder = new TextDecoder()
  let buf = ""
  let acc = ""
  for await (const chunk of res.body) {
    buf += decoder.decode(chunk, { stream: true })
    let nl
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim()
      buf = buf.slice(nl + 1)
      if (!line.startsWith("data:")) continue
      const data = line.slice(5).trim()
      if (data === "[DONE]") return
      try {
        const json = JSON.parse(data)
        const piece = json?.choices?.[0]?.delta?.content
        if (typeof piece === "string" && piece) { acc += piece; onText(acc) }
        const errMsg = json?.error?.message
        if (typeof errMsg === "string" && errMsg) { acc += `\n\n⚠️ ${errMsg}`; onText(acc) }
      } catch {
        // keep-alives / partial lines
      }
    }
  }
}

// ── Voice replies ────────────────────────────────────────────────

const AUDIO_EXT = "mp3|ogg|opus|oga|m4a|aac|wav|webm"
const MAX_AUDIO_BYTES = 4 * 1024 * 1024
const AUDIO_PATTERNS = [
  // MEDIA: /path/file.mp3   or   MEDIA:https://…/file.ogg
  new RegExp(`^[ \\t]*MEDIA:[ \\t]*\\\`?([^\\s\\\`]+\\.(?:${AUDIO_EXT}))\\\`?[ \\t]*$`, "im"),
  // [voice](/path/file.mp3)  or  ![](https://…/file.ogg)
  new RegExp(`!?\\[[^\\]]*\\]\\(([^)\\s]+\\.(?:${AUDIO_EXT}))\\)`, "i"),
  // a bare absolute path or URL on its own line
  new RegExp(`^[ \\t]*((?:\\/|https?:\\/\\/)[^\\s]+\\.(?:${AUDIO_EXT}))[ \\t]*$`, "im"),
]

function findAudio(text) {
  for (const re of AUDIO_PATTERNS) {
    const m = re.exec(text)
    if (m) return { ref: m[1], match: m[0] }
  }
  return null
}

async function loadAudio(ref) {
  if (/^https?:\/\//i.test(ref)) {
    const res = await fetch(ref, { signal: AbortSignal.timeout(60_000) })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const buf = new Uint8Array(await res.arrayBuffer())
    return { buf, name: basename(new URL(ref).pathname) || "voice.mp3" }
  }
  const info = await stat(ref)
  if (info.size > MAX_AUDIO_BYTES) throw new Error(`файл завеликий (${Math.round(info.size / 1024)} КБ, макс. 4 МБ)`)
  return { buf: await readFile(ref), name: basename(ref) }
}

// Returns the text without the audio reference if the upload worked.
async function deliverVoice(jobId, text) {
  const found = findAudio(text)
  if (!found) return text
  try {
    const { buf, name } = await loadAudio(found.ref)
    if (buf.length > MAX_AUDIO_BYTES) throw new Error("файл завеликий (макс. 4 МБ)")
    const form = new FormData()
    form.append("job_id", String(jobId))
    form.append("file", new Blob([buf]), name)
    const res = await fetch(`${CFG.ascoreUrl}/api/agent/voice`, {
      method: "POST",
      headers: { "X-Api-Key": CFG.apiKey },
      body: form,
      signal: AbortSignal.timeout(90_000),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status} ${(await res.text().catch(() => "")).slice(0, 200)}`)
    log(`задача ${jobId}: голосове надіслано (${Math.round(buf.length / 1024)} КБ)`)
    return text.replace(found.match, "").replace(/\n{3,}/g, "\n\n").trim()
  } catch (e) {
    log(`задача ${jobId}: голосове не надіслано: ${e?.message || e}`)
    return text // keep the text as is, nothing is lost
  }
}

// ── One job ──────────────────────────────────────────────────────

async function runJob(job) {
  const started = Date.now()
  log(`задача ${job.id}: старт`)

  const ctrl = new AbortController()
  let timedOut = false
  let cancelled = false
  const hardTimer = setTimeout(() => { timedOut = true; ctrl.abort() }, JOB_TIMEOUT_MS)

  let text = ""
  let sentText = ""
  let lastReport = Date.now()
  let busy = false

  const ticker = setInterval(async () => {
    if (busy) return
    const changed = text !== sentText
    if (!changed && Date.now() - lastReport < KEEPALIVE_MS) return
    busy = true
    const snapshot = text
    try {
      const stillWanted = await report(job.id, "progress", changed ? snapshot : null)
      lastReport = Date.now()
      if (changed) sentText = snapshot
      if (stillWanted === false) { cancelled = true; ctrl.abort() }
    } catch (e) {
      log(`progress: ${e.message}`)
    } finally {
      busy = false
    }
  }, PROGRESS_MS)

  let failure = null
  try {
    await askGateway(job.payload || {}, ctrl.signal, t => { text = t })
  } catch (e) {
    failure = timedOut ? "Агент не впорався за 30 хвилин." : (e?.message || String(e))
  } finally {
    clearInterval(ticker)
    clearTimeout(hardTimer)
  }

  const secs = Math.round((Date.now() - started) / 1000)
  if (cancelled) { log(`задача ${job.id}: скасована в AsCore (${secs} с)`); return }

  if (!failure) {
    text = await deliverVoice(job.id, text)
    await reportFinal(job.id, "done", text)
    log(`задача ${job.id}: готово за ${secs} с, ${text.length} символів`)
  } else if (text.trim()) {
    await reportFinal(job.id, "done", `${text}\n\n_(відповідь обірвалась: ${failure})_`)
    log(`задача ${job.id}: частково, ${failure}`)
  } else {
    await reportFinal(job.id, "error", failure)
    log(`задача ${job.id}: помилка: ${failure}`)
  }
}

// ── Main loop ────────────────────────────────────────────────────

async function main() {
  log(`AsCore конектор: старт (${CFG.supabaseUrl}, gateway ${CFG.gatewayUrl})`)
  let ready = false
  let backoff = POLL_MS

  for (;;) {
    try {
      const job = await claim()
      if (!ready) {
        ready = true
        log("ASCORE_CONNECTOR_READY: підключено до AsCore, чекаю на повідомлення")
      }
      backoff = POLL_MS
      if (job && job.id) {
        await runJob(job)
        continue
      }
    } catch (e) {
      if (e instanceof KeyRejected) {
        log(e.message)
        await sleep(60_000)
        continue
      }
      log(`зв'язок з AsCore: ${e.message}`)
      backoff = Math.min(backoff * 2, MAX_BACKOFF_MS)
    }
    await sleep(backoff)
  }
}

process.on("SIGTERM", () => process.exit(0))
process.on("SIGINT",  () => process.exit(0))

main()