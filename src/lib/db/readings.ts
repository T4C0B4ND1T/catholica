import 'server-only';
import type { DailyReadings, ReadingSection, ReflectionInsights } from '@/lib/types';
import { aiModel } from '@/lib/ai/model';
import { liturgicalDay } from '@/lib/liturgical/calendar';
import { createAdminClient } from './admin';
import { createServerClient } from './server';

/** The day's readings, or null when none are stored. Throws when the lookup fails. */
export async function readReadings(date: string): Promise<DailyReadings | null> {
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from('readings')
    .select('date, feast, lectionary, sections, source_url, fetched_at')
    .eq('date', date)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    date: data.date,
    feast: data.feast ?? '',
    lectionary: data.lectionary ?? null,
    sections: (data.sections ?? []) as ReadingSection[],
    sourceUrl: data.source_url ?? '',
    fetchedAt: data.fetched_at,
  };
}

/** The day's readings, or null when none are stored (or the lookup fails, so pages still render). */
export async function getReadings(date: string): Promise<DailyReadings | null> {
  try {
    return await readReadings(date);
  } catch (e) {
    console.error('getReadings failed', e instanceof Error ? e.message : e);
    return null;
  }
}

/** Upserts the day's readings (service role). Stores the Sunday cycle on Sundays, the weekday cycle otherwise. */
export async function saveReadings(r: DailyReadings): Promise<void> {
  const day = liturgicalDay(r.date);
  const { error } = await createAdminClient()
    .from('readings')
    .upsert(
      {
        date: r.date,
        feast: r.feast,
        season: day.season,
        color: day.color,
        cycle: day.isSunday ? day.sundayCycle : day.weekdayCycle,
        sections: r.sections,
        lectionary: r.lectionary,
        source_url: r.sourceUrl,
        fetched_at: r.fetchedAt,
      },
      { onConflict: 'date' },
    );
  if (error) throw new Error(`saveReadings ${r.date}: ${error.message}`);
}

/** The day's AI reflection, or null when none is stored. Throws when the lookup fails. */
export async function readReflection(date: string): Promise<string | null> {
  const supabase = await createServerClient();
  const { data, error } = await supabase.from('reflections').select('text').eq('date', date).maybeSingle();
  if (error) throw new Error(error.message);
  return data?.text ?? null;
}

export async function getReflection(date: string): Promise<string | null> {
  try {
    return await readReflection(date);
  } catch (e) {
    console.error('getReflection failed', e instanceof Error ? e.message : e);
    return null;
  }
}

export async function hasReflection(date: string): Promise<boolean> {
  const { data, error } = await createAdminClient().from('reflections').select('date').eq('date', date).maybeSingle();
  if (error) throw new Error(`hasReflection ${date}: ${error.message}`);
  return data !== null;
}

/** Stores AI text only in `reflections`; never touches readings fields. */
export async function saveReflection(date: string, text: string, model?: string): Promise<void> {
  const { error } = await createAdminClient()
    .from('reflections')
    .upsert({ date, text, model: model ?? aiModel() }, { onConflict: 'date' });
  if (error) throw new Error(`saveReflection ${date}: ${error.message}`);
}

/** The Sunday prep questions for the day, or null when none are stored (or the lookup fails, so pages still render). */
export async function getQuestions(date: string): Promise<string[] | null> {
  try {
    const supabase = await createServerClient();
    const { data, error } = await supabase.from('reflections').select('questions').eq('date', date).maybeSingle();
    if (error) throw new Error(error.message);
    const q = data?.questions;
    return Array.isArray(q) && q.length > 0 ? (q as string[]) : null;
  } catch (e) {
    console.error('getQuestions failed', e instanceof Error ? e.message : e);
    return null;
  }
}

export async function hasQuestions(date: string): Promise<boolean> {
  const { data, error } = await createAdminClient().from('reflections').select('questions').eq('date', date).maybeSingle();
  if (error) throw new Error(`hasQuestions ${date}: ${error.message}`);
  return Array.isArray(data?.questions) && data.questions.length > 0;
}

/** Stores the questions on the day's reflection row, which must already exist. */
export async function saveQuestions(date: string, questions: string[]): Promise<void> {
  const { error } = await createAdminClient().from('reflections').update({ questions }).eq('date', date);
  if (error) throw new Error(`saveQuestions ${date}: ${error.message}`);
}

/** The day's AI insights, or null when none are stored (or the lookup fails, so pages still render). */
export async function getInsights(date: string): Promise<ReflectionInsights | null> {
  try {
    const supabase = await createServerClient();
    const { data, error } = await supabase.from('reflections').select('insights').eq('date', date).maybeSingle();
    if (error) throw new Error(error.message);
    return (data?.insights as ReflectionInsights | null) ?? null;
  } catch (e) {
    console.error('getInsights failed', e instanceof Error ? e.message : e);
    return null;
  }
}

export async function hasInsights(date: string): Promise<boolean> {
  const { data, error } = await createAdminClient().from('reflections').select('insights').eq('date', date).maybeSingle();
  if (error) throw new Error(`hasInsights ${date}: ${error.message}`);
  return data?.insights != null;
}

/** Stores the insights on the day's reflection row, which must already exist. */
export async function saveInsights(date: string, insights: ReflectionInsights): Promise<void> {
  const { error } = await createAdminClient().from('reflections').update({ insights }).eq('date', date);
  if (error) throw new Error(`saveInsights ${date}: ${error.message}`);
}
