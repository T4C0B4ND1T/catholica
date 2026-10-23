import 'server-only';
import { createServerClient } from '@/lib/db/server';
import { isAllowed } from '@/lib/auth/allowlist';

/** Returns the signed-in, allowed user or throws a 401 `Response`. */
export async function requireUser(): Promise<{ id: string; email: string; metadata: Record<string, unknown> }> {
  const deny = () =>
    new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  const supabase = await createServerClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user || !user.email || !isAllowed(user.email)) throw deny();
  return { id: user.id, email: user.email, metadata: user.user_metadata ?? {} };
}
