import 'server-only';
import type { DailyReadings, ReadingSection } from '@/lib/types';
import { createServerClient } from './server';

/** The day's readings, or null when none are stored (or the lookup fails, so pages still render). */
export async function getReadings(date: string): Promise<DailyReadings | null> {
  try {
    const supabase = await createServerClient();
    const { data, error } = await supabase
      .from('readings')
      .select('date, feast, lectionary, sections, source_url, fetched_at')
      .eq('date', date)
      .maybeSingle();
    if (error) {
      console.error('getReadings failed', error.message);
      return null;
    }
    if (!data) return null;
    return {
      date: data.date,
      feast: data.feast ?? '',
      lectionary: data.lectionary ?? null,
      sections: (data.sections ?? []) as ReadingSection[],
      sourceUrl: data.source_url ?? '',
      fetchedAt: data.fetched_at,
    };
  } catch (e) {
    console.error('getReadings failed', e instanceof Error ? e.message : e);
    return null;
  }
}
