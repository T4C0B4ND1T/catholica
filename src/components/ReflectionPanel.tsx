import { CatechismLink } from "@/components/CatechismLink";
import { PersonalReflection } from "@/components/PersonalReflection";
import type { ReflectionInsights } from "@/lib/types";

function Part({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-5 first:mt-0">
      <h3 className="small-caps text-sm text-muted-foreground">{title}</h3>
      <div className="mt-1">{children}</div>
    </section>
  );
}

/**
 * The day's AI reflection, collapsed: the short homily, how the readings connect, Catechism connections, the prayer
 * prompt, and (signed in) the reader's own reflection. The study notes for each reading sit under that reading.
 * Always labeled; never part of a reading's text.
 */
export function ReflectionPanel({
  date,
  text,
  insights,
}: {
  date: string;
  text: string | null;
  insights?: ReflectionInsights | null;
}) {
  if (!text && !insights) return null;
  return (
    <details className="group rounded-lg border border-border bg-card" data-testid="reflection">
      <summary className="small-caps flex min-h-11 cursor-pointer items-center justify-between gap-3 px-6 text-muted-foreground focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring">
        <span>AI reflection</span>
        <span aria-hidden="true" className="transition-transform duration-200 ease-out group-open:rotate-180">
          ▾
        </span>
      </summary>
      <div className="border-t border-border px-6 py-4">
        <p className="mb-4 text-sm italic text-muted-foreground">Written by AI. Not Scripture and not Church teaching.</p>
        {text && (
          <Part title="Short homily">
            <p className="whitespace-pre-line">{text}</p>
          </Part>
        )}
        {insights?.theology && (
          <Part title="How the readings connect">
            <p className="whitespace-pre-line" data-testid="insight-theology">{insights.theology}</p>
          </Part>
        )}
        {insights && insights.catechism.length > 0 && (
          <Part title="Catechism connections">
            <ul className="space-y-3" data-testid="insight-catechism">
              {insights.catechism.map((c) => (
                <li key={c.paragraph}>
                  <p>{c.connection}</p>
                  <div className="mt-1">
                    <CatechismLink paragraph={c.paragraph} />
                  </div>
                </li>
              ))}
            </ul>
          </Part>
        )}
        {insights?.prayer && (
          <Part title="Prayer prompt">
            <p className="whitespace-pre-line" data-testid="insight-prayer">{insights.prayer}</p>
          </Part>
        )}
        <PersonalReflection date={date} />
      </div>
    </details>
  );
}
