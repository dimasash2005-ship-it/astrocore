"use client";

import { useEffect, useState } from "react";
import { BookOpen, Plus, Trash2, X } from "lucide-react";

import { vaultStore, type VaultItem } from "@/lib/store";
import { EmptyState } from "@/components/ui/empty-state";
import { AstroButton } from "@/components/ui/astro-button";
import { PageHeader } from "@/components/ui/page-header";

export default function VaultPage() {
  const [items, setItems] = useState<VaultItem[]>([]);
  const [selected, setSelected] = useState<VaultItem | null>(null);

  function refresh() {
    setItems(vaultStore.getAll());
  }

  useEffect(() => {
    refresh();
  }, []);

  function removeItem(id: string) {
    vaultStore.remove(id);
    refresh();
    setSelected(null);
  }

  return (
    <div className="p-8 max-w-6xl">
      <PageHeader
        title="Сховище"
        description="Нотатки, SOP, промпти та збережені AI-відповіді"
        action={
          <AstroButton>
            <Plus size={14} />
            Додати
          </AstroButton>
        }
      />

      {items.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="Сховище порожнє"
          description="Зберігайте важливі відповіді AI, процеси та знання в одному місці"
        />
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => setSelected(item)}
              className="astro-surface rounded-xl p-5 text-left hover:border-[var(--astro-red)] transition-all"
            >
              <p className="text-sm font-medium text-[var(--astro-text-primary)]">
                {item.title}
              </p>

              <p className="mt-3 line-clamp-4 text-sm text-[var(--astro-text-secondary)]">
                {item.content}
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                {item.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-[var(--astro-border-dim)] px-2 py-0.5 text-xs text-[var(--astro-text-muted)]"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6">
          <div className="astro-surface w-full max-w-2xl rounded-2xl p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-lg font-medium text-[var(--astro-text-primary)]">
                  {selected.title}
                </p>
                <p className="mt-1 text-xs text-[var(--astro-text-muted)]">
                  {new Date(selected.createdAt).toLocaleString("uk-UA")}
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

            <div className="mt-6 flex justify-between">
              <div className="flex flex-wrap gap-2">
                {selected.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-[var(--astro-border-dim)] px-2 py-0.5 text-xs text-[var(--astro-text-muted)]"
                  >
                    {tag}
                  </span>
                ))}
              </div>

              <button
                onClick={() => removeItem(selected.id)}
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