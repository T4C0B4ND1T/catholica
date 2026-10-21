import { BookmarkButton, SECTION_LABELS } from "@/components/BookmarkButton";
import { SpeakButton } from "@/components/SpeakButton";
import { Card } from "@/components/ui/Card";
import type { ReadingSection } from "@/lib/types";

/** One saved reading. Text comes only from the saved section; AI text never appears here. */
export function ReadingCard({ date, section }: { date: string; section: ReadingSection }) {
  const label = SECTION_LABELS[section.kind];
  const featured = section.kind === "gospel";
  return (
    <Card
      featured={featured}
      id={`card-${section.kind}`}
      data-card={section.kind}
      role="group"
      aria-label={label}
      className="w-full shrink-0 snap-center self-start"
    >
      <div className="mb-4 flex items-center gap-3">
        <span className="h-px flex-1 bg-border" aria-hidden="true" />
        <span className="small-caps text-muted-foreground">{label}</span>
        <span className="h-px flex-1 bg-border" aria-hidden="true" />
      </div>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-display text-xl leading-snug">{section.title || label}</h2>
          {section.citation && <p className="small-caps mt-1 text-muted-foreground">{section.citation}</p>}
        </div>
        <div className="-mr-2 -mt-1 flex shrink-0">
          <SpeakButton label={label} text={`${section.title}. ${section.text}`} />
          <BookmarkButton date={date} section={section.kind} />
        </div>
      </div>
      <p className="mt-4 max-w-[34em] whitespace-pre-line text-[19px] leading-[1.75]">{section.text}</p>
    </Card>
  );
}
