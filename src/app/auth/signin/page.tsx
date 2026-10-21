import { SignInButton } from './sign-in-button';

export const metadata = { title: 'Sign in · Catholica' };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string; error?: string }>;
}) {
  const { denied, error } = await searchParams;
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-4">
      <h1 className="font-display text-3xl">Catholica</h1>
      {denied ? (
        <p role="alert">This Catholica is private.</p>
      ) : error ? (
        <p role="alert">Sign-in did not complete. Please try again.</p>
      ) : null}
      <SignInButton />
    </main>
  );
}
