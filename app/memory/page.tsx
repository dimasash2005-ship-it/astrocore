"use client";

import { useEffect, useState } from "react";
import { Brain, Plus, Trash2, X } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { AstroButton } from "@/components/ui/astro-button";
import { PageHeader } from "@/components/ui/page-header";

type MemoryItem = {
  id: string;
  title: string;
  content: string;
  type: "client" | "project" | "rule" | "sop" | "prompt";
  createdAt: string;
};

function loadMemory(): MemoryItem[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem("astro:memory");
  return raw ? JSON.parse(raw) : [];
}

function saveMemory(items: MemoryItem[]) {
  localStorage.setItem("astro:memory", JSON.stringify(items));
}

export default function MemoryPage() {
  const [items, setItems] = useState<MemoryItem[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<MemoryItem | null>(null);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [type, setType] = useState<MemoryItem["type"]>("project");

  function refresh() {
    setItems(loadMemory());
  }

  useEffect(() => {
    refresh();
  }, []);

  function addMemory() {
    if (!title.trim() || !content.trim()) return;

    const newItem: MemoryItem = {
      id: Date.now().toString(),
      title: title.trim(),
      content: content.trim(),
      type,
      createdAt: new Date().toISOString(),
    };

    saveMemory([newItem, ...items]);
    setTitle("");
    setContent("");
    setType("project");
    setShowForm(false);
    refresh();
  }

  function removeMemory(id: string) {
    saveMemory(items.filter((item) => item.id !== id));
    setSelected(null);
    refresh();
  }

  return (
    <div className="p-8 max-w-6xl">
      <PageHeader
        title="Памʼять"
        description="Спільний контекст, який AstroCore передає вашим AI агентам"
        action={
          <AstroButton onClick={() => setShowForm(true)}>
            <Plus size={14} />
            Додати памʼять
          </AstroButton>
        }
      />

      {showForm && (
        <div className="astro-surface mb-6 rounded-xl p-5">
          <p className="mb-4 text-xs uppercase tracking-[0.2em] text-[var(--astro-text-muted)]">
            Новий запис памʼяті
          </p>

          <div className="grid gap-4">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Назва: клієнт, проєкт, правило..."
              className="rounded-xl bg-[var(--astro-bg-base)] border border-[var(--astro-border-base)] px-4 py-3 text-sm outline-none"
            />

            <select
              value={type}
              onChange={(e) => setType(e.target.value as MemoryItem["type"])}
              className="rounded-xl bg-[var(--astro-bg-base)] border border-[var(--astro-border-base)] px-4 py-3 text-sm outline-none"
            >
              <option value="project">Проєкт</option>
              <option value="client">Клієнт</option>
              <option value="rule">Правило</option>
              <option value="sop">SOP</option>
              <option value="prompt">Промпт</option>
            </select>

            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Що AstroCore має памʼятати?"
              rows={5}
              className="resize-none rounded-xl bg-[var(--astro-bg-base)] border border-[var(--astro-border-base)] px-4 py-3 text-sm outline-none"
            />

            <div className="flex gap-3">
              <AstroButton onClick={addMemory}>
                <Plus size={14} />
                Зберегти
              </AstroButton>

              <AstroButton variant="ghost" onClick={() => setShowForm(false)}>
                Скасувати
              </AstroButton>
            </div>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <EmptyState
          icon={Brain}
          title="Памʼять порожня"
          description="Тут буде зберігатися контекст про проєкти, клієнтів, стиль роботи та важливі рішення"
        />
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => setSelected(item)}
              className="astro-surface rounded-xl p-5 text-left hover:border-[var(--astro-red)] transition-all"
            >
              <span className="rounded-full border border-[var(--astro-border-dim)] px-2 py-0.5 text-xs text-[var(--astro-text-muted)]">
                {item.type}
              </span>

              <p className="mt-4 text-sm font-medium text-[var(--astro-text-primary)]">
                {item.title}
              </p>

              <p className="mt-3 line-clamp-4 text-sm text-[var(--astro-text-secondary)]">
                {item.content}
              </p>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6">
          <div className="astro-surface w-full max-w-2xl rounded-2xl p-6">
            <div className="flex justify-between gap-4">
              <div>
                <p className="text-lg font-medium">{selected.title}</p>
                <p className="mt-1 text-xs text-[var(--astro-text-muted)]">
                  {selected.type} · {new Date(selected.createdAt).toLocaleString("uk-UA")}
                </p>
              </div>

              <button
                onClick={() => setSelected(null)}
                className="text-[var(--astro-text-muted)] hover:text-[var(--astro-red)]"
              >
                <X size={18} />
              </button>
            </div>

            <p className="mt-6 whitespace-pre-wrap text-sm leading-relaxed text-[var(--astro-text-secondary)]">
              {selected.content}
            </p>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => removeMemory(selected.id)}
                className="flex items-center gap-2 text-sm text-[var(--astro-text-muted)] hover:text-[var(--astro-red)]"
              >
                <Trash2 size={15} />
                Видалити
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}