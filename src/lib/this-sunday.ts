import { dayOfWeek } from "@/lib/dates";

/** The This Sunday card shows Monday to Saturday, not on Sunday itself. */
export function showsThisSunday(date: string): boolean {
  return dayOfWeek(date) !== 0;
}
