// @ts-nocheck
import {
  App,
  Editor,
  MarkdownView,
  Modal,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
} from "obsidian"

// ─── Settings ──────────────────────────────────────────────────────

interface AstroCoreSettings {
  apiUrl: string
  apiKey: string
}

const DEFAULT_SETTINGS: AstroCoreSettings = {
  apiUrl: "http://localhost:3000/api/integrations/obsidian/chat",
  apiKey: "",
}

// Where the browser-based "Connect AstroCore" consent screen lives.
// NOTE: this currently points at the local dev server. Update this
// (or make it configurable) once AstroCore has a production domain.
const CONNECT_URL = "http://localhost:3002/connect/obsidian"
const CONNECT_PROTOCOL_ACTION = "astrocore-connect"

// ─── API client ────────────────────────────────────────────────────

interface AstroCoreRequestPayload {
  prompt: string
  noteTitle?: string
  selectedText?: string
  fullNote?: string
}

interface AstroCoreResponse {
  reply?: string
  error?: string
}

async function callAstroCore(
  settings: AstroCoreSettings,
  payload: AstroCoreRequestPayload
): Promise<string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (settings.apiKey) headers["Authorization"] = `Bearer ${settings.apiKey}`

  const res = await fetch(settings.apiUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  })

  let data: AstroCoreResponse
  try {
    data = (await res.json()) as AstroCoreResponse
  } catch {
    throw new Error(`AstroCore повернув некоректну відповідь (status ${res.status}).`)
  }

  if (!res.ok || data.error) {
    throw new Error(data.error ?? `Помилка AstroCore (status ${res.status}).`)
  }
  if (!data.reply) {
    throw new Error("AstroCore не повернув відповідь.")
  }
  return data.reply
}

// ─── "Obsidian → AstroCore" note sending ──────────────────────────
// Reuses the same host as apiUrl (…/obsidian/chat) but targets the
// notes endpoint (…/obsidian/notes) so there's no extra setting to
// configure — one API URL still drives both directions.

interface AstroCoreNotePayload {
  title: string
  content: string
  path?: string
}

function notesUrlFrom(apiUrl: string): string {
  return apiUrl.replace(/\/chat\/?$/, "/notes")
}

async function sendNoteToAstroCore(
  settings: AstroCoreSettings,
  payload: AstroCoreNotePayload
): Promise<void> {
  if (!settings.apiKey) {
    throw new Error("Спочатку підключи AstroCore (Connect AstroCore в налаштуваннях).")
  }

  const url = notesUrlFrom(settings.apiUrl)
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify(payload),
  })

  let data: { error?: string } = {}
  try {
    data = await res.json()
  } catch {
    // ignore — fall through to status-based error below
  }

  if (!res.ok) {
    throw new Error(data.error || `Помилка AstroCore (status ${res.status}).`)
  }
}


function randomState(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function maskKey(key: string): string {
  if (!key) return ""
  if (key.length <= 10) return "•".repeat(key.length)
  return `${key.slice(0, 10)}${"•".repeat(10)}`
}

// ─── Prompt modal ─────────────────────────────────────────────────

class PromptModal extends Modal {
  private value = ""
  private onSubmit: (value: string) => void

  constructor(app: App, onSubmit: (value: string) => void) {
    super(app)
    this.onSubmit = onSubmit
  }

  onOpen() {
    const { contentEl } = this
    contentEl.createEl("h2", { text: "Запитати AstroCore" })

    const inputEl = contentEl.createEl("textarea", {
      attr: { rows: "5", placeholder: "Напишіть запит до AstroCore..." },
    })
    inputEl.style.width = "100%"
    inputEl.style.marginBottom = "12px"
    inputEl.focus()

    inputEl.addEventListener("input", () => {
      this.value = inputEl.value
    })

    inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        this.submit()
      }
    })

    const buttonRow = contentEl.createEl("div")
    buttonRow.style.display = "flex"
    buttonRow.style.justifyContent = "flex-end"
    buttonRow.style.gap = "8px"

    const submitBtn = buttonRow.createEl("button", { text: "Надіслати" })
    submitBtn.addEventListener("click", () => this.submit())

    const cancelBtn = buttonRow.createEl("button", { text: "Скасувати" })
    cancelBtn.addEventListener("click", () => this.close())
  }

  private submit() {
    if (!this.value.trim()) {
      new Notice("Введіть запит перед надсиланням.")
      return
    }
    this.close()
    this.onSubmit(this.value.trim())
  }

  onClose() {
    this.contentEl.empty()
  }
}

// ─── Plugin ────────────────────────────────────────────────────────

type ConnectStage = "idle" | "authorizing" | "connected"

export default class AstroCorePlugin extends Plugin {
  settings: AstroCoreSettings = DEFAULT_SETTINGS

  // In-memory only — not persisted. "authorizing" resets to idle on
  // reload; if that happens mid-flow the user just clicks Connect again.
  connectStage: ConnectStage = "idle"
  private pendingState: string | null = null
  private settingTab: AstroCoreSettingTab | null = null

  async onload() {
    await this.loadSettings()
    this.connectStage = this.settings.apiKey ? "connected" : "idle"

    this.settingTab = new AstroCoreSettingTab(this.app, this)
    this.addSettingTab(this.settingTab)

    this.registerObsidianProtocolHandler(CONNECT_PROTOCOL_ACTION, async (params) => {
      await this.handleConnectCallback(params)
    })

    this.addCommand({
      id: "astrocore-ask",
      name: "Ask AstroCore",
      editorCallback: (editor: Editor, view: MarkdownView) => {
        new PromptModal(this.app, async (prompt) => {
          const notice = new Notice("AstroCore думає...", 0)
          try {
            const reply = await callAstroCore(this.settings, {
              prompt,
              noteTitle: view.file?.basename,
            })
            editor.replaceSelection(`\n${reply}\n`)
          } catch (err) {
            new Notice(`AstroCore: ${(err as Error).message}`)
          } finally {
            notice.hide()
          }
        }).open()
      },
    })

    this.addCommand({
      id: "astrocore-summarize-note",
      name: "Summarize current note",
      editorCallback: async (editor: Editor, view: MarkdownView) => {
        const fullNote = editor.getValue()
        if (!fullNote.trim()) {
          new Notice("Нотатка порожня — немає що підсумувати.")
          return
        }
        const notice = new Notice("AstroCore аналізує нотатку...", 0)
        try {
          const reply = await callAstroCore(this.settings, {
            prompt: "Зроби короткий, структурований підсумок цієї нотатки.",
            noteTitle: view.file?.basename,
            fullNote,
          })
          editor.setValue(`${fullNote}\n\n---\n\n**AstroCore — Підсумок:**\n\n${reply}\n`)
        } catch (err) {
          new Notice(`AstroCore: ${(err as Error).message}`)
        } finally {
          notice.hide()
        }
      },
    })

    this.addCommand({
      id: "astrocore-rewrite-selection",
      name: "Rewrite selection with AstroCore",
      editorCallback: async (editor: Editor, view: MarkdownView) => {
        const selectedText = editor.getSelection()
        if (!selectedText.trim()) {
          new Notice("Виділіть текст для переписування.")
          return
        }
        const notice = new Notice("AstroCore переписує текст...", 0)
        try {
          const reply = await callAstroCore(this.settings, {
            prompt: "Перепиши цей текст краще, зберігаючи зміст. Поверни тільки переписаний текст без пояснень.",
            noteTitle: view.file?.basename,
            selectedText,
          })
          editor.replaceSelection(reply)
        } catch (err) {
          new Notice(`AstroCore: ${(err as Error).message}`)
        } finally {
          notice.hide()
        }
      },
    })

    this.addCommand({
      id: "astrocore-explain-selection",
      name: "Explain selection",
      editorCallback: async (editor: Editor, view: MarkdownView) => {
        const selectedText = editor.getSelection()
        if (!selectedText.trim()) {
          new Notice("Виділіть текст для пояснення.")
          return
        }
        const notice = new Notice("AstroCore готує пояснення...", 0)
        try {
          const reply = await callAstroCore(this.settings, {
            prompt: "Поясни цей текст зрозуміло і стисло.",
            noteTitle: view.file?.basename,
            selectedText,
          })
          const cursor = editor.getCursor("to")
          editor.replaceRange(
            `\n\n> **AstroCore — Пояснення:**\n> ${reply.replace(/\n/g, "\n> ")}\n`,
            cursor
          )
        } catch (err) {
          new Notice(`AstroCore: ${(err as Error).message}`)
        } finally {
          notice.hide()
        }
      },
    })

    this.addCommand({
      id: "astrocore-send-note",
      name: "Send current note to AstroCore",
      editorCallback: async (editor: Editor, view: MarkdownView) => {
        const content = editor.getValue()
        if (!content.trim()) {
          new Notice("Нотатка порожня — немає що надсилати.")
          return
        }
        const notice = new Notice("Надсилаємо нотатку в AstroCore...", 0)
        try {
          await sendNoteToAstroCore(this.settings, {
            title: view.file?.basename ?? "Без назви",
            content,
            path: view.file?.path,
          })
          new Notice("Нотатку надіслано в AstroCore ✅")
        } catch (err) {
          new Notice(`AstroCore: ${(err as Error).message}`)
        } finally {
          notice.hide()
        }
      },
    })

    this.addCommand({
      id: "astrocore-send-selection",
      name: "Save selected text to AstroCore",
      editorCallback: async (editor: Editor, view: MarkdownView) => {
        const selectedText = editor.getSelection()
        if (!selectedText.trim()) {
          new Notice("Виділіть текст для надсилання.")
          return
        }
        const notice = new Notice("Надсилаємо виділення в AstroCore...", 0)
        try {
          await sendNoteToAstroCore(this.settings, {
            title: view.file?.basename ? `${view.file.basename} (виділення)` : "Виділений текст",
            content: selectedText,
            path: view.file?.path,
          })
          new Notice("Текст надіслано в AstroCore ✅")
        } catch (err) {
          new Notice(`AstroCore: ${(err as Error).message}`)
        } finally {
          notice.hide()
        }
      },
    })
  }

  onunload() {}

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData())
  }

  async saveSettings() {
    await this.saveData(this.settings)
  }

  private refreshSettingsTab() {
    // Only redraws if the settings tab is currently the open/rendered one;
    // harmless no-op otherwise.
    this.settingTab?.display()
  }

  // ── Connect AstroCore flow ──

  startConnect() {
    const state = randomState()
    this.pendingState = state
    this.connectStage = "authorizing"
    this.refreshSettingsTab()

    const obsidianCallback = `obsidian://${CONNECT_PROTOCOL_ACTION}`
    const url = `${CONNECT_URL}?callback=${encodeURIComponent(obsidianCallback)}&state=${encodeURIComponent(state)}`

    window.open(url)
  }

  cancelConnect() {
    this.pendingState = null
    this.connectStage = this.settings.apiKey ? "connected" : "idle"
    this.refreshSettingsTab()
  }

  async disconnect() {
    this.settings.apiKey = ""
    await this.saveSettings()
    this.connectStage = "idle"
    this.refreshSettingsTab()
    new Notice("AstroCore відключено.")
  }

  private async handleConnectCallback(params: Record<string, string>) {
    const { token, status, state } = params

    if (this.pendingState && state && state !== this.pendingState) {
      new Notice("AstroCore: запит підключення недійсний або прострочений. Спробуй ще раз.")
      this.connectStage = this.settings.apiKey ? "connected" : "idle"
      this.pendingState = null
      this.refreshSettingsTab()
      return
    }

    if (status === "success" && token) {
      this.settings.apiKey = token
      await this.saveSettings()
      this.connectStage = "connected"
      new Notice("AstroCore підключено ✅")
    } else {
      this.connectStage = this.settings.apiKey ? "connected" : "idle"
      new Notice("AstroCore: підключення не вдалося.")
    }

    this.pendingState = null
    this.refreshSettingsTab()
  }
}

// ─── Settings tab ──────────────────────────────────────────────────

class AstroCoreSettingTab extends PluginSettingTab {
  plugin: AstroCorePlugin
  private advancedOpen = false

  constructor(app: App, plugin: AstroCorePlugin) {
    super(app, plugin)
    this.plugin = plugin
  }

  display(): void {
    const { containerEl } = this
    containerEl.empty()

    containerEl.createEl("h2", { text: "AstroCore AI" })

    this.renderConnectSection(containerEl)
    this.renderAdvancedSection(containerEl)
  }

  private renderConnectSection(containerEl: HTMLElement) {
    const stage = this.plugin.connectStage

    const wrap = containerEl.createDiv()
    wrap.style.padding = "14px 16px"
    wrap.style.borderRadius = "8px"
    wrap.style.marginBottom = "18px"
    wrap.style.background = "var(--background-secondary)"
    wrap.style.display = "flex"
    wrap.style.alignItems = "center"
    wrap.style.justifyContent = "space-between"
    wrap.style.gap = "12px"

    const left = wrap.createDiv()
    const statusLine = left.createDiv()
    statusLine.style.fontSize = "13px"
    statusLine.style.fontWeight = "600"

    const subLine = left.createDiv()
    subLine.style.fontSize = "12px"
    subLine.style.color = "var(--text-muted)"
    subLine.style.marginTop = "2px"

    const right = wrap.createDiv()

    if (stage === "connected") {
      statusLine.setText("Connected ✅")
      subLine.setText(`Ключ: ${maskKey(this.plugin.settings.apiKey)}`)
      const btn = right.createEl("button", { text: "Disconnect" })
      btn.addEventListener("click", async () => {
        await this.plugin.disconnect()
      })
    } else if (stage === "authorizing") {
      statusLine.setText("Authorizing…")
      subLine.setText("Завершіть підключення у вкладці браузера, що відкрилась.")
      const btn = right.createEl("button", { text: "Скасувати" })
      btn.addEventListener("click", () => {
        this.plugin.cancelConnect()
      })
    } else {
      statusLine.setText("Not connected")
      subLine.setText("Підключи AstroCore в один клік — без API ключів вручну.")
      const btn = right.createEl("button", { text: "Connect AstroCore" })
      btn.classList.add("mod-cta")
      btn.addEventListener("click", () => {
        this.plugin.startConnect()
      })
    }
  }

  private renderAdvancedSection(containerEl: HTMLElement) {
    const details = containerEl.createEl("details")
    details.open = this.advancedOpen
    details.addEventListener("toggle", () => {
      this.advancedOpen = details.open
    })

    const summary = details.createEl("summary", { text: "Advanced: API Key" })
    summary.style.cursor = "pointer"
    summary.style.fontSize = "13px"
    summary.style.fontWeight = "600"
    summary.style.margin = "8px 0"

    const note = details.createEl("p", {
      text: "Для більшості людей це не потрібно — використовуй кнопку Connect AstroCore вище. Це поле — для ручного налаштування або дебагу.",
    })
    note.style.fontSize = "12px"
    note.style.color = "var(--text-muted)"

    new Setting(details)
      .setName("AstroCore API URL")
      .setDesc("URL ендпоінта для Obsidian-інтеграції AstroCore.")
      .addText((text) =>
        text
          .setPlaceholder(DEFAULT_SETTINGS.apiUrl)
          .setValue(this.plugin.settings.apiUrl)
          .onChange(async (value) => {
            this.plugin.settings.apiUrl = value.trim() || DEFAULT_SETTINGS.apiUrl
            await this.plugin.saveSettings()
          })
      )

    new Setting(details)
      .setName("API Key")
      .setDesc("Ручний API ключ (ac_live_...). Заповнюється автоматично після Connect AstroCore.")
      .addText((text) =>
        text
          .setPlaceholder("ac_live_...")
          .setValue(this.plugin.settings.apiKey)
          .onChange(async (value) => {
            this.plugin.settings.apiKey = value.trim()
            await this.plugin.saveSettings()
            this.plugin.connectStage = this.plugin.settings.apiKey ? "connected" : "idle"
          })
      )
  }
}