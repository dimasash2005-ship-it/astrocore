// Куди: components/landing/Landing.tsx
"use client"

import { useEffect, useRef } from "react"
import { LANDING_HTML } from "./landingHtml"
import { initLanding } from "./landingScript"
import { initGuides } from "./landingGuides"
import "./landing.css"
import "./landingGuides.css"

export default function Landing() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ref.current) return
    const stop = initLanding(ref.current)
    const stopGuides = initGuides(ref.current)
    return () => { stop(); stopGuides() }
  }, [])

  return <div ref={ref} className="ac-landing" dangerouslySetInnerHTML={{ __html: LANDING_HTML }} />
}