export function Topbar() {
    return (
      <header className="mb-8 flex items-center justify-between border-b border-[var(--astro-border-dim)] pb-5">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--astro-text-muted)]">
            astrocore / центр
          </p>
  
          <h1 className="mt-3 text-5xl font-medium tracking-tight text-[var(--astro-text-primary)]">
            Центр
          </h1>
  
          <p className="mt-3 text-[var(--astro-text-secondary)]">
            AI-операційний простір, який памʼятає ваш контекст.
          </p>
        </div>
  
        <button className="rounded-lg bg-[var(--astro-red)] px-5 py-3 text-sm text-white">
          + Новий
        </button>
      </header>
    );
  }