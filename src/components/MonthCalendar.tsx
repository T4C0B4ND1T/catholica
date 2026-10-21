"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { dayOfWeek, formatDay } from "@/lib/dates";

const MIN_YEAR = 1970;
const MAX_YEAR = 2100;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const pad = (n: number) => String(n).padStart(2, "0");

export function MonthCalendar({
  selected,
  today,
  onPick,
}: {
  selected: string;
  today: string;
  onPick: (date: string) => void;
}) {
  const [view, setView] = useState({ year: Number(selected.slice(0, 4)), month: Number(selected.slice(5, 7)) });
  const { year, month } = view;

  const first = `${year}-${pad(month)}-01`;
  const lead = dayOfWeek(first);
  const count = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: (number | null)[] = [...Array<null>(lead).fill(null), ...Array.from({ length: count }, (_, i) => i + 1)];

  const shift = (delta: number) =>
    setView(({ year: y, month: m }) => {
      const idx = y * 12 + (m - 1) + delta;
      return { year: Math.floor(idx / 12), month: (idx % 12) + 1 };
    });
  const title = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "long", year: "numeric" }).format(
    new Date(Date.UTC(year, month - 1, 1, 12)),
  );

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <IconButton label="Previous month" disabled={year <= MIN_YEAR && month === 1} onClick={() => shift(-1)}>
          <ChevronLeft size={20} strokeWidth={1.5} aria-hidden="true" />
        </IconButton>
        <p className="font-display text-lg" aria-live="polite">
          {title}
        </p>
        <IconButton label="Next month" disabled={year >= MAX_YEAR && month === 12} onClick={() => shift(1)}>
          <ChevronRight size={20} strokeWidth={1.5} aria-hidden="true" />
        </IconButton>
      </div>
      <div className="grid grid-cols-7 text-center">
        {WEEKDAYS.map((d) => (
          <span key={d} className="small-caps py-1 text-[0.65rem] text-muted-foreground">
            {d}
          </span>
        ))}
        {cells.map((day, i) => {
          if (day === null) return <span key={`blank-${i}`} aria-hidden="true" />;
          const date = `${year}-${pad(month)}-${pad(day)}`;
          const isSelected = date === selected;
          return (
            <button
              key={date}
              type="button"
              aria-label={formatDay(date)}
              aria-pressed={isSelected}
              aria-current={date === today ? "date" : undefined}
              onClick={() => onPick(date)}
              className={`mx-auto flex size-11 touch-manipulation items-center justify-center rounded-full text-sm transition-colors duration-200 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
                isSelected
                  ? "bg-foreground text-background"
                  : date === today
                    ? "border border-accent hover:bg-muted"
                    : "hover:bg-muted"
              }`}
            >
              {day}
            </button>
          );
        })}
      </div>
      {selected !== today && (
        <div className="mt-4 flex justify-center">
          <Button variant="outline" onClick={() => onPick(today)}>
            Go to today
          </Button>
        </div>
      )}
    </div>
  );
}
