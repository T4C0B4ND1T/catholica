import { FIXED_CELEBRATIONS, type Celebration, type Rank } from '@/data/saints';
import { addDays, dayOfWeek } from '@/lib/dates';
import { easterSunday } from './calendar';

export const RANK_LABELS: Record<Rank, string> = {
  S: 'Solemnity',
  F: 'Feast',
  M: 'Memorial',
  O: 'Optional memorial',
  C: '',
};

/** Celebrations tied to Easter (days after Easter Sunday). */
const MOVABLE: [number, Celebration][] = [
  [50, { name: 'The Blessed Virgin Mary, Mother of the Church', rank: 'M' }],
  [68, { name: 'The Most Sacred Heart of Jesus', rank: 'S' }],
  [69, { name: 'The Immaculate Heart of the Blessed Virgin Mary', rank: 'M' }],
];

/** Every fixed or Easter-tied celebration on the calendar for a date, before any ranking against the day. */
export function celebrationsOn(date: string): Celebration[] {
  const easter = easterSunday(Number(date.slice(0, 4)));
  const movable = MOVABLE.filter(([n]) => addDays(easter, n) === date).map(([, c]) => c);
  return [...movable, ...(FIXED_CELEBRATIONS[date.slice(5)] ?? [])];
}

/** The words that name a celebration, for spotting it in a USCCB title ("Memorial of Saint Luke" holds "luke"). */
function keyWords(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/^(the |sts?\. |bl\. |our lady of )+/, '')
    .split(/[ ,]+/)
    .slice(0, 2)
    .join(' ');
}

export interface SaintOfDay extends Celebration {
  /** "Optional memorial", or "Commemoration" on a privileged weekday. */
  label: string;
}

/**
 * What the Church remembers on a weekday beyond what the day's title already says. Nothing on Sundays or from Palm
 * Sunday through the Easter Octave; memorials in Lent and Dec 17-24 become commemorations.
 */
export function saintsOfDay(date: string, feast: string): SaintOfDay[] {
  if (dayOfWeek(date) === 0) return [];
  const easter = easterSunday(Number(date.slice(0, 4)));
  if (date >= addDays(easter, -7) && date <= addDays(easter, 7)) return [];
  const lent = date >= addDays(easter, -46) && date < addDays(easter, -7);
  const lateAdvent = date.slice(5) >= '12-17' && date.slice(5) <= '12-24';
  const title = feast
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\bsaints?\b/g, '');
  return celebrationsOn(date)
    .filter((c) => !title.includes(keyWords(c.name)))
    .map((c) => ({
      ...c,
      label: (lent || lateAdvent) && (c.rank === 'M' || c.rank === 'O') ? 'Commemoration' : RANK_LABELS[c.rank],
    }));
}
