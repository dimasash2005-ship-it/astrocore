"use client"

// Password screen of a client portal.

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Lock, Loader2 } from "lucide-react"

export default function PortalGate({ slug, lang }: { slug: string; lang: "uk" | "en" }) {
  const router = useRouter()
  const [pw, setPw] = useState("")
  const [busy, setBusy] = useState(false)
  const [bad, setBad] = useState(false)
  const uk = lang === "uk"

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!pw.trim() || busy) return
    setBusy(true); setBad(false)
    const r = await fetch(`/api/c/${slug}/unlock`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: pw }) }).catch(() => null)
    setBusy(false)
    if (r?.ok) router.refresh()
    else setBad(true)
  }

  return (
    <form className="cp-gate" onSubmit={submit}>
      <span className="cp-gate-ic"><Lock size={18} /></span>
      <b>{uk ? "Кабінет захищено паролем" : "This portal is password-protected"}</b>
      <small>{uk ? "Пароль вам надіслала ваша агенція." : "Your agency sent you the password."}</small>
      <input type="password" value={pw} onChange={e => setPw(e.target.value)} placeholder={uk ? "Пароль" : "Password"} autoFocus autoComplete="current-password" />
      {bad && <em>{uk ? "Неправильний пароль" : "Wrong password"}</em>}
      <button type="submit" disabled={busy || !pw.trim()}>{busy ? <Loader2 size={15} className="cp-spin" /> : null}{uk ? "Відкрити" : "Open"}</button>
    </form>
  )
}
