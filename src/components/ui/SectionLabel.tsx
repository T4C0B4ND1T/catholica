export function SectionLabel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`mb-6 flex items-center gap-4 ${className}`}>
      <span className="h-px flex-1 bg-border" aria-hidden="true" />
      <span className="small-caps text-accent-ink">{children}</span>
      <span className="h-px flex-1 bg-border" aria-hidden="true" />
    </div>
  );
}
