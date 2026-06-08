// app/agents/[agentId]/page.tsx
"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import {
  ArrowLeft,
  MessageSquare,
  Trash2,
  Save,
  Plus,
  ChevronRight,
  Clock,
  Edit3,
  X,
  Check,
  AlertCircle,
} from "lucide-react"
import {
  agentStore,
  providerStore,
  chatStore,
  type Agent,
  type Provider,
  type ChatSession,
} from "@/lib/store"
import { AstroButton } from "@/components/ui/astro-button"
import { AVATAR_COLORS } from "../page"

// ─── Helpers ──────────────────────────────────────────────────────

function formatTime(iso: string): string {
  if (!iso) return ""
  const date = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  if (diffMin < 1) return "щойно"
  if (diffMin < 60) return `${diffMin} хв тому`
  if (diffHour < 24) return `${diffHour} год тому`
  if (diffDay === 1) return "вчора"
  if (diffDay < 7) return `${diffDay} дні тому`

  return date.toLocaleDateString("uk-UA", { day: "numeric", month: "short" })
}

// ─── Shared input style ───────────────────────────────────────────

const inputBase: React.CSSProperties = {
  backgroundColor: "#09090C",
  border: "0.5px solid #22222E",
  color: "#C8C8D8",
  outline: "none",
  width: "100%",
  padding: "8px 12px",
  borderRadius: "8px",
  fontSize: "13px",
}

function focusStyle(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
  e.currentTarget.style.borderColor = "rgba(232,0,42,0.4)"
}

function blurStyle(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
  e.currentTarget.style.borderColor = "#22222E"
}

// ─── Section wrapper ──────────────────────────────────────────────

function Section({
  title,
  children,
  action,
}: {
  title: string
  children: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        backgroundColor: "#0E0E14",
        border: "0.5px solid #1A1A24",
      }}
    >
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: "0.5px solid #1A1A24" }}
      >
        <span
          className="text-[10px] font-medium uppercase tracking-[0.08em]"
          style={{ color: "#444455" }}
        >
          {title}
        </span>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

// ─── Field label ──────────────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label
      className="block text-[10px] font-medium uppercase tracking-[0.07em] mb-1.5"
      style={{ color: "#444455" }}
    >
      {children}
    </label>
  )
}

// ─── Agent profile header ─────────────────────────────────────────

function AgentProfile({
  agent,
  provider,
  sessionCount,
  onNewChat,
}: {
  agent: Agent
  provider: Provider | undefined
  sessionCount: number
  onNewChat: () => void
}) {
  return (
    <div
      className="rounded-xl p-5"
      style={{
        backgroundColor: "#0E0E14",
        border: "0.5px solid #1A1A24",
      }}
    >
      <div className="flex items-start gap-4">
        {/* Large avatar */}
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center text-white font-medium text-2xl flex-shrink-0"
          style={{ backgroundColor: agent.avatarColor }}
        >
          {agent.name.charAt(0).toUpperCase()}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h1
            className="text-xl font-medium mb-1"
            style={{ color: "#C8C8D8" }}
          >
            {agent.name}
          </h1>
          {agent.description && (
            <p
              className="text-sm leading-relaxed mb-3"
              style={{ color: "#888899" }}
            >
              {agent.description}
            </p>
          )}

          {/* Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            {provider ? (
              <>
                <span
                  className="text-[11px] px-2 py-1 rounded-lg"
                  style={{
                    backgroundColor: "#111116",
                    color: "#888899",
                    border: "0.5px solid #1A1A24",
                  }}
                >
                  {provider.name}
                </span>
                <span
                  className="text-[11px] px-2 py-1 rounded-lg"
                  style={{
                    backgroundColor: "#111116",
                    color: "#444455",
                    border: "0.5px solid #1A1A24",
                  }}
                >
                  {provider.model}
                </span>
              </>
            ) : (
              <span
                className="text-[11px] px-2 py-1 rounded-lg flex items-center gap-1"
                style={{
                  backgroundColor: "rgba(232,0,42,0.06)",
                  color: "#FF4D6A",
                  border: "0.5px solid rgba(232,0,42,0.15)",
                }}
              >
                <AlertCircle size={10} />
                Провайдер не підключено
              </span>
            )}
            <span
              className="text-[11px] px-2 py-1 rounded-lg flex items-center gap-1"
              style={{
                backgroundColor: "#111116",
                color: "#444455",
                border: "0.5px solid #1A1A24",
              }}
            >
              <MessageSquare size={10} />
              {sessionCount} сесій
            </span>
          </div>
        </div>

        {/* New chat button */}
        <AstroButton onClick={onNewChat}>
          <Plus size={14} />
          Новий чат
        </AstroButton>
      </div>

      {/* System prompt preview (if exists) */}
      {agent.systemPrompt && (
        <div
          className="mt-4 px-3 py-2.5 rounded-lg"
          style={{
            backgroundColor: "#09090C",
            border: "0.5px solid #1A1A24",
          }}
        >
          <p
            className="text-[10px] font-medium uppercase tracking-[0.07em] mb-1"
            style={{ color: "#333344" }}
          >
            Системний промпт
          </p>
          <p
            className="text-xs leading-relaxed"
            style={{ color: "#444455", fontStyle: "italic" }}
          >
            "{agent.systemPrompt.slice(0, 200)}
            {agent.systemPrompt.length > 200 ? "..." : ""}"
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Edit form ────────────────────────────────────────────────────

function EditForm({
  agent,
  providers,
  onSaved,
  onCancel,
}: {
  agent: Agent
  providers: Provider[]
  onSaved: () => void
  onCancel: () => void
}) {
  const [name, setName] = useState(agent.name)
  const [description, setDescription] = useState(agent.description)
  const [providerId, setProviderId] = useState(agent.providerId)
  const [systemPrompt, setSystemPrompt] = useState(agent.systemPrompt)
  const [avatarColor, setAvatarColor] = useState(agent.avatarColor)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState("")

  function handleSave() {
    if (!name.trim()) {
      setError("Назва не може бути порожньою")
      return
    }

    agentStore.update(agent.id, {
      name: name.trim(),
      description: description.trim(),
      providerId,
      systemPrompt: systemPrompt.trim(),
      avatarColor,
    })

    setError("")
    setSaved(true)
    setTimeout(() => {
      setSaved(false)
      onSaved()
    }, 1200)
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Avatar color + live preview */}
      <div>
        <FieldLabel>Колір аватара</FieldLabel>
        <div className="flex gap-2 flex-wrap mb-3">
          {AVATAR_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => setAvatarColor(color)}
              className="w-7 h-7 rounded-lg transition-all"
              style={{
                backgroundColor: color,
                outline:
                  avatarColor === color
                    ? "2px solid white"
                    : "2px solid transparent",
                outlineOffset: "2px",
              }}
            />
          ))}
        </div>
        {/* Live preview */}
        <div
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg"
          style={{
            backgroundColor: "#09090C",
            border: "0.5px solid #1A1A24",
          }}
        >
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-medium text-sm flex-shrink-0"
            style={{ backgroundColor: avatarColor }}
          >
            {name ? name.charAt(0).toUpperCase() : "A"}
          </div>
          <span className="text-sm" style={{ color: "#888899" }}>
            {name || "Назва агента"}
          </span>
        </div>
      </div>

      {/* Name */}
      <div>
        <FieldLabel>Назва агента *</FieldLabel>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Назва агента"
          style={inputBase}
          onFocus={focusStyle}
          onBlur={blurStyle}
        />
      </div>

      {/* Description */}
      <div>
        <FieldLabel>Опис</FieldLabel>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Коротко — що вміє цей агент"
          style={inputBase}
          onFocus={focusStyle}
          onBlur={blurStyle}
        />
      </div>

      {/* Provider */}
      <div>
        <FieldLabel>Провайдер</FieldLabel>
        {providers.length === 0 ? (
          <div
            className="px-3 py-2.5 rounded-lg text-sm"
            style={{
              backgroundColor: "rgba(232,0,42,0.06)",
              border: "0.5px solid rgba(232,0,42,0.15)",
              color: "#FF4D6A",
            }}
          >
            Немає активних провайдерів. Додайте API ключ у{" "}
            <a href="/providers" style={{ textDecoration: "underline" }}>
              Провайдерах
            </a>
          </div>
        ) : (
          <select
            value={providerId}
            onChange={(e) => setProviderId(e.target.value)}
            style={{ ...inputBase, cursor: "pointer" }}
            onFocus={focusStyle}
            onBlur={blurStyle}
          >
            {providers.map((p) => (
              <option
                key={p.id}
                value={p.id}
                style={{ backgroundColor: "#111116" }}
              >
                {p.name} — {p.model}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* System prompt */}
      <div>
        <FieldLabel>Системний промпт</FieldLabel>
        <textarea
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          placeholder="Ти — досвідчений AI агент. Відповідаєш чітко, коротко і по суті..."
          rows={5}
          style={{
            ...inputBase,
            resize: "vertical",
            lineHeight: "1.6",
          }}
          onFocus={focusStyle}
          onBlur={blurStyle}
        />
        <p
          className="text-[10px] mt-1 leading-relaxed"
          style={{ color: "#333344" }}
        >
          Визначає особистість, стиль і правила поведінки агента.
          Зміни застосовуються до нових чат-сесій.
        </p>
      </div>

      {/* Error */}
      {error && (
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
          style={{
            backgroundColor: "rgba(232,0,42,0.08)",
            border: "0.5px solid rgba(232,0,42,0.2)",
            color: "#FF4D6A",
          }}
        >
          <AlertCircle size={12} />
          {error}
        </div>
      )}

      {/* Saved confirmation */}
      {saved && (
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
          style={{
            backgroundColor: "rgba(34,197,94,0.08)",
            border: "0.5px solid rgba(34,197,94,0.2)",
            color: "#22C55E",
          }}
        >
          <Check size={12} />
          Зміни збережено
        </div>
      )}

      {/* Buttons */}
      <div className="flex gap-2">
        <AstroButton
          variant="ghost"
          onClick={onCancel}
          className="flex-1"
        >
          <X size={13} />
          Скасувати
        </AstroButton>
        <AstroButton
          onClick={handleSave}
          className="flex-1"
        >
          <Save size={13} />
          Зберегти зміни
        </AstroButton>
      </div>
    </div>
  )
}

// ─── Related sessions list ────────────────────────────────────────

function SessionList({
  sessions,
  onOpen,
  onDelete,
}: {
  sessions: ChatSession[]
  onOpen: (id: string) => void
  onDelete: (id: string) => void
}) {
  if (sessions.length === 0) {
    return (
      <div className="py-6 text-center">
        <p className="text-sm" style={{ color: "#333344" }}>
          Чат-сесій ще немає
        </p>
        <p className="text-xs mt-1" style={{ color: "#222230" }}>
          Натисніть «Новий чат» вгорі, щоб розпочати
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {sessions.map((session) => {
        const lastMsg = session.messages[session.messages.length - 1]
        const preview = lastMsg
          ? (lastMsg.role === "user" ? "Ви: " : "AI: ") +
            lastMsg.content.slice(0, 80)
          : "Порожня сесія"
        const time = lastMsg?.createdAt ?? session.createdAt

        return (
          <div
            key={session.id}
            onClick={() => onOpen(session.id)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer group transition-all"
            style={{
              backgroundColor: "#09090C",
              border: "0.5px solid #1A1A24",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "#22222E"
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "#1A1A24"
            }}
          >
            <MessageSquare
              size={13}
              className="flex-shrink-0"
              style={{ color: "#333344" }}
            />
            <div className="flex-1 min-w-0">
              <p
                className="text-xs font-medium truncate"
                style={{ color: "#C8C8D8" }}
              >
                {session.title}
              </p>
              <p
                className="text-[11px] truncate mt-0.5"
                style={{ color: "#444455" }}
              >
                {preview}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span
                className="text-[10px] flex items-center gap-1"
                style={{ color: "#333344" }}
              >
                <Clock size={9} />
                {formatTime(time)}
              </span>
              <span
                className="text-[10px] px-1.5 py-0.5 rounded"
                style={{
                  backgroundColor: "#111116",
                  color: "#333344",
                  border: "0.5px solid #1A1A24",
                }}
              >
                {session.messages.length}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  const ok = window.confirm("Видалити цю сесію?")
                  if (ok) onDelete(session.id)
                }}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded"
                style={{ color: "#444455" }}
              >
                <Trash2 size={12} />
              </button>
              <ChevronRight
                size={12}
                className="opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ color: "#333344" }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Danger zone ──────────────────────────────────────────────────

function DangerZone({
  agentName,
  onDelete,
}: {
  agentName: string
  onDelete: () => void
}) {
  const [confirming, setConfirming] = useState(false)
  const [inputValue, setInputValue] = useState("")

  const isMatch = inputValue.trim() === agentName.trim()

  if (!confirming) {
    return (
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium" style={{ color: "#C8C8D8" }}>
            Видалити агента
          </p>
          <p className="text-xs mt-0.5" style={{ color: "#444455" }}>
            Агент буде видалений назавжди. Чат-сесії залишаться.
          </p>
        </div>
        <AstroButton
          variant="secondary"
          size="sm"
          onClick={() => setConfirming(true)}
        >
          <Trash2 size={12} />
          Видалити
        </AstroButton>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        className="px-3 py-2.5 rounded-lg"
        style={{
          backgroundColor: "rgba(232,0,42,0.06)",
          border: "0.5px solid rgba(232,0,42,0.2)",
        }}
      >
        <p className="text-xs mb-2" style={{ color: "#FF4D6A" }}>
          Для підтвердження введіть назву агента:
        </p>
        <p
          className="text-xs font-medium mb-2"
          style={{ color: "#C8C8D8" }}
        >
          {agentName}
        </p>
        <input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Введіть назву..."
          style={{
            ...inputBase,
            borderColor: isMatch
              ? "rgba(34,197,94,0.4)"
              : "rgba(232,0,42,0.3)",
          }}
          autoFocus
        />
      </div>
      <div className="flex gap-2">
        <AstroButton
          variant="ghost"
          size="sm"
          onClick={() => {
            setConfirming(false)
            setInputValue("")
          }}
          className="flex-1"
        >
          Скасувати
        </AstroButton>
        <AstroButton
          variant="secondary"
          size="sm"
          onClick={onDelete}
          disabled={!isMatch}
          className="flex-1"
        >
          <Trash2 size={12} />
          Підтвердити видалення
        </AstroButton>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────

export default function AgentDetailPage() {
  const params = useParams()
  const router = useRouter()
  const agentId = params.agentId as string

  const [agent, setAgent] = useState<Agent | null>(null)
  const [provider, setProvider] = useState<Provider | undefined>(undefined)
  const [allProviders, setAllProviders] = useState<Provider[]>([])
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [isEditing, setIsEditing] = useState(false)
  const [notFound, setNotFound] = useState(false)

  const loadData = useCallback(() => {
    const found = agentStore.getById(agentId)
    if (!found) {
      setNotFound(true)
      return
    }
    setAgent(found)
    setProvider(providerStore.getById(found.providerId))
    setAllProviders(providerStore.getAll())
    setSessions(
      chatStore.getAll().filter((s) => s.agentId === agentId)
    )
  }, [agentId])

  useEffect(() => {
    loadData()
  }, [loadData])

  function handleNewChat() {
    if (!agent) return
    const session = chatStore.create(agent.id, `Чат з ${agent.name}`)
    router.push(`/chat/${session.id}`)
  }

  function handleSaved() {
    setIsEditing(false)
    loadData()
  }

  function handleDeleteSession(sessionId: string) {
    chatStore.remove(sessionId)
    loadData()
  }

  function handleDeleteAgent() {
    if (!agent) return
    agentStore.remove(agent.id)
    router.push("/agents")
  }

  // ── Not found state ──
  if (notFound) {
    return (
      <div className="p-5 max-w-2xl">
        <div
          className="flex flex-col items-center justify-center py-16 rounded-xl text-center"
          style={{ border: "0.5px dashed #1A1A24" }}
        >
          <p className="text-sm mb-1" style={{ color: "#C8C8D8" }}>
            Агента не знайдено
          </p>
          <p className="text-xs mb-4" style={{ color: "#444455" }}>
            Можливо, він був видалений
          </p>
          <AstroButton
            variant="secondary"
            onClick={() => router.push("/agents")}
          >
            <ArrowLeft size={13} />
            Повернутись до агентів
          </AstroButton>
        </div>
      </div>
    )
  }

  // ── Loading state ──
  if (!agent) {
    return (
      <div className="p-5">
        <div className="animate-pulse flex flex-col gap-4">
          <div
            className="h-24 rounded-xl"
            style={{ backgroundColor: "#0E0E14" }}
          />
          <div
            className="h-48 rounded-xl"
            style={{ backgroundColor: "#0E0E14" }}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="p-5 max-w-2xl">
      {/* Back navigation */}
      <button
        onClick={() => router.push("/agents")}
        className="flex items-center gap-1.5 mb-5 text-sm transition-opacity opacity-60 hover:opacity-100"
        style={{ color: "#888899" }}
      >
        <ArrowLeft size={14} />
        Всі агенти
      </button>

      <div className="flex flex-col gap-4">
        {/* Profile header */}
        <AgentProfile
          agent={agent}
          provider={provider}
          sessionCount={sessions.length}
          onNewChat={handleNewChat}
        />

        {/* Edit section */}
        <Section
          title="Налаштування агента"
          action={
            !isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-1 text-[11px] transition-opacity opacity-60 hover:opacity-100"
                style={{ color: "#E8002A" }}
              >
                <Edit3 size={11} />
                Редагувати
              </button>
            ) : undefined
          }
        >
          {isEditing ? (
            <EditForm
              agent={agent}
              providers={allProviders}
              onSaved={handleSaved}
              onCancel={() => setIsEditing(false)}
            />
          ) : (
            /* Read-only view */
            <div className="flex flex-col gap-3">
              <Row label="Назва" value={agent.name} />
              <Row
                label="Опис"
                value={agent.description || "—"}
              />
              <Row
                label="Провайдер"
                value={provider ? `${provider.name} — ${provider.model}` : "Не знайдено"}
              />
              <div>
                <p
                  className="text-[10px] font-medium uppercase tracking-[0.07em] mb-1"
                  style={{ color: "#333344" }}
                >
                  Колір аватара
                </p>
                <div className="flex items-center gap-2">
                  <div
                    className="w-5 h-5 rounded"
                    style={{ backgroundColor: agent.avatarColor }}
                  />
                  <span className="text-xs" style={{ color: "#888899" }}>
                    {agent.avatarColor}
                  </span>
                </div>
              </div>
              {agent.systemPrompt && (
                <div>
                  <p
                    className="text-[10px] font-medium uppercase tracking-[0.07em] mb-1"
                    style={{ color: "#333344" }}
                  >
                    Системний промпт
                  </p>
                  <div
                    className="px-3 py-2.5 rounded-lg"
                    style={{
                      backgroundColor: "#09090C",
                      border: "0.5px solid #1A1A24",
                    }}
                  >
                    <p
                      className="text-xs leading-relaxed whitespace-pre-wrap"
                      style={{ color: "#888899" }}
                    >
                      {agent.systemPrompt}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </Section>

        {/* Chat sessions */}
        <Section
          title={`Чат-сесії (${sessions.length})`}
          action={
            <AstroButton onClick={handleNewChat}>
              <Plus size={11} />
              Новий чат
            </AstroButton>
          }
        >
          <SessionList
            sessions={sessions}
            onOpen={(id) => router.push(`/chat/${id}`)}
            onDelete={handleDeleteSession}
          />
        </Section>

        {/* Danger zone */}
        <Section title="Небезпечна зона">
          <DangerZone
            agentName={agent.name}
            onDelete={handleDeleteAgent}
          />
        </Section>
      </div>
    </div>
  )
}

// ─── Small read-only row ──────────────────────────────────────────

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p
        className="text-[10px] font-medium uppercase tracking-[0.07em] mb-0.5"
        style={{ color: "#333344" }}
      >
        {label}
      </p>
      <p className="text-sm" style={{ color: "#888899" }}>
        {value}
      </p>
    </div>
  )
}