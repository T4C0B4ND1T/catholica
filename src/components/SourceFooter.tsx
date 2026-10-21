import type { DailyReadings } from "@/lib/types";
import { usccbUrl } from "@/lib/sources/usccb-url";

function updatedAt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}

export function SourceFooter({ readings }: { readings: DailyReadings }) {
  const time = updatedAt(readings.fetchedAt);
  return (
    <p className="small-caps flex flex-wrap items-center justify-center gap-x-2 text-center text-muted-foreground">
      <span>NABRE</span>
      <span aria-hidden="true">·</span>
      <a
        href={readings.sourceUrl || usccbUrl(readings.date)}
        className="inline-flex min-h-11 items-center underline underline-offset-4"
      >
        Source: USCCB
      </a>
      {time && (
        <>
          <span aria-hidden="true">·</span>
          <span>Updated {time}</span>
        </>
      )}
    </p>
  );
}
