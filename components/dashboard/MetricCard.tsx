type MetricCardProps = {
    label: string;
    value: string;
    sub: string;
  };
  
  export function MetricCard({
    label,
    value,
    sub,
  }: MetricCardProps) {
    return (
      <div className="astro-surface rounded-xl p-5">
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--astro-text-muted)]">
          {label}
        </p>
  
        <h3 className="mt-4 text-4xl font-medium text-[var(--astro-text-primary)]">
          {value}
        </h3>
  
        <p className="mt-3 text-sm text-[var(--astro-text-secondary)]">
          {sub}
        </p>
      </div>
    );
  }