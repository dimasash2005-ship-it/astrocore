export function WorkspacePreview() {
    return (
      <div className="astro-surface astro-red-border rounded-xl p-6 mt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--astro-red)]">
              Простір
            </p>
  
            <h2 className="mt-3 text-2xl font-medium text-[var(--astro-text-primary)]">
              Продовжити з місця зупинки
            </h2>
  
            <p className="mt-3 text-sm text-[var(--astro-text-secondary)] max-w-2xl">
              Остання сесія: ви працювали над Q3 стратегією для NovaTech.
              Контекст клієнта, SOP і попередні рішення вже завантажено.
            </p>
          </div>
  
          <button className="rounded-lg bg-[var(--astro-red)] px-5 py-3 text-sm text-white">
            Продовжити →
          </button>
        </div>
      </div>
    );
  }