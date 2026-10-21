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
