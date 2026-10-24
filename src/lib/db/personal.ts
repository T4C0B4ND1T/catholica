import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { aiModel } from '@/lib/ai/model';
import { addDays } from '@/lib/dates';
import { studyDepthOf } from '@/lib/study';
import type { StudyDepth, StudyLevel } from '@/lib/types';
import { createAdminClient } from './admin';

/** How far back notes are read, how many, and how much of each, so the prompt stays small. */
const NOTE_DAYS = 30;
const NOTE_COUNT = 6;
const NOTE_CHARS = 1500;
const INTENTION_COUNT = 12;

export interface PersonalReflection {
  date: string;
  text: string;
  level: StudyLevel;
  createdAt: string;
}

/** The allowed reader (ALLOWED_EMAIL) and their depth setting, for the jobs. Null when there is no such user yet. */
export async function allowedReader(): Promise<{ id: string; depth: StudyDepth } | null> {
  const email = process.env.ALLOWED_EMAIL?.trim().toLowerCase();
  if (!email) return null;
  const { data, error } = await createAdminClient().auth.admin.listUsers({ perPage: 100 });
  if (error) throw new Error(`allowedReader: ${error.message}`);
  const user = data.users.find((u) => u.email?.toLowerCase() === email);
  return user ? { id: user.id, depth: studyDepthOf(user.user_metadata) } : null;
}

/**
 * The reader's note for `date`, then their other notes from the 30 days before it (newest first), and their open
 * intentions. `db` is the reader's own client (RLS) or the admin client; both filter by `userId`.
 */
export async function personalContext(
  db: SupabaseClient,
  userId: string,
  date: string,
): Promise<{ notes: { date: string; body: string }[]; intentions: string[] }> {
  const [notes, intentions] = await Promise.all([
    db
      .from('notes')
      .select('date, body')
      .eq('user_id', userId)
      .lte('date', date)
      .gte('date', addDays(date, -NOTE_DAYS))
      .order('date', { ascending: false })
      .limit(NOTE_COUNT + 1),
    db
      .from('intentions')
      .select('text')
      .eq('user_id', userId)
      .is('answered_at', null)
      .order('created_at', { ascending: false })
      .limit(INTENTION_COUNT),
  ]);
  if (notes.error) throw new Error(`personal notes: ${notes.error.message}`);
  if (intentions.error) throw new Error(`personal intentions: ${intentions.error.message}`);
  return {
    notes: (notes.data ?? [])
      .filter((n) => typeof n.body === 'string' && n.body.trim())
      .slice(0, NOTE_COUNT)
      .map((n) => ({ date: n.date as string, body: (n.body as string).trim().slice(0, NOTE_CHARS) })),
    intentions: (intentions.data ?? []).map((i) => String(i.text).slice(0, 300)),
  };
}

export async function readPersonal(db: SupabaseClient, userId: string, date: string): Promise<PersonalReflection | null> {
  const { data, error } = await db
    .from('personal_reflections')
    .select('date, text, level, created_at')
    .eq('user_id', userId)
    .eq('date', date)
    .maybeSingle();
  if (error) throw new Error(`readPersonal ${date}: ${error.message}`);
  if (!data) return null;
  return { date: data.date, text: data.text, level: data.level === 'full' ? 'full' : 'brief', createdAt: data.created_at };
}

export async function savePersonal(db: SupabaseClient, userId: string, date: string, text: string, level: StudyLevel): Promise<void> {
  const { error } = await db
    .from('personal_reflections')
    .upsert(
      { user_id: userId, date, text, level, model: aiModel(), created_at: new Date().toISOString() },
      { onConflict: 'user_id,date' },
    );
  if (error) throw new Error(`savePersonal ${date}: ${error.message}`);
}
