// Куди: components/landing/Landing.tsx
"use client"

import { useEffect, useRef } from "react"
import { LANDING_HTML } from "./landingHtml"
import { initLanding } from "./landingScript"
import "./landing.css"

export default function Landing() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ref.current) return
    const stop = initLanding(ref.current)
    return stop
  }, [])

  return <div ref={ref} className="ac-landing" dangerouslySetInnerHTML={{ __html: LANDING_HTML }} />
}