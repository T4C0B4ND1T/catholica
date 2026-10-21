/** The day's AI reflection, collapsed. Always labeled; never part of a reading card. */
export function ReflectionPanel({ text }: { text: string }) {
  return (
    <details className="group rounded-lg border border-border bg-card" data-testid="reflection">
      <summary className="small-caps flex min-h-11 cursor-pointer items-center justify-between gap-3 px-6 text-muted-foreground focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring">
        <span>AI reflection</span>
        <span aria-hidden="true" className="transition-transform duration-200 ease-out group-open:rotate-180">
          ▾
        </span>
      </summary>
      <div className="border-t border-border px-6 py-4">
        <p className="mb-3 text-sm italic text-muted-foreground">Written by AI. Not Scripture and not Church teaching.</p>
        <p className="whitespace-pre-line">{text}</p>
      </div>
    </details>
  );
}
