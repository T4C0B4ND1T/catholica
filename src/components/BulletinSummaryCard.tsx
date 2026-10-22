import { Card } from "@/components/ui/Card";
import type { BulletinSummary } from "@/lib/types";

function List({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mt-4">
      <h3 className="small-caps text-muted-foreground">{title}</h3>
      <ul className="mt-1 space-y-0.5">
        {items.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ul>
    </div>
  );
}

/** The bulletin's Mass and confession times and announcements as text, so a 6 MB PDF need not open. Always labeled AI. */
export function BulletinSummaryCard({ summary }: { summary: BulletinSummary }) {
  return (
    <Card data-testid="bulletin-summary">
      <h2 className="font-display text-xl">At a glance</h2>
      <p className="mt-1 text-sm italic text-muted-foreground">Summarized by AI from the bulletin. Check the bulletin itself before you rely on a time.</p>
      <List title="Mass times" items={summary.massTimes} />
      <List title="Confession" items={summary.confession} />
      {summary.announcements.length > 0 && (
        <div className="mt-4">
          <h3 className="small-caps text-muted-foreground">This week</h3>
          <ul className="mt-1 space-y-3">
            {summary.announcements.map((a) => (
              <li key={`${a.title}|${a.text}`}>
                {a.title && <p className="font-medium">{a.title}</p>}
                {a.text && <p className="text-muted-foreground">{a.text}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
