import { BookmarkButton } from "@/components/BookmarkButton";
import { SpeakButton } from "@/components/SpeakButton";
import { StudyNotes } from "@/components/StudyNotes";
import { Card } from "@/components/ui/Card";
import { bookmarkKey, fullLabel, type MassSection } from "@/lib/mass-options";
import type { ReadingKind, ReadingStudy } from "@/lib/types";

/**
 * One saved reading. Its text comes only from the saved section; AI study notes, when there are any, sit below it in
 * their own labeled, collapsed block.
 */
export function ReadingCard({
  date,
  item,
  legacyKind,
  study,
}: {
  date: string;
  item: MassSection;
  legacyKind?: ReadingKind;
  study?: ReadingStudy;
}) {
  const { section, index, label } = item;
  const featured = section.kind === "gospel";
  return (
    <Card
      featured={featured}
      id={`card-${index}`}
      data-card={section.kind}
      role="group"
      aria-label={fullLabel(item)}
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
          <SpeakButton label={section.title || label} text={`${section.title}. ${section.text}`} />
          <BookmarkButton date={date} sectionKey={bookmarkKey(item)} label={fullLabel(item)} legacyKind={legacyKind} />
        </div>
      </div>
      <p className="mt-4 max-w-[34em] whitespace-pre-line text-[length:calc(19px*var(--text-scale,1))] leading-[1.75]">{section.text}</p>
      {study && <StudyNotes study={study} />}
    </Card>
  );
}
