import { ChatInput } from "@/components/dashboard/ChatInput";

export function AIWorkspace() {
  return (
    <div className="astro-surface astro-red-border rounded-xl p-6 mt-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--astro-red)]">
            Простір
          </p>

          <h2 className="mt-3 text-2xl font-medium text-[var(--astro-text-primary)]">
            AI Workspace
          </h2>

          <p className="mt-3 text-sm text-[var(--astro-text-secondary)] max-w-2xl">
            AstroCore вже завантажив:
            клієнта, tone of voice, SOP та попередні сесії.
          </p>
        </div>

        <div className="rounded-lg border border-[var(--astro-border-dim)] px-4 py-2 text-xs text-[var(--astro-text-muted)]">
          Контекст активний
        </div>
      </div>

      <div className="mt-8 grid grid-cols-[280px_1fr] gap-6">

        {/* Context panel */}
        <div className="astro-elevated rounded-xl p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--astro-text-muted)]">
            Памʼять
          </p>

          <div className="mt-4 space-y-3">
            <div className="rounded-lg border border-[var(--astro-border-dim)] p-3 text-sm">
              ✦ B2B SaaS · ROI tone
            </div>

            <div className="rounded-lg border border-[var(--astro-border-dim)] p-3 text-sm">
              ✦ Бюджет €15k підтверджено
            </div>

            <div className="rounded-lg border border-[var(--astro-border-dim)] p-3 text-sm">
              ✦ SOP: Q3 Strategy
            </div>
          </div>
        </div>

        {/* Chat area */}
        <div className="astro-elevated rounded-xl p-5">
          <div className="space-y-5">

            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--astro-red)]">
                AI
              </p>

              <div className="mt-3 rounded-xl border border-[var(--astro-border-dim)] p-4">
                <p className="text-sm leading-relaxed text-[var(--astro-text-primary)]">
                  Минулого разу ви зупинились на Q3 стратегії для NovaTech.
                  Пілар 2 залишився незавершеним.
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-[var(--astro-border-dim)] p-4">
              <p className="text-sm text-[var(--astro-text-secondary)]">
                Напиши Pillar 2 з урахуванням budget constraints.
              </p>
            </div>

            <div className="rounded-xl border border-[var(--astro-border-dim)] p-4">
              <p className="text-sm text-[var(--astro-text-primary)] leading-relaxed">
                Для mid-market SaaS сегменту рекомендується змістити акцент
                на performance-driven positioning...
              </p>

              <p className="mt-4 text-xs text-[var(--astro-red)]">
                ✦ Памʼять оновлено
              </p>
            </div>
          </div>

          <ChatInput />
        </div>
      </div>
    </div>
  );
}