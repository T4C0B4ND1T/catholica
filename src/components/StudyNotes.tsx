import type { ReadingStudy } from "@/lib/types";

const CONTEXT: { key: keyof ReadingStudy["context"]; label: string }[] = [
  { key: "who", label: "Who" },
  { key: "when", label: "When" },
  { key: "where", label: "Where" },
  { key: "why", label: "Why" },
];

/** The AI study notes for one reading, collapsed under it: context, explanation, reflection. Always labeled as AI. */
export function StudyNotes({ study }: { study: ReadingStudy }) {
  const context = CONTEXT.filter((c) => study.context[c.key]);
  return (
    <details className="group mt-6 border-t border-border pt-2" data-testid="study-notes">
      <summary className="small-caps flex min-h-11 cursor-pointer items-center justify-between gap-3 text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
        <span>Study notes</span>
        <span aria-hidden="true" className="transition-transform duration-200 ease-out group-open:rotate-180">
          ▾
        </span>
      </summary>
      <div className="pb-2 text-[length:calc(17px*var(--text-scale,1))] leading-[1.65]">
        <p className="mb-4 text-sm italic text-muted-foreground">Written by AI. Not Scripture and not Church teaching.</p>
        {context.length > 0 && (
          <section>
            <h3 className="small-caps text-sm text-muted-foreground">Context</h3>
            <dl className="mt-1 space-y-2">
              {context.map((c) => (
                <div key={c.key}>
                  <dt className="inline font-semibold">{c.label}: </dt>
                  <dd className="inline">{study.context[c.key]}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}
        <section className="mt-5">
          <h3 className="small-caps text-sm text-muted-foreground">Explanation</h3>
          <p className="mt-1 whitespace-pre-line">{study.explanation}</p>
        </section>
        {study.reflection && (
          <section className="mt-5">
            <h3 className="small-caps text-sm text-muted-foreground">Reflection</h3>
            <p className="mt-1 whitespace-pre-line">{study.reflection}</p>
          </section>
        )}
      </div>
    </details>
  );
}
