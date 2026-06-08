import { LucideIcon } from "lucide-react";

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
};

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div
      className="flex flex-col items-center justify-center py-16 px-8 rounded-xl text-center"
      style={{
        border: "0.5px dashed var(--astro-border-base)",
      }}
    >
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
        style={{ backgroundColor: "var(--astro-bg-elevated)" }}
      >
        <Icon size={20} style={{ color: "var(--astro-text-muted)" }} />
      </div>

      <p
        className="text-sm font-medium mb-1"
        style={{ color: "var(--astro-text-primary)" }}
      >
        {title}
      </p>

      <p
        className="text-xs mb-4 max-w-xs"
        style={{ color: "var(--astro-text-muted)" }}
      >
        {description}
      </p>

      {action}
    </div>
  );
}