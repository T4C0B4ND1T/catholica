import { TabBar } from "@/components/TabBar";

export default function TabsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-1 flex-col">
      <TabBar />
      <main className="mx-auto flex w-full max-w-[34em] flex-1 flex-col px-4 py-8 pb-[calc(3.5rem+env(safe-area-inset-bottom)+2rem)] md:pb-12">
        {children}
      </main>
    </div>
  );
}
