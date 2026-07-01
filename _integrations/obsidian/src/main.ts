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

export default class AstroCorePlugin extends Plugin {
  settings: AstroCoreSettings = DEFAULT_SETTINGS

  async onload() {
    await this.loadSettings()
    this.addSettingTab(new AstroCoreSettingTab(this.app, this))

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
  }

  onunload() {}

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData())
  }

  async saveSettings() {
    await this.saveData(this.settings)
  }
}

// ─── Settings tab ──────────────────────────────────────────────────

class AstroCoreSettingTab extends PluginSettingTab {
  plugin: AstroCorePlugin

  constructor(app: App, plugin: AstroCorePlugin) {
    super(app, plugin)
    this.plugin = plugin
  }

  display(): void {
    const { containerEl } = this
    containerEl.empty()

    containerEl.createEl("h2", { text: "AstroCore AI — Налаштування" })

    new Setting(containerEl)
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

    new Setting(containerEl)
      .setName("API Key (опційно)")
      .setDesc("Резерв для майбутньої авторизації. Поки необов'язково.")
      .addText((text) =>
        text
          .setPlaceholder("sk-...")
          .setValue(this.plugin.settings.apiKey)
          .onChange(async (value) => {
            this.plugin.settings.apiKey = value.trim()
            await this.plugin.saveSettings()
          })
      )
  }
}