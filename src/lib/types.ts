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

/** One Catechism paragraph tied to the day's readings. The number is checked against the Catechism before saving. */
export interface CatechismConnection {
  paragraph: number;
  connection: string;
}

/** The AI study notes beside the day's homiletic reflection. Shown only under an AI label. */
export interface ReflectionInsights {
  theology: string;
  catechism: CatechismConnection[];
  prayer: string;
}

/** AI summary of a bulletin's text. Shown under an AI label, with the PDF as the source of truth. */
export interface BulletinSummary {
  massTimes: string[];
  confession: string[];
  announcements: { title: string; text: string }[];
}

/** How much the study guide says: brief notes, or the full study. */
export type StudyLevel = 'brief' | 'full';

/** The reader's depth setting: brief every day, in depth on Sundays and holy days only, or in depth every day. */
export type StudyDepth = 'brief' | 'sundays' | 'deep';

/** AI study notes for one reading. Shown under that reading, always labeled as AI. */
export interface ReadingStudy {
  /** The reading's index in the day's `sections`. */
  index: number;
  context: { who: string; when: string; where: string; why: string };
  explanation: string;
  reflection: string;
}

/** The day's AI study guide: notes for each First Reading, Psalm, Second Reading and Gospel of every Mass. */
export interface StudyGuide {
  level: StudyLevel;
  readings: ReadingStudy[];
}
