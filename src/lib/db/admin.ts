import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/** Service-role client. Server only (jobs, bulletin PDF signed URLs). Bypasses RLS. */
export function createAdminClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
