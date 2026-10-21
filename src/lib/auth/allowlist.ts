import { createServerClient } from '@/lib/db/server';

export function isAllowed(
  email: string | null | undefined,
  allowed: string | undefined = process.env.ALLOWED_EMAIL,
): boolean {
  if (!email || !allowed) return false;
  const a = email.trim().toLowerCase();
  const b = allowed.trim().toLowerCase();
  return a !== '' && a === b;
}

/** Returns the signed-in, allowed user or throws a 401 `Response`. */
export async function requireUser(): Promise<{ id: string; email: string }> {
  const deny = () =>
    new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  const supabase = await createServerClient();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user || !user.email || !isAllowed(user.email)) throw deny();
  return { id: user.id, email: user.email };
}
