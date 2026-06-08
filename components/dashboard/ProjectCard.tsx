export function ProjectCard() {
    return (
      <div className="astro-surface rounded-xl p-5 mt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--astro-text-muted)]">
              Активний проєкт
            </p>
  
            <h3 className="mt-3 text-2xl font-medium text-[var(--astro-text-primary)]">
              NovaTech Q3 Strategy
            </h3>
  
            <p className="mt-2 text-sm text-[var(--astro-text-secondary)]">
              B2B SaaS · контент-стратегія · дедлайн 28 травня
            </p>
          </div>
  
          <span className="rounded-full border border-[var(--astro-red)] px-3 py-1 text-xs text-[var(--astro-red)]">
            Контекст активний
          </span>
        </div>
      </div>
    );
  }