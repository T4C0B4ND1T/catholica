"use client";

import { useSyncExternalStore } from "react";
import { Card } from "@/components/ui/Card";
import { FATIMA_PRAYER, MYSTERIES, ROSARY_CLOSING_PRAYER, mysteriesFor, type MysterySet } from "@/data/prayers";
import { dayOfWeek, todayInChicago } from "@/lib/dates";

const ORDER: MysterySet[] = ["joyful", "luminous", "sorrowful", "glorious"];
const noSubscribe = () => () => {};

const STEPS = [
  "Make the Sign of the Cross and pray the Apostles' Creed.",
  "Pray an Our Father, three Hail Marys (for faith, hope and charity), and a Glory Be.",
  "For each of the five decades: announce the mystery, then pray an Our Father, ten Hail Marys while thinking on the mystery, a Glory Be, and the Fatima Prayer.",
  "After the fifth decade, pray the Hail, Holy Queen and the closing prayer.",
];

/** How to pray the Rosary and the four sets of mysteries, with today's set marked (on the phone's own date). */
export function RosaryGuide() {
  // Computed in the browser, so a page saved for offline on another day still marks the right set.
  const today = useSyncExternalStore(noSubscribe, () => mysteriesFor(dayOfWeek(todayInChicago())), () => null);

  return (
    <div className="space-y-6">
      <Card>
        <h2 className="font-display text-xl">How to pray it</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5">
          {STEPS.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
        <h3 className="small-caps mt-5 text-muted-foreground">Fatima Prayer</h3>
        <p className="mt-1">{FATIMA_PRAYER}</p>
        <h3 className="small-caps mt-5 text-muted-foreground">Closing prayer</h3>
        <p className="mt-1 whitespace-pre-line">{ROSARY_CLOSING_PRAYER}</p>
      </Card>
      {ORDER.map((key) => {
        const set = MYSTERIES[key];
        const isToday = today === key;
        return (
          <Card key={key} featured={isToday} data-testid={`mysteries-${key}`} aria-current={isToday ? "true" : undefined}>
            <p className="small-caps text-muted-foreground">{isToday ? `Today · ${set.days}` : set.days}</p>
            <h2 className="mt-1 font-display text-xl">{set.title}</h2>
            <ol className="mt-3 list-decimal space-y-1 pl-5">
              {set.mysteries.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ol>
          </Card>
        );
      })}
    </div>
  );
}
