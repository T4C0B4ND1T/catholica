import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@/lib/db/server';
import { isAllowed } from '@/lib/auth/allowlist';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next');
  const dest = next && next.startsWith('/') && !next.startsWith('//') ? next : '/';

  if (!code) return NextResponse.redirect(`${origin}/auth/signin?error=1`);

  const supabase = await createServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(`${origin}/auth/signin?error=1`);

  const { data } = await supabase.auth.getUser();
  if (!isAllowed(data.user?.email)) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/auth/signin?denied=1`);
  }
  return NextResponse.redirect(`${origin}${dest}`);
}
