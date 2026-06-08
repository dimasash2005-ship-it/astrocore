"use client";

import { useEffect, useState } from "react";
import { Image, Trash2, X } from "lucide-react";

import { galleryStore, type GalleryItem } from "@/lib/store";

import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

export default function GalleryPage() {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [selected, setSelected] = useState<GalleryItem | null>(null);

  function refresh() {
    setItems(galleryStore.getAll());
  }

  useEffect(() => {
    refresh();
  }, []);

  function removeItem(id: string) {
    galleryStore.remove(id);
    refresh();
    setSelected(null);
  }

  return (
    <div className="p-8 max-w-6xl">
      <PageHeader
        title="Галерея"
        description="Збережений контент з чатів та агентів"
      />

      {items.length === 0 ? (
        <EmptyState
          icon={Image}
          title="Галерея порожня"
          description="Зберігайте картинки, тексти, промпти та інші AI-результати"
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

              <p className="mt-3 line-clamp-5 text-sm text-[var(--astro-text-secondary)]">
                {item.content}
              </p>

              <div className="mt-4 flex items-center justify-between">
                <span className="rounded-full border border-[var(--astro-border-dim)] px-2 py-0.5 text-xs text-[var(--astro-text-muted)]">
                  {item.type}
                </span>

                <span className="text-xs text-[var(--astro-text-muted)]">
                  {new Date(item.createdAt).toLocaleDateString("uk-UA")}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6">
          <div className="astro-surface w-full max-w-3xl rounded-2xl p-6">
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

            <div className="mt-6 rounded-xl border border-[var(--astro-border-dim)] p-4">
              <pre className="whitespace-pre-wrap text-sm text-[var(--astro-text-secondary)]">
                {selected.content}
              </pre>
            </div>

            <div className="mt-6 flex justify-end">
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