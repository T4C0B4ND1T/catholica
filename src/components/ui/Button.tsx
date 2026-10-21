import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "outline" | "ghost";

const base =
  "inline-flex min-h-[44px] touch-manipulation items-center justify-center gap-2 rounded-md px-5 text-sm font-medium tracking-[0.05em] transition-all duration-200 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-50 disabled:pointer-events-none";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-accent-foreground shadow-sm hover:bg-accent-secondary hover:shadow-md",
  outline:
    "border border-foreground text-foreground hover:bg-muted hover:border-accent hover:text-accent",
  ghost:
    "text-muted-foreground underline-offset-4 decoration-accent hover:text-foreground hover:underline",
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant };

export function Button({ variant = "primary", className = "", type = "button", ...props }: ButtonProps) {
  return <button type={type} className={`${base} ${variants[variant]} ${className}`} {...props} />;
}
