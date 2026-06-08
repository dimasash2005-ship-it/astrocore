"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import {
  Database,
  Download,
  Key,
  Settings,
  Trash2,
  Upload,
} from "lucide-react";

import { PageHeader } from "@/components/ui/page-header";
import { AstroButton } from "@/components/ui/astro-button";

const STORAGE_KEYS = [
  "astro:providers",
  "astro:agents",
  "astro:chats",
  "astro:vault",
  "astro:gallery",
  "astro:memory",
];

export default function SettingsPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState("");

  function exportBackup() {
    const backup: Record<string, unknown> = {};

    STORAGE_KEYS.forEach((key) => {
      const raw = localStorage.getItem(key);
      backup[key] = raw ? JSON.parse(raw) : [];
    });

    const blob = new Blob([JSON.stringify(backup, null, 2)], {
      type: "application/json",
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = `astrocore-backup-${Date.now()}.json`;
    a.click();

    URL.revokeObjectURL(url);
    setStatus("Backup експортовано ✅");
  }

  function importBackup(file: File) {
    const reader = new FileReader();

    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));

        STORAGE_KEYS.forEach((key) => {
          if (data[key]) {
            localStorage.setItem(key, JSON.stringify(data[key]));
          }
        });

        setStatus("Backup імпортовано ✅ Оновіть сторінку.");
      } catch {
        setStatus("Помилка імпорту backup");
      }
    };

    reader.readAsText(file);
  }

  function clearData() {
    const ok = window.confirm(
      "Видалити всі локальні дані AstroCore? Це видалить провайдерів, агентів, чати, памʼять, vault і gallery."
    );

    if (!ok) return;

    STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
    setStatus("Локальні дані очищено. Оновіть сторінку.");
  }

  return (
    <div className="p-8 max-w-5xl">
      <PageHeader
        title="Налаштування"
        description="Керуйте AstroCore, API ключами, backup та локальними даними"
      />

      {status && (
        <div className="mb-4 rounded-xl border border-[var(--astro-border-dim)] bg-[var(--astro-bg-surface)] p-3 text-sm text-[var(--astro-green)]">
          {status}
        </div>
      )}

      <div className="grid gap-4">
        <Link
          href="/providers"
          className="astro-surface rounded-xl p-5 flex items-center gap-4 hover:border-[var(--astro-red)] transition-all"
        >
          <Key size={20} className="text-[var(--astro-red)]" />

          <div>
            <p className="text-sm font-medium text-[var(--astro-text-primary)]">
              API ключі
            </p>
            <p className="mt-1 text-xs text-[var(--astro-text-secondary)]">
              Підключіть OpenAI, Claude, Gemini або Custom Agent webhook
            </p>
          </div>
        </Link>

        <div className="astro-surface rounded-xl p-5">
          <div className="flex items-center gap-4">
            <Database size={20} className="text-[var(--astro-red)]" />

            <div>
              <p className="text-sm font-medium text-[var(--astro-text-primary)]">
                Local backup
              </p>
              <p className="mt-1 text-xs text-[var(--astro-text-secondary)]">
                Дані зараз зберігаються у браузері через localStorage. Експортуйте backup перед чисткою браузера.
              </p>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <AstroButton onClick={exportBackup}>
              <Download size={14} />
              Export JSON
            </AstroButton>

            <AstroButton
              variant="secondary"
              onClick={() => fileRef.current?.click()}
            >
              <Upload size={14} />
              Import JSON
            </AstroButton>

            <AstroButton variant="danger" onClick={clearData}>
              <Trash2 size={14} />
              Clear local data
            </AstroButton>

            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) importBackup(file);
              }}
            />
          </div>
        </div>

        <div className="astro-surface rounded-xl p-5 flex items-center gap-4">
          <Settings size={20} className="text-[var(--astro-text-muted)]" />

          <div>
            <p className="text-sm font-medium text-[var(--astro-text-primary)]">
              AstroCore MVP
            </p>
            <p className="mt-1 text-xs text-[var(--astro-text-secondary)]">
              Providers · Agents · Chat · Memory · Vault · Gallery · Backup
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}