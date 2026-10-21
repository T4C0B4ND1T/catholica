import type { HTMLAttributes } from "react";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  /** Gold 2px top rule with a faint accent tint (Gospel, This Sunday). */
  featured?: boolean;
};

export function Card({ featured = false, className = "", ...props }: CardProps) {
  const base = "rounded-lg border border-border p-6 shadow-sm transition-all duration-200 ease-out";
  const look = featured
    ? "border-t-2 border-t-accent bg-accent-muted"
    : "bg-card";
  return <div className={`${base} ${look} ${className}`} {...props} />;
}
