"use client"

import { useState } from "react"
import { Plus, FileText, BookOpen, X, Upload } from "lucide-react"

const T = {
  t1: "#F0EDF8", t2: "#C8C4D8", t3: "#A8A4BC", t4: "#585878",
  red: "#E8002A",
}

type KnowledgeItem = { id: string; name: string; type: string }

export function AgentKnowledge({ systemPrompt }: { systemPrompt?: string }) {
  const [items, setItems] = useState<KnowledgeItem[]>(
    systemPrompt ? [{ id: "prompt", name: "Системний промпт", type: "prompt" }] : []
  )

  function remove(id: string) { setItems(prev => prev.filter(i => i.id !== id)) }

  function pickFile() {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = ".pdf,.docx,.md,.txt"
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) return
      setItems(prev => [...prev, { id: crypto.randomUUID(), name: file.name, type: file.name.split(".").pop() ?? "file" }])
    }
    input.click()
  }

  const typeIcon = (type: string) => {
    if (type === "prompt") return <BookOpen size={12} style={{ color: "#8B5CF6" }} />
    return <FileText size={12} style={{ color: "#4285F4" }} />
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {items.length === 0 ? (
        <div style={{ padding: "20px 0", textAlign: "center" }}>
          <BookOpen size={20} style={{ color: "#252540", margin: "0 auto 8px" }} />
          <div style={{ fontSize: 12, color: T.t4, marginBottom: 10 }}>Знань не прикріплено</div>
        </div>
      ) : (
        items.map(item => (
          <div key={item.id} style={{
            display: "flex", alignItems: "center", gap: 9, padding: "7px 10px", borderRadius: 8,
            background: "rgba(255,255,255,0.03)", border: "0.5px solid rgba(255,255,255,0.07)",
          }}>
            {typeIcon(item.type)}
            <span style={{ flex: 1, fontSize: 12, color: T.t2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {item.name}
            </span>
            <span style={{ fontSize: 10, color: T.t4, padding: "1px 5px", borderRadius: 4, background: "rgba(255,255,255,0.04)" }}>
              .{item.type}
            </span>
            {item.id !== "prompt" && (
              <button onClick={() => remove(item.id)} style={{ background: "none", border: "none", cursor: "pointer", color: T.t4, lineHeight: 0, padding: 2 }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "#FF4D6A" }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = T.t4 }}>
                <X size={11} />
              </button>
            )}
          </div>
        ))
      )}
      <button onClick={pickFile} style={{
        display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
        padding: "8px", borderRadius: 8, cursor: "pointer",
        background: "rgba(255,255,255,0.04)", border: "0.5px solid rgba(255,255,255,0.09)",
        color: T.t3, fontSize: 12,
        transition: "background 120ms ease",
      }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(232,0,42,0.08)" }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)" }}>
        <Upload size={13} style={{ color: T.red, opacity: 0.7 }} />
        Прикріпити знання
      </button>
    </div>
  )
}