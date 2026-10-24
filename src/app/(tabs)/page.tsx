import { ThisSundayCard } from "@/components/ThisSundayCard";
import { TodayOffline } from "@/components/TodayOffline";
import { TodayView } from "@/components/TodayView";
import { dateParam, todayInChicago } from "@/lib/dates";
import { latestBulletin } from "@/lib/db/bulletins";
import { getInsights, getReadings, getReflection, getStudy, readReadings } from "@/lib/db/readings";
import { showsThisSunday } from "@/lib/this-sunday";
import { comingSunday } from "@/lib/liturgical/calendar";
import type { Bulletin, DailyReadings } from "@/lib/types";

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
  const date = dateParam((await searchParams).date) ?? today;
  const sunday = showsThisSunday(date) ? comingSunday(date) : null;

  const [lookup, reflection, insights, study, sundayReadings, bulletin] = await Promise.all([
    readReadings(date).then(
      (r): { readings: DailyReadings | null; failed: boolean } => ({ readings: r, failed: false }),
      (e) => {
        console.error("readReadings failed", e instanceof Error ? e.message : e);
        return { readings: null, failed: true };
      },
    ),
    getReflection(date),
    getInsights(date),
    getStudy(date),
    sunday ? getReadings(sunday) : Promise.resolve(null),
    sunday ? safeLatestBulletin() : Promise.resolve(null),
  ]);

  return (
    <TodayOffline renderedDate={date}>
      <TodayView
        date={date}
        today={today}
        readings={lookup.readings}
        reflection={reflection}
        insights={insights}
        study={study}
        missing={lookup.failed ? "failed" : "unsaved"}
      >
        {sunday && <ThisSundayCard sunday={sunday} readings={sundayReadings} bulletin={bulletin} />}
      </TodayView>
    </TodayOffline>
  );
}
