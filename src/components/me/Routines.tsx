"use client";

import { Check } from "lucide-react";
import { todayInChicago } from "@/lib/dates";
import { usePersonal } from "@/lib/offline/use-personal";

interface Routine {
  id: string;
  name: string;
  sort_order: number;
}
interface Tick {
  id: string;
  routine_id: string;
  date: string;
}

export function Routines() {
  const routines = usePersonal<Routine>("routines");
  const ticks = usePersonal<Tick>("routine_ticks");
  const today = todayInChicago();
  const sorted = [...routines.rows].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <section aria-labelledby="routines-title">
      <h2 id="routines-title" className="font-display text-xl">
        Daily prayers
      </h2>
      <ul className="mt-3 space-y-2">
        {sorted.map((r) => {
          const tick = ticks.rows.find((t) => t.routine_id === r.id && t.date === today);
          return (
            <li key={r.id}>
              <button
                type="button"
                aria-pressed={Boolean(tick)}
                onClick={() =>
                  tick
                    ? ticks.remove(tick.id)
                    : ticks.upsert({ id: crypto.randomUUID(), routine_id: r.id, date: today })
                }
                className="flex min-h-11 w-full touch-manipulation items-center gap-3 rounded-md border border-border px-3 text-left transition-colors duration-200 ease-out hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <span
                  aria-hidden="true"
                  className={`flex size-6 shrink-0 items-center justify-center rounded-full border ${
                    tick ? "border-accent bg-accent text-accent-foreground" : "border-border"
                  }`}
                >
                  {tick && <Check className="size-4" />}
                </span>
                <span className={tick ? "text-muted-foreground" : ""}>{r.name}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {routines.ready && sorted.length === 0 && (
        <p className="mt-3 text-sm text-muted-foreground">No prayers yet.</p>
      )}
    </section>
  );
}
