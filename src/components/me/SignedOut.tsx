import { SignInButton } from "@/app/auth/signin/sign-in-button";

const SECTIONS = ["Daily prayers", "Notes", "Intentions", "Bookmarks"];

/** Disabled stand-in for the synced sections while signed out. */
export function SignedOut() {
  return (
    <>
      <div className="rounded-lg border border-border bg-card p-6 text-center">
        <p>Sign in to sync your notes and prayers</p>
        <div className="mt-4 flex justify-center">
          <SignInButton />
        </div>
      </div>
      <fieldset disabled aria-label="Synced sections, available after signing in" className="space-y-6 opacity-60">
        {SECTIONS.map((name) => (
          <section key={name}>
            <h2 className="font-display text-xl">{name}</h2>
            <div className="mt-2 min-h-11 rounded-md border border-dashed border-border" aria-hidden="true" />
          </section>
        ))}
      </fieldset>
    </>
  );
}
