type Activity = {
    id: string;
    text: string;
    time: string;
  };
  
  const activities: Activity[] = [
    {
      id: "1",
      text: "Памʼять оновлено: NovaTech підтвердив бюджет €15k",
      time: "2 хв тому",
    },
    {
      id: "2",
      text: "TechMedia — створено новий follow-up",
      time: "14 хв тому",
    },
    {
      id: "3",
      text: "AI згенерував SOP для onboarding",
      time: "32 хв тому",
    },
  ];
  
  export function ActivityFeed() {
    return (
      <div className="astro-surface rounded-xl p-5">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-sm uppercase tracking-[0.2em] text-[var(--astro-text-muted)]">
            Активність
          </h3>
  
          <button className="text-xs text-[var(--astro-red)]">
            Журнал →
          </button>
        </div>
  
        <div className="space-y-4">
          {activities.map((activity) => (
            <div
              key={activity.id}
              className="border border-[var(--astro-border-dim)] rounded-lg p-3"
            >
              <p className="text-sm text-[var(--astro-text-primary)] leading-relaxed">
                {activity.text}
              </p>
  
              <p className="mt-2 text-xs text-[var(--astro-text-muted)]">
                {activity.time}
              </p>
            </div>
          ))}
        </div>
      </div>
    );
  }