import type { MassDialogueLine, MassStepData } from '@/data/order-of-mass';
import { addDays, dayOfWeek } from '@/lib/dates';
import { easterSunday, liturgicalDay } from '@/lib/liturgical/calendar';
import { holyDayOfObligation } from '@/lib/liturgical/holy-days';
import type { DailyReadings, Season } from '@/lib/types';

/** How a step of the Order of Mass applies on a given day. */
export type StepState = 'show' | 'maybe' | 'omit';

export interface StepPlan {
  state: StepState;
  /** Why the step is left out or may be left out, or a seasonal change to it. */
  note?: string;
  /** The step with seasonal text swapped in (the Lenten Gospel Acclamation). */
  step?: MassStepData;
}

export interface MassDayPlan {
  /** A day whose liturgy differs from the ordinary Mass (the Triduum). */
  banner: string | null;
  plan(step: MassStepData): StepPlan;
}

export type DayRank = 'sunday' | 'solemnity' | 'weekday' | 'unknown';

// USCCB titles of solemnities on the US calendar (and the days the Church ranks with them).
const SOLEMNITY =
  /solemnity|nativity of the lord|epiphany|ascension|pentecost|most holy trinity|body and blood|sacred heart|king of the universe|immaculate conception|assumption|all saints|annunciation|saint joseph, spouse|nativity of saint john the baptist|saints peter and paul|holy mother of god|easter sunday|resurrection of the lord/i;
// "Wednesday of the Twenty-ninth Week in Ordinary Time", "Saturday after Ash Wednesday", "December 19".
const WEEKDAY = /^ash wednesday$|^(monday|tuesday|wednesday|thursday|friday|saturday) (of|after|before|in)\b|^(december|january) \d{1,2}$/i;

/** The day's rank as far as the date and USCCB's title tell: memorials and feasts can't be told apart, so `unknown`. */
export function dayRank(date: string, feast: string | undefined): DayRank {
  if (holyDayOfObligation(date)) return 'solemnity';
  const title = (feast ?? '').trim();
  if (title && SOLEMNITY.test(title)) return 'solemnity';
  if (dayOfWeek(date) === 0) return 'sunday';
  if (title && WEEKDAY.test(title)) return 'weekday';
  return 'unknown';
}

/** Christmas Day through Jan 1, and Easter Sunday through the Second Sunday of Easter. */
function inOctave(date: string): 'christmas' | 'easter' | null {
  const md = date.slice(5);
  if (md >= '12-25' || md === '01-01') return 'christmas';
  const easter = easterSunday(Number(date.slice(0, 4)));
  if (date >= easter && date <= addDays(easter, 7)) return 'easter';
  return null;
}

const PENITENTIAL: Partial<Record<Season, string>> = { advent: 'Advent', lent: 'Lent' };

const LENTEN_ACCLAMATION: MassDialogueLine[] = [
  { speaker: 'all', text: 'Praise to you, Lord Jesus Christ, King of endless glory!', isResponse: true },
  { speaker: 'reader', text: '[The cantor chants the verse before the Gospel for today]' },
  { speaker: 'all', text: 'Praise to you, Lord Jesus Christ, King of endless glory!', isResponse: true },
];

function triduumBanner(date: string): string | null {
  const easter = easterSunday(Number(date.slice(0, 4)));
  if (date === addDays(easter, -3))
    return 'Holy Thursday: the Evening Mass of the Lord’s Supper adds the Washing of Feet and ends with the Transfer of the Holy Eucharist instead of a dismissal.';
  if (date === addDays(easter, -2))
    return 'Good Friday: no Mass is celebrated. The Celebration of the Lord’s Passion has its own order: the Word, the Adoration of the Cross, and Holy Communion.';
  if (date === addDays(easter, -1))
    return 'Holy Saturday: the Easter Vigil begins after nightfall with the Service of Light and has more readings and the baptismal liturgy before the Eucharist.';
  return null;
}

/** What changes in the Order of Mass on `date`: the Gloria, Creed and second reading by rank and season, and the Lenten acclamation. */
export function massDayPlan(date: string, readings: DailyReadings | null): MassDayPlan {
  const { season } = liturgicalDay(date);
  const rank = dayRank(date, readings?.feast);
  const octave = inOctave(date);
  const penitential = PENITENTIAL[season];
  const easter = easterSunday(Number(date.slice(0, 4)));
  const doubleAlleluia = octave === 'easter' || date === addDays(easter, 49);
  const hasReading2 = readings ? readings.sections.some((s) => s.kind === 'reading2') : null;

  const plan = (step: MassStepData): StepPlan => {
    switch (step.id) {
      case 'gloria': {
        if (rank === 'solemnity' || octave) return { state: 'show' };
        if (rank === 'sunday') return penitential ? { state: 'omit', note: `Not sung on Sundays of ${penitential}.` } : { state: 'show' };
        if (rank === 'weekday') return { state: 'omit', note: 'Not said on weekdays.' };
        return { state: 'maybe', note: 'Said only if today is a feast or solemnity.' };
      }
      case 'profession-of-faith': {
        if (rank === 'sunday' || rank === 'solemnity') return { state: 'show' };
        return { state: 'omit', note: 'Said only on Sundays and solemnities.' };
      }
      case 'second-reading': {
        if (hasReading2 === true) return { state: 'show' };
        if (hasReading2 === false) return { state: 'omit', note: 'No second reading today.' };
        if (rank === 'sunday' || rank === 'solemnity') return { state: 'show' };
        if (rank === 'weekday') return { state: 'omit', note: 'No second reading on weekdays.' };
        return { state: 'maybe', note: 'Only on Sundays and solemnities.' };
      }
      case 'gospel-acclamation': {
        if (season === 'lent' || date === addDays(easter, -3)) {
          return {
            state: 'show',
            note: 'In Lent the Alleluia is not sung. Your parish may use another Lenten acclamation.',
            step: { ...step, title: 'Gospel Acclamation (Lenten)', dialogue: LENTEN_ACCLAMATION, rubricNotes: 'All stand.' },
          };
        }
        return { state: 'show' };
      }
      case 'dismissal': {
        if (doubleAlleluia)
          return { state: 'show', note: 'Today the deacon or priest adds “alleluia, alleluia” to the dismissal, and all answer “Thanks be to God, alleluia, alleluia.”' };
        return { state: 'show' };
      }
      default:
        return { state: 'show' };
    }
  };

  return { banner: triduumBanner(date), plan };
}
