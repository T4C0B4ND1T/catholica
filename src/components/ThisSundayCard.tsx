import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { buttonClasses } from "@/components/ui/Button";
import { formatDay } from "@/lib/dates";
import { sectionForKind } from "@/lib/mass-options";
import type { Bulletin, DailyReadings } from "@/lib/types";

/** Monday to Saturday: the coming Sunday's feast and Gospel citation, and the newest bulletin. */
export function ThisSundayCard({
  sunday,
  readings,
  bulletin,
}: {
  sunday: string;
  readings: DailyReadings | null;
  bulletin: Bulletin | null;
}) {
  const gospel = readings ? sectionForKind(readings.sections, "gospel")?.section : undefined;
  return (
    <Card featured data-testid="this-sunday">
      <p className="small-caps text-muted-foreground">This Sunday</p>
      <p className="small-caps mt-1 text-muted-foreground">{formatDay(sunday)}</p>
      {readings?.feast && <h2 className="mt-3 font-display text-xl leading-snug">{readings.feast}</h2>}
      {gospel?.citation && (
        <p className="mt-2">
          <span className="text-muted-foreground">Gospel </span>
          <span className="small-caps">{gospel.citation}</span>
        </p>
      )}
      {bulletin && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <p className="text-sm text-muted-foreground">Latest bulletin: {formatDay(bulletin.sundayDate)}</p>
          <Link href={`/bulletin/${bulletin.sundayDate}`} className={buttonClasses("outline")}>
            Open bulletin
          </Link>
        </div>
      )}
    </Card>
  );
}
