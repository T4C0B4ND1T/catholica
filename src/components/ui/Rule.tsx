export function Rule({ className = "" }: { className?: string }) {
  return <hr className={`h-px border-0 bg-border ${className}`} />;
}
