"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, LogOut, Mail, Save, User } from "lucide-react";
import { getSupabase } from "@/lib/supabase/client";
import { PageHeader } from "@/components/ui/page-header";
import { AstroButton } from "@/components/ui/astro-button";

export default function AccountPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadUser() {
      const supabase = getSupabase();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      setEmail(user.email ?? "");
      setUserId(user.id);
    }

    loadUser();
  }, [router]);

  async function updatePassword() {
    if (password.length < 6) {
      setStatus("Пароль має містити мінімум 6 символів");
      return;
    }

    setLoading(true);
    setStatus("");

    const supabase = getSupabase();

    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      setStatus(error.message);
      setLoading(false);
      return;
    }

    setPassword("");
    setStatus("Пароль оновлено ✅");
    setLoading(false);
  }

  async function logout() {
    const supabase = getSupabase();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="p-8 max-w-3xl">
      <PageHeader
        title="Акаунт"
        description="Керуйте профілем, паролем та сесією AstroCore"
      />

      {status && (
        <div className="mb-4 rounded-xl border border-[var(--astro-border-dim)] bg-[var(--astro-bg-surface)] p-3 text-sm text-[var(--astro-text-secondary)]">
          {status}
        </div>
      )}

      <div className="grid gap-4">
        <div className="astro-surface rounded-xl p-5">
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--astro-red)] text-white">
              <User size={18} />
            </div>

            <div>
              <p className="text-sm font-medium text-[var(--astro-text-primary)]">
                Профіль
              </p>
              <p className="mt-1 text-xs text-[var(--astro-text-muted)]">
                Ваш Supabase акаунт
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-3">
            <div className="rounded-xl border border-[var(--astro-border-dim)] bg-[var(--astro-bg-base)] p-4">
              <div className="flex items-center gap-2 text-xs text-[var(--astro-text-muted)]">
                <Mail size={14} />
                Email
              </div>
              <p className="mt-2 text-sm text-[var(--astro-text-primary)]">
                {email || "—"}
              </p>
            </div>

            <div className="rounded-xl border border-[var(--astro-border-dim)] bg-[var(--astro-bg-base)] p-4">
              <div className="flex items-center gap-2 text-xs text-[var(--astro-text-muted)]">
                <KeyRound size={14} />
                User ID
              </div>
              <p className="mt-2 break-all font-mono text-xs text-[var(--astro-text-secondary)]">
                {userId || "—"}
              </p>
            </div>
          </div>
        </div>

        <div className="astro-surface rounded-xl p-5">
          <p className="text-sm font-medium text-[var(--astro-text-primary)]">
            Змінити пароль
          </p>

          <p className="mt-1 text-xs text-[var(--astro-text-muted)]">
            Введіть новий пароль для вашого акаунту.
          </p>

          <div className="mt-4 flex gap-3">
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Новий пароль"
              className="flex-1 rounded-xl bg-[var(--astro-bg-base)] border border-[var(--astro-border-base)] px-4 py-3 text-sm outline-none"
            />

            <AstroButton onClick={updatePassword} disabled={loading}>
              <Save size={14} />
              {loading ? "Зберігаємо..." : "Зберегти"}
            </AstroButton>
          </div>
        </div>

        <div className="astro-surface rounded-xl p-5 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-[var(--astro-text-primary)]">
              Вийти з акаунту
            </p>
            <p className="mt-1 text-xs text-[var(--astro-text-muted)]">
              Завершити поточну сесію AstroCore.
            </p>
          </div>

          <AstroButton variant="secondary" onClick={logout}>
            <LogOut size={14} />
            Вийти
          </AstroButton>
        </div>
      </div>
    </div>
  );
}