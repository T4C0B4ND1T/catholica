'use client';

import { createBrowserClient } from '@/lib/db/browser';

export function SignInButton() {
  async function signIn() {
    await createBrowserClient().auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }
  return (
    <button
      type="button"
      onClick={signIn}
      className="min-h-11 rounded-md bg-accent px-4 text-background"
    >
      Sign in with Google
    </button>
  );
}
