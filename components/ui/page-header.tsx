type PageHeaderProps = {
    title: string;
    description?: string;
    action?: React.ReactNode;
  };
  
  export function PageHeader({
    title,
    description,
    action,
  }: PageHeaderProps) {
    return (
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1
            className="text-lg font-medium mb-1"
            style={{ color: "var(--astro-text-primary)" }}
          >
            {title}
          </h1>
  
          {description && (
            <p
              className="text-sm"
              style={{ color: "var(--astro-text-secondary)" }}
            >
              {description}
            </p>
          )}
        </div>
  
        {action && <div>{action}</div>}
      </div>
    );
  }