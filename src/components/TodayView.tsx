import Link from "next/link";
import { DateChip } from "@/components/DateChip";
import { ReadingCard } from "@/components/ReadingCard";
import { ReadingsCarousel } from "@/components/ReadingsCarousel";
import { ReflectionPanel } from "@/components/ReflectionPanel";
import { SourceFooter } from "@/components/SourceFooter";
import { Card } from "@/components/ui/Card";
import { buttonClasses } from "@/components/ui/Button";
import { liturgicalDay } from "@/lib/liturgical/calendar";
import { usccbUrl } from "@/lib/sources/usccb-url";
import type { DailyReadings, LitColor, Season } from "@/lib/types";

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

/** Why there are no readings to show: not saved yet, the lookup failed, saved nowhere while offline, or still loading. */
export type MissingReason = "unsaved" | "failed" | "offline" | "loading";

function Missing({ date, reason }: { date: string; reason: MissingReason }) {
  if (reason === "loading") {
    return (
      <Card data-testid="no-readings" className="text-center" aria-busy="true">
        <p className="text-muted-foreground">Loading the readings…</p>
      </Card>
    );
  }
  if (reason === "offline") {
    return (
      <Card data-testid="no-readings" className="text-center">
        <p>
          Not saved for offline. Connect to load, or{" "}
          <a href={usccbUrl(date)} className="inline-flex min-h-11 items-center underline underline-offset-4">
            open USCCB
          </a>
          .
        </p>
      </Card>
    );
  }
  return (
    <Card data-testid="no-readings" className="text-center">
      <p>{reason === "failed" ? "Couldn't load the readings right now." : "Readings for this day aren't saved yet."}</p>
      <a href={usccbUrl(date)} className="mt-2 inline-flex min-h-11 items-center underline underline-offset-4">
        Open on USCCB
      </a>
    </Card>
  );
}

/** The Today screen for one day. Rendered on the server, or in the browser from cached readings when offline. */
export function TodayView({
  date,
  today,
  readings,
  reflection,
  missing = "unsaved",
  children,
}: {
  date: string;
  today: string;
  readings: DailyReadings | null;
  reflection: string | null;
  /** Shown in place of the readings when there are none. */
  missing?: MissingReason;
  /** Extra cards after the reflection (This Sunday). */
  children?: React.ReactNode;
}) {
  const day = liturgicalDay(date);
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
        <Missing date={date} reason={missing} />
      )}

      <div className="flex justify-center">
        <Link href={`/mass?date=${date}`} className={buttonClasses("primary")}>
          Follow the Mass
        </Link>
      </div>

      {reflection && <ReflectionPanel text={reflection} />}

      {children}

      {readings && sections.length > 0 && <SourceFooter readings={readings} />}
    </div>
  );
}
