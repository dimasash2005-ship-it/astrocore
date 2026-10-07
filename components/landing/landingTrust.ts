// "Verified safe on ClawHub" badge for the landing page.
// Standalone: adds one small link under the hero buttons and follows the EN/UA switch.

const AUDIT_URL =
  "https://clawhub.ai/dimasash2005-ship-it/skills/astrocore/security-audit?version=1.0.3"

const TEXT = {
  en: { label: "Verified safe on ClawHub", sub: "Security audit of our OpenClaw skill" },
  uk: { label: "Перевірено на ClawHub: безпечно", sub: "Аудит безпеки нашого скіла для OpenClaw" },
}

export function initTrust(root: HTMLElement): () => void {
  const anchor = root.querySelector(".hero .ctas") || root.querySelector("#security .wrap")
  if (!anchor) return () => {}

  const a = document.createElement("a")
  a.className = "tr-badge"
  a.href = AUDIT_URL
  a.target = "_blank"
  a.rel = "noopener noreferrer"
  a.innerHTML =
    '<span class="tr-ic" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/></svg></span>' +
    '<span class="tr-tx"><b></b><small></small></span><span class="tr-ar" aria-hidden="true">↗</span>'

  if (anchor.classList.contains("ctas")) anchor.insertAdjacentElement("afterend", a)
  else anchor.appendChild(a)

  function lang(): "en" | "uk" {
    const uk = root.querySelector("#lang-uk")
    return uk && uk.getAttribute("aria-pressed") === "true" ? "uk" : "en"
  }
  function render() {
    const t = TEXT[lang()]
    ;(a.querySelector("b") as HTMLElement).textContent = t.label
    ;(a.querySelector("small") as HTMLElement).textContent = t.sub
  }
  render()

  const onLang = () => setTimeout(render, 0)
  const btns = [root.querySelector("#lang-en"), root.querySelector("#lang-uk")].filter(Boolean) as Element[]
  btns.forEach((b) => b.addEventListener("click", onLang))

  return () => {
    btns.forEach((b) => b.removeEventListener("click", onLang))
    a.remove()
  }
}