"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { TodayView, type MissingReason } from "@/components/TodayView";
import { dateParam, todayInChicago } from "@/lib/dates";
import type { DailyReadings } from "@/lib/types";

type Loaded = { date: string; readings: DailyReadings | null; reflection: string | null; missing: MissingReason };

const noSubscribe = () => () => {};

/**
 * Shows the server-rendered Today screen (`children`) when it is for the day the URL asks for. When the page came from
 * the offline cache instead (yesterday's `/`, or the `/` shell standing in for an unsaved `/?date=`), it renders the
 * wanted day in the browser from `/api/readings/[date]`, which the service worker answers from its cache.
 */
export function TodayOffline({ renderedDate, children }: { renderedDate: string; children: React.ReactNode }) {
  // Null while hydrating, so hydration always matches the served HTML; then the phone's Chicago date.
  const clientToday = useSyncExternalStore(noSubscribe, todayInChicago, () => null);
  const param = dateParam(useSearchParams().get("date"));
  const wanted = clientToday === null ? null : (param ?? clientToday);
  const stale = wanted !== null && wanted !== renderedDate;
  const [loaded, setLoaded] = useState<Loaded | null>(null);

  useEffect(() => {
    if (!stale || !wanted) return;
    let cancelled = false;
    const done = (l: Loaded) => {
      if (!cancelled) setLoaded(l);
    };
    fetch(`/api/readings/${wanted}`)
      .then(async (res) => {
        if (!res.ok) return done({ date: wanted, readings: null, reflection: null, missing: "failed" });
        const body = (await res.json()) as { readings: DailyReadings | null; reflection: string | null };
        done({ date: wanted, readings: body.readings, reflection: body.reflection, missing: "unsaved" });
      })
      // No network and nothing cached for this day.
      .catch(() => done({ date: wanted, readings: null, reflection: null, missing: "offline" }));
    return () => {
      cancelled = true;
    };
  }, [stale, wanted]);

  if (!stale || !wanted) return children;
  const current = loaded?.date === wanted ? loaded : null;
  return (
    <TodayView
      date={wanted}
      today={clientToday ?? wanted}
      readings={current?.readings ?? null}
      reflection={current?.reflection ?? null}
      missing={current?.missing ?? "loading"}
    />
  );
}
