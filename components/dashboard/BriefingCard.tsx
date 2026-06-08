export function BriefingCard() {
    return (
      <div className="astro-surface astro-red-border astro-red-glow rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="h-2 w-2 rounded-full bg-[var(--astro-red)] astro-pulse" />
  
          <span className="text-xs uppercase tracking-[0.2em] text-[var(--astro-red)]">
            Ранкове зведення
          </span>
        </div>
  
        <h2 className="text-2xl font-medium text-[var(--astro-text-primary)]">
          Доброго ранку. Ось ваш операційний статус.
        </h2>
  
        <div className="mt-6 space-y-4 text-sm text-[var(--astro-text-secondary)]">
          <p>→ NovaTech Q3 незавершено. Контекст завантажено.</p>
  
          <p>→ 3 завдання потребують уваги.</p>
  
          <p>→ Памʼять оновлено: бюджет клієнта підтверджено.</p>
        </div>
      </div>
    );
  }