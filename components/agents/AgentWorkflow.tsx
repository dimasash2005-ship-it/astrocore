"use client"

import { ArrowDown } from "lucide-react"

const T = { t1: "#F0EDF8", t2: "#C8C4D8", t3: "#A8A4BC", t4: "#585878", red: "#E8002A" }

type WorkflowStep = { step: number; label: string; optional?: boolean }

const DEFAULT_WORKFLOW: WorkflowStep[] = [
  { step: 1, label: "Отримую задачу"           },
  { step: 2, label: "Збираю контекст"          },
  { step: 3, label: "Аналізую і планую"        },
  { step: 4, label: "Генерую результат"        },
  { step: 5, label: "Зберігаю у Vault", optional: true },
]

function getWorkflow(agentName: string): WorkflowStep[] {
  const n = (agentName ?? "").toLowerCase()
  if (n.includes("seo")) return [
    { step: 1, label: "Отримую URL або завдання"  },
    { step: 2, label: "Аудит / збір ключів"       },
    { step: 3, label: "Аналіз конкурентів"        },
    { step: 4, label: "Генерую рекомендації"      },
    { step: 5, label: "Зберігаю у Vault", optional: true },
  ]
  if (n.includes("smm")) return [
    { step: 1, label: "Отримую нішу і платформу"  },
    { step: 2, label: "Аналізую аудиторію"        },
    { step: 3, label: "Генерую контент-план"      },
    { step: 4, label: "Пишу тексти / хуки"        },
    { step: 5, label: "Зберігаю у Vault", optional: true },
  ]
  if (n.includes("sales")) return [
    { step: 1, label: "Отримую продукт і ЦА"      },
    { step: 2, label: "Визначаю болі клієнтів"    },
    { step: 3, label: "Будую скрипт / pitch"      },
    { step: 4, label: "Обробляю заперечення"      },
    { step: 5, label: "Зберігаю у Vault", optional: true },
  ]
  if (n.includes("affiliate")) return [
    { step: 1, label: "Отримую офер і вертикаль"  },
    { step: 2, label: "GEO та джерела трафіку"    },
    { step: 3, label: "Будую воронку"             },
    { step: 4, label: "Стратегія монетизації"     },
    { step: 5, label: "Зберігаю у Vault", optional: true },
  ]
  return DEFAULT_WORKFLOW
}

export function AgentWorkflow({ agentName }: { agentName: string }) {
  const steps = getWorkflow(agentName)
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 0 }}>
      {steps.map((s, i) => (
        <div key={s.step} style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
              background: i === 0
                ? "rgba(232,0,42,0.18)"
                : s.optional ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.07)",
              border: `0.5px solid ${i === 0 ? "rgba(232,0,42,0.35)" : "rgba(255,255,255,0.10)"}`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 10.5, fontWeight: 700,
              color: i === 0 ? T.red : T.t4,
            }}>
              {s.step}
            </div>
            <span style={{
              fontSize: 12.5, color: s.optional ? T.t4 : T.t2,
              fontStyle: s.optional ? "italic" : "normal",
            }}>
              {s.label}
              {s.optional && <span style={{ fontSize: 10, color: T.t4, marginLeft: 5 }}>(опційно)</span>}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div style={{ marginLeft: 13, marginTop: 2, marginBottom: 2 }}>
              <ArrowDown size={10} style={{ color: "#252540" }} />
            </div>
          )}
        </div>
      ))}
    </div>
  )
}