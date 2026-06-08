type Task = {
    id: string;
    title: string;
    priority: "П1" | "П2" | "П3";
  };
  
  const tasks: Task[] = [
    {
      id: "1",
      title: "Дописати Q3 стратегію для NovaTech",
      priority: "П1",
    },
    {
      id: "2",
      title: "Відповісти клієнту TechMedia",
      priority: "П2",
    },
    {
      id: "3",
      title: "Перевірити onboarding SOP",
      priority: "П3",
    },
  ];
  
  export function TaskList() {
    return (
      <div className="astro-surface rounded-xl p-5">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-sm uppercase tracking-[0.2em] text-[var(--astro-text-muted)]">
            Завдання
          </h3>
  
          <button className="text-xs text-[var(--astro-red)]">
            Всі →
          </button>
        </div>
  
        <div className="space-y-3">
          {tasks.map((task) => (
            <div
              key={task.id}
              className="flex items-center justify-between border border-[var(--astro-border-dim)] rounded-lg p-3"
            >
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full border border-[var(--astro-border-strong)]" />
  
                <p className="text-sm text-[var(--astro-text-primary)]">
                  {task.title}
                </p>
              </div>
  
              <span className="text-xs text-[var(--astro-red)]">
                {task.priority}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }