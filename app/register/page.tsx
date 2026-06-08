"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertCircle, Eye, EyeOff, Loader2 } from "lucide-react";
import { getSupabase } from "@/lib/supabase/client";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  async function register() {
    if (!email.trim() || !password.trim() || !confirm.trim()) {
      setError("Заповніть всі поля");
      return;
    }

    if (password !== confirm) {
      setError("Паролі не співпадають");
      return;
    }

    if (password.length < 6) {
      setError("Мінімум 6 символів");
      return;
    }

    setLoading(true);
    setError("");

    const supabase = getSupabase();

    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  }

  if (success) {
    return (
      <main className="min-h-screen bg-[var(--astro-bg-base)] flex items-center justify-center p-4">
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--astro-red)] text-white font-semibold">
            A
          </div>

          <h1 className="mt-5 text-xl font-medium">
            Перевірте пошту
          </h1>

          <p className="mt-3 text-sm text-[var(--astro-text-muted)]">
            Ми надіслали лист для підтвердження акаунту.
          </p>

          <Link
            href="/login"
            className="mt-6 inline-block text-sm text-[var(--astro-red)]"
          >
            Перейти до входу
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--astro-bg-base)] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--astro-red)] text-white font-semibold">
            A
          </div>

          <h1 className="mt-4 text-xl font-medium">
            AstroCore
          </h1>

          <p className="mt-1 text-xs text-[var(--astro-text-muted)]">
            AI Agent Workspace
          </p>
        </div>

        <div className="astro-surface rounded-xl p-6">
          <p className="mb-5 text-sm font-medium">
            Створити акаунт
          </p>

          <div className="grid gap-4">
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              className="rounded-xl bg-[var(--astro-bg-base)] border border-[var(--astro-border-base)] px-4 py-3 text-sm outline-none"
            />

            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Пароль"
                className="w-full rounded-xl bg-[var(--astro-bg-base)] border border-[var(--astro-border-base)] px-4 py-3 pr-12 text-sm outline-none"
              />

              <button
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--astro-text-muted)]"
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>

            <input
              type={showPassword ? "text" : "password"}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Повторіть пароль"
              className="rounded-xl bg-[var(--astro-bg-base)] border border-[var(--astro-border-base)] px-4 py-3 text-sm outline-none"
            />

            {error && (
              <div className="flex items-center gap-2 rounded-xl border border-red-900/40 bg-red-950/20 p-3 text-sm text-red-400">
                <AlertCircle size={14} />
                {error}
              </div>
            )}

            <button
              onClick={register}
              disabled={loading}
              className="flex items-center justify-center gap-2 rounded-xl bg-[var(--astro-red)] px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              {loading ? "Створюємо..." : "Створити акаунт"}
            </button>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-[var(--astro-text-muted)]">
          Вже є акаунт?{" "}
          <Link href="/login" className="text-[var(--astro-red)]">
            Увійти
          </Link>
        </p>
      </div>
    </main>
  );
}