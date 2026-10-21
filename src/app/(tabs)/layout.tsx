import { unstable_rethrow } from "next/navigation";
import { Suspense } from "react";
import { ServiceWorker } from "@/components/ServiceWorker";
import { TabBar } from "@/components/TabBar";
import { latestBulletin } from "@/lib/db/bulletins";

/** The offline worker, told which bulletin is newest so it can save that PDF. Streams in; never blocks the page. */
async function OfflineSupport() {
  let bulletinDate: string | null = null;
  try {
    bulletinDate = (await latestBulletin())?.sundayDate ?? null;
  } catch (e) {
    unstable_rethrow(e);
    console.error("latestBulletin failed", e instanceof Error ? e.message : e);
  }
  return <ServiceWorker bulletinDate={bulletinDate} />;
}

export default function TabsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-1 flex-col">
      <TabBar />
      <main className="mx-auto flex w-full max-w-[34em] flex-1 flex-col px-4 py-8 pb-[calc(3.5rem+env(safe-area-inset-bottom)+2rem)] md:pb-12">
        {children}
      </main>
      <Suspense fallback={null}>
        <OfflineSupport />
      </Suspense>
    </div>
  );
}
