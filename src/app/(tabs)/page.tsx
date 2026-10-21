import Link from "next/link";
import { DateChip } from "@/components/DateChip";
import { ReadingCard } from "@/components/ReadingCard";
import { ReadingsCarousel } from "@/components/ReadingsCarousel";
import { ReflectionPanel } from "@/components/ReflectionPanel";
import { SourceFooter } from "@/components/SourceFooter";
import { ThisSundayCard } from "@/components/ThisSundayCard";
import { Card } from "@/components/ui/Card";
import { buttonClasses } from "@/components/ui/Button";
import { addDays, todayInChicago } from "@/lib/dates";
import { latestBulletin } from "@/lib/db/bulletins";
import { getReadings, getReflection, readReadings } from "@/lib/db/readings";
import { showsThisSunday } from "@/lib/this-sunday";
import { comingSunday, liturgicalDay } from "@/lib/liturgical/calendar";
import { usccbUrl } from "@/lib/sources/usccb-url";
import type { Bulletin, DailyReadings, LitColor, Season } from "@/lib/types";

const SEASONS: Record<Season, string> = {
  advent: "Advent",
  christmas: "Christmas",
  ordinary: "Ordinary Time",
  lent: "Lent",
  triduum: "Triduum",
  easter: "Easter",
};

const DOT: Record<LitColor, string> = {
  violet: "bg-lit-violet",
  rose: "bg-lit-rose",
  white: "bg-lit-white",
  red: "bg-lit-red",
  green: "bg-lit-green",
};
const RULE = DOT;

function validDate(value: string | string[] | undefined): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const year = Number(value.slice(0, 4));
  if (year < 1970 || year > 2100) return null;
  try {
    return addDays(value, 0) === value ? value : null;
  } catch {
    return null;
  }
}

async function safeLatestBulletin(): Promise<Bulletin | null> {
  try {
    return await latestBulletin();
  } catch (e) {
    console.error("latestBulletin failed", e instanceof Error ? e.message : e);
    return null;
  }
}

export default async function TodayPage({ searchParams }: { searchParams: Promise<{ date?: string | string[] }> }) {
  const today = todayInChicago();
  const date = validDate((await searchParams).date) ?? today;
  const day = liturgicalDay(date);
  const sunday = showsThisSunday(date) ? comingSunday(date) : null;

  const [lookup, reflection, sundayReadings, bulletin] = await Promise.all([
    readReadings(date).then(
      (r): { readings: DailyReadings | null; failed: boolean } => ({ readings: r, failed: false }),
      (e) => {
        console.error("readReadings failed", e instanceof Error ? e.message : e);
        return { readings: null, failed: true };
      },
    ),
    getReflection(date),
    sunday ? getReadings(sunday) : Promise.resolve(null),
    sunday ? safeLatestBulletin() : Promise.resolve(null),
  ]);
  const { readings, failed: loadFailed } = lookup;
  const sections = readings?.sections ?? [];

  return (
    <div className="space-y-8">
      <header className="text-center">
        <DateChip date={date} today={today} />
        <h1 className="mt-3 font-display text-[2rem] leading-[1.15] tracking-[-0.02em]">
          {readings?.feast || SEASONS[day.season]}
        </h1>
        <div className={`mx-auto mt-3 h-px w-16 ${RULE[day.color]}`} aria-hidden="true" />
        <p className="small-caps mt-3 flex items-center justify-center gap-2 text-muted-foreground">
          <span className={`size-2.5 rounded-full ring-1 ring-border ${DOT[day.color]}`} aria-hidden="true" />
          <span className="sr-only">Liturgical color {day.color}.</span>
          <span>{SEASONS[day.season]}</span>
          <span aria-hidden="true">·</span>
          <span>
            Year {day.sundayCycle} · Week {day.weekdayCycle}
          </span>
        </p>
      </header>

      {readings && sections.length > 0 ? (
        <ReadingsCarousel kinds={sections.map((s) => s.kind)}>
          {sections.map((s, i) => (
            <ReadingCard key={i} date={date} section={s} index={i} />
          ))}
        </ReadingsCarousel>
      ) : (
        <Card data-testid="no-readings" className="text-center">
          <p>{loadFailed ? "Couldn't load the readings right now." : "Readings for this day aren't saved yet."}</p>
          <a
            href={usccbUrl(date)}
            className="mt-2 inline-flex min-h-11 items-center underline underline-offset-4"
          >
            Open on USCCB
          </a>
        </Card>
      )}

      <div className="flex justify-center">
        <Link href={`/mass?date=${date}`} className={buttonClasses("primary")}>
          Follow the Mass
        </Link>
      </div>

      {reflection && <ReflectionPanel text={reflection} />}

      {sunday && <ThisSundayCard sunday={sunday} readings={sundayReadings} bulletin={bulletin} />}

      {readings && sections.length > 0 && <SourceFooter readings={readings} />}
    </div>
  );
}
