"use client"

import { Check, Globe, Image, FileText, Download, Brain, BookOpen } from "lucide-react"

const T = {
  t1: "#F0EDF8", t2: "#C8C4D8", t3: "#A8A4BC", t4: "#585878",
  red: "#E8002A", green: "#22C55E",
  b1: "rgba(255,255,255,0.10)", s1: "#11111C",
}

type Tool = { icon: React.ElementType; label: string; enabled: boolean; badge?: string }

const TOOLS: Tool[] = [
  { icon: Brain,    label: "Memory",             enabled: true  },
  { icon: BookOpen, label: "Vault",              enabled: true  },
  { icon: FileText, label: "File Reader",        enabled: true  },
  { icon: Globe,    label: "Web Search",         enabled: false, badge: "незабаром" },
  { icon: Image,    label: "Image Generator",    enabled: false, badge: "незабаром" },
  { icon: Download, label: "Export Report",      enabled: false, badge: "незабаром" },
]

export function AgentTools() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {TOOLS.map(({ icon: Icon, label, enabled, badge }) => (
        <div key={label} style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "8px 10px", borderRadius: 9,
          background: enabled ? "rgba(34,197,94,0.06)" : "rgba(255,255,255,0.025)",
          border: `0.5px solid ${enabled ? "rgba(34,197,94,0.18)" : "rgba(255,255,255,0.06)"}`,
          opacity: enabled ? 1 : 0.55,
        }}>
          <div style={{
            width: 26, height: 26, borderRadius: 7, flexShrink: 0,
            background: enabled ? "rgba(34,197,94,0.12)" : "rgba(255,255,255,0.04)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <Icon size={13} style={{ color: enabled ? T.green : T.t4 }} />
          </div>
          <span style={{ flex: 1, fontSize: 12.5, color: enabled ? T.t2 : T.t4 }}>{label}</span>
          {enabled ? (
            <Check size={12} style={{ color: T.green, flexShrink: 0 }} />
          ) : badge ? (
            <span style={{
              fontSize: 9.5, padding: "1px 6px", borderRadius: 4,
              background: "rgba(255,255,255,0.04)", color: T.t4,
              border: "0.5px solid rgba(255,255,255,0.07)",
            }}>{badge}</span>
          ) : null}
        </div>
      ))}
    </div>
  )
}