"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AlertCircle, Eye, EyeOff, Loader2 } from "lucide-react";
import { getSupabase } from "@/lib/supabase/client";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") ?? "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function login() {
    if (!email.trim() || !password.trim()) {
      setError("Заповніть email і пароль");
      return;
    }

    setLoading(true);
    setError("");

    const supabase = getSupabase();

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setError("Невірний email або пароль");
      setLoading(false);
      return;
    }

    router.push(nextPath);
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-[var(--astro-bg-base)] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--astro-red)] text-white font-semibold">
            A
          </div>

          <h1 className="mt-4 text-xl font-medium text-[var(--astro-text-primary)]">
            AstroCore
          </h1>

          <p className="mt-1 text-xs text-[var(--astro-text-muted)]">
            AI Agent Workspace
          </p>
        </div>

        <div className="astro-surface rounded-xl p-6">
          <p className="mb-5 text-sm font-medium text-[var(--astro-text-primary)]">
            Увійти в акаунт
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
                onKeyDown={(e) => {
                  if (e.key === "Enter") login();
                }}
              />

              <button
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--astro-text-muted)]"
              >
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-xl border border-red-900/40 bg-red-950/20 p-3 text-sm text-red-400">
                <AlertCircle size={14} />
                {error}
              </div>
            )}

            <button
              onClick={login}
              disabled={loading}
              className="flex items-center justify-center gap-2 rounded-xl bg-[var(--astro-red)] px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
            >
              {loading && <Loader2 size={14} className="animate-spin" />}
              {loading ? "Входимо..." : "Увійти"}
            </button>
          </div>
        </div>

        <p className="mt-4 text-center text-xs text-[var(--astro-text-muted)]">
          Немає акаунту?{" "}
          <Link href="/register" className="text-[var(--astro-red)]">
            Зареєструватись
          </Link>
        </p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}