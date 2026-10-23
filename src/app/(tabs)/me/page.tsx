import { AppHealth } from "@/components/me/AppHealth";
import { Catechism } from "@/components/me/Catechism";
import { Bookmarks } from "@/components/me/Bookmarks";
import { Intentions } from "@/components/me/Intentions";
import { Notes } from "@/components/me/Notes";
import { Routines } from "@/components/me/Routines";
import { SignedOut } from "@/components/me/SignedOut";
import { SettingsPanel } from "@/components/SettingsPanel";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { isAllowed } from "@/lib/auth/allowlist";
import { createServerClient } from "@/lib/db/server";

export const metadata = { title: "Me · Catholica" };

async function isSignedIn(): Promise<boolean> {
  try {
    const supabase = await createServerClient();
    const { data } = await supabase.auth.getUser();
    return isAllowed(data.user?.email);
  } catch {
    return false;
  }
}

export default async function MePage() {
  const signedIn = await isSignedIn();
  return (
    <>
      <SectionLabel>Me</SectionLabel>
      <h1 className="sr-only">Me</h1>
      <div className="space-y-10">
        {signedIn ? (
          <>
            <Routines />
            <Intentions />
            <Notes />
            <Bookmarks />
          </>
        ) : (
          <SignedOut />
        )}
        <Catechism signedIn={signedIn} />
        <SettingsPanel signedIn={signedIn} />
        {signedIn && <AppHealth />}
      </div>
    </>
  );
}
