const memories = [
    "B2B SaaS · ROI-тон",
    "Бюджет €15k підтверджено",
    "SOP: Контент-стратегія",
    "Остання сесія: Q3 brief",
  ];
  
  export function MemoryPanel() {
    return (
      <div className="astro-surface rounded-xl p-5">
        <h3 className="text-sm uppercase tracking-[0.2em] text-[var(--astro-text-muted)]">
          Памʼять
        </h3>
  
        <div className="mt-5 space-y-3">
          {memories.map((memory) => (
            <div
              key={memory}
              className="rounded-lg border border-[var(--astro-border-dim)] p-3 text-sm text-[var(--astro-text-secondary)]"
            >
              ✦ {memory}
            </div>
          ))}
        </div>
      </div>
    );
  }