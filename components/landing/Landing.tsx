"use client"

import { useEffect, useRef } from "react"
import { LANDING_HTML } from "./landingHtml"
import { initLanding } from "./landingScript"
import { initGuides } from "./landingGuides"
import { initTrust } from "./landingTrust"
import { initCosmos } from "./landingCosmos"
import "./landing.css"
import "./landingGuides.css"
import "./landingTrust.css"
import "./landingCosmos.css"

export default function Landing() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ref.current) return
    const stop = initLanding(ref.current)
    const stopGuides = initGuides(ref.current)
    const stopTrust = initTrust(ref.current)
    const stopCosmos = initCosmos(ref.current)
    return () => { stop(); stopGuides(); stopTrust(); stopCosmos() }
  }, [])

  return <div ref={ref} className="ac-landing" dangerouslySetInnerHTML={{ __html: LANDING_HTML }} />
}