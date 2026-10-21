"use client";

import { CalendarDays } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { MonthCalendar } from "@/components/MonthCalendar";
import { Sheet } from "@/components/ui/Sheet";
import { formatDay } from "@/lib/dates";

/** The date in small caps; opens a month calendar. Picking a day goes to `/?date=`. */
export function DateChip({ date, today }: { date: string; today: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        className="small-caps inline-flex min-h-11 touch-manipulation items-center gap-2 rounded-md px-3 text-foreground transition-colors duration-200 ease-out hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <CalendarDays size={18} strokeWidth={1.5} aria-hidden="true" className="text-accent-ink" />
        <span>{formatDay(date)}</span>
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Choose a day">
        {open && (
          <MonthCalendar
            selected={date}
            today={today}
            onPick={(d) => {
              setOpen(false);
              router.push(d === today ? "/" : `/?date=${d}`);
            }}
          />
        )}
      </Sheet>
    </>
  );
}
