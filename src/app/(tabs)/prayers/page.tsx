import Link from "next/link";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { PRAYERS, PRAYER_GROUPS } from "@/data/prayers";

export const metadata = { title: "Prayers · Catholica" };

export default function PrayersPage() {
  return (
    <>
      <h1 className="text-center font-display text-[2rem] leading-[1.1] tracking-[-0.02em]">Prayers</h1>
      <p className="mt-2 mb-6 text-center text-muted-foreground">Traditional prayers, saved for offline use.</p>
      {PRAYER_GROUPS.map((group) => (
        <section key={group} aria-labelledby={`group-${group}`}>
          <SectionLabel className="mt-8 mb-2">
            <span id={`group-${group}`}>{group}</span>
          </SectionLabel>
          <ul className="divide-y divide-border">
            {PRAYERS.filter((p) => p.group === group).map((p) => (
              <li key={p.slug}>
                <Link
                  href={`/prayers/${p.slug}`}
                  className="flex min-h-11 items-center py-2 decoration-accent underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  {p.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
