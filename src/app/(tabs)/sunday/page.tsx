import Link from "next/link";
import { NoteEditor } from "@/components/NoteEditor";
import { ReadingCard } from "@/components/ReadingCard";
import { ReflectionPanel } from "@/components/ReflectionPanel";
import { SourceFooter } from "@/components/SourceFooter";
import { Card } from "@/components/ui/Card";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { buttonClasses } from "@/components/ui/Button";
import { addDays, dateParam, formatDay, todayInChicago } from "@/lib/dates";
import { latestBulletin } from "@/lib/db/bulletins";
import { getQuestions, getReadings, getReflection } from "@/lib/db/readings";
import { comingSunday } from "@/lib/liturgical/calendar";
import { defaultMass, massSections } from "@/lib/mass-options";
import { usccbUrl } from "@/lib/sources/usccb-url";
import type { Bulletin } from "@/lib/types";

export const metadata = { title: "Sunday prep · Catholica" };

async function safeLatestBulletin(): Promise<Bulletin | null> {
  try {
    return await latestBulletin();
  } catch (e) {
    console.error("latestBulletin failed", e instanceof Error ? e.message : e);
    return null;
  }
}

/** Everything for preparing for one Sunday: its readings, the AI reflection and questions, a note, and the bulletin. */
export default async function SundayPrepPage({ searchParams }: { searchParams: Promise<{ date?: string | string[] }> }) {
  const sunday = comingSunday(dateParam((await searchParams).date) ?? todayInChicago());
  const [readings, reflection, questions, bulletin] = await Promise.all([
    getReadings(sunday),
    getReflection(sunday),
    getQuestions(sunday),
    safeLatestBulletin(),
  ]);
  const sections = readings ? massSections(readings.sections, defaultMass(readings.sections)) : [];
  // The newest bulletin is for this Sunday or the one before; anything older is not about this week.
  const weekBulletin = bulletin && bulletin.sundayDate >= addDays(sunday, -7) ? bulletin : null;

  return (
    <div className="space-y-8">
      <header className="text-center">
        <p className="small-caps text-muted-foreground">Sunday prep · {formatDay(sunday)}</p>
        <h1 className="mt-3 font-display text-[2rem] leading-[1.15] tracking-[-0.02em]">
          {readings?.feast || "This Sunday"}
        </h1>
        <nav aria-label="Other Sundays" className="mt-2 flex justify-center gap-4 text-sm">
          <Link href={`/sunday?date=${addDays(sunday, -7)}`} className="inline-flex min-h-11 items-center text-muted-foreground underline decoration-accent underline-offset-4">
            Previous Sunday
          </Link>
          <Link href={`/sunday?date=${addDays(sunday, 7)}`} className="inline-flex min-h-11 items-center text-muted-foreground underline decoration-accent underline-offset-4">
            Next Sunday
          </Link>
        </nav>
      </header>

      {sections.length > 0 ? (
        <div className="space-y-6" data-testid="prep-readings">
          {sections.map((item) => (
            <ReadingCard key={item.index} date={sunday} item={item} />
          ))}
        </div>
      ) : (
        <Card data-testid="no-readings" className="text-center">
          <p>Readings for this Sunday aren&apos;t saved yet. They arrive about a week ahead.</p>
          <a href={usccbUrl(sunday)} className="mt-2 inline-flex min-h-11 items-center underline underline-offset-4">
            Open on USCCB
          </a>
        </Card>
      )}

      {reflection && <ReflectionPanel text={reflection} />}

      {questions && (
        <section aria-labelledby="questions-title" className="rounded-lg border border-border bg-card px-6 py-4" data-testid="prep-questions">
          <h2 id="questions-title" className="small-caps text-muted-foreground">
            Questions to pray with
          </h2>
          <p className="mt-2 text-sm italic text-muted-foreground">Written by AI. Not Scripture and not Church teaching.</p>
          <ol className="mt-3 list-decimal space-y-2 pl-5">
            {questions.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ol>
        </section>
      )}

      <section aria-labelledby="prep-note-title">
        <SectionLabel>
          <span id="prep-note-title">My note</span>
        </SectionLabel>
        <NoteEditor date={sunday} label={`Note for ${formatDay(sunday)}`} rows={5} />
      </section>

      <div className="flex flex-wrap justify-center gap-3">
        <Link href={`/mass?date=${sunday}`} className={buttonClasses("primary")}>
          Follow the Mass
        </Link>
        {weekBulletin && (
          <Link href={`/bulletin/${weekBulletin.sundayDate}`} className={buttonClasses("outline")}>
            Bulletin for {formatDay(weekBulletin.sundayDate)}
          </Link>
        )}
      </div>

      {readings && sections.length > 0 && <SourceFooter readings={readings} />}
    </div>
  );
}
