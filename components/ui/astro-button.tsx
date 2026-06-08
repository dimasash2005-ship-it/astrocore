import { Loader2 } from "lucide-react";

type AstroButtonProps = {
  children: React.ReactNode;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  disabled?: boolean;
  className?: string;
};

export function AstroButton({
  children,
  onClick,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  className = "",
}: AstroButtonProps) {
  const variants = {
    primary: {
      backgroundColor: "var(--astro-red)",
      color: "white",
      border: "none",
    },

    secondary: {
      backgroundColor: "var(--astro-bg-elevated)",
      color: "var(--astro-text-primary)",
      border: "0.5px solid var(--astro-border-base)",
    },

    ghost: {
      backgroundColor: "transparent",
      color: "var(--astro-text-secondary)",
      border: "0.5px solid var(--astro-border-dim)",
    },

    danger: {
      backgroundColor: "rgba(232,0,42,0.12)",
      color: "#FF4D6A",
      border: "0.5px solid rgba(232,0,42,0.35)",
    },
  };

  const sizes = {
    sm: "px-3 py-1.5 text-xs rounded-lg",
    md: "px-4 py-2 text-sm rounded-xl",
    lg: "px-5 py-3 text-sm rounded-xl",
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 font-medium transition-all disabled:opacity-50 ${sizes[size]} ${className}`}
      style={variants[variant]}
    >
      {loading && <Loader2 size={14} className="animate-spin" />}

      {children}
    </button>
  );
}