export type Season = 'advent' | 'christmas' | 'ordinary' | 'lent' | 'triduum' | 'easter';
export type LitColor = 'violet' | 'rose' | 'white' | 'red' | 'green';

export interface LiturgicalDay {
  date: string;
  season: Season;
  color: LitColor;
  sundayCycle: 'A' | 'B' | 'C';
  weekdayCycle: 'I' | 'II';
  isSunday: boolean;
}

export type ReadingKind = 'reading1' | 'psalm' | 'reading2' | 'sequence' | 'alleluia' | 'gospel' | 'other';

export interface ReadingSection {
  kind: ReadingKind;
  /** On a day of several Masses (Christmas, Vigil and Day), the Mass this section belongs to, as USCCB names it. */
  mass?: string;
  title: string;
  citation: string;
  text: string;
}

export interface DailyReadings {
  date: string;
  feast: string;
  lectionary: string | null;
  sections: ReadingSection[];
  sourceUrl: string;
  fetchedAt: string;
}

export interface Bulletin {
  sundayDate: string;
  sourceUrl: string;
  storagePath: string;
  pageCount: number;
  fetchedAt: string;
}
