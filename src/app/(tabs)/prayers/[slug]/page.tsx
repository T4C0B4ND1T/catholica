import Link from "next/link";
import { notFound } from "next/navigation";
import { RosaryGuide } from "@/components/RosaryGuide";
import { SpeakButton } from "@/components/SpeakButton";
import { Card } from "@/components/ui/Card";
import { PRAYERS, prayerBySlug, prayerParagraphs } from "@/data/prayers";

export function generateStaticParams() {
  return PRAYERS.map((p) => ({ slug: p.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const prayer = prayerBySlug((await params).slug);
  return { title: prayer ? `${prayer.title} · Catholica` : "Prayers · Catholica" };
}

/** Speech reads "V." and "R." as letters; drop them. */
const spoken = (text: string) => text.replace(/^[VR]\. /gm, "");

export default async function PrayerPage({ params }: { params: Promise<{ slug: string }> }) {
  const prayer = prayerBySlug((await params).slug);
  if (!prayer) notFound();

  return (
    <>
      <Link
        href="/prayers"
        className="inline-flex min-h-11 items-center text-muted-foreground underline decoration-accent underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        All prayers
      </Link>
      <h1 className="mt-2 text-center font-display text-[2rem] leading-[1.1] tracking-[-0.02em]">{prayer.title}</h1>
      {prayer.note && <p className="mt-2 text-center text-muted-foreground">{prayer.note}</p>}
      <div className="mt-6">
        {prayer.slug === "rosary" ? (
          <RosaryGuide />
        ) : (
          <Card>
            <div className="-mr-2 -mt-2 flex justify-end">
              <SpeakButton label={prayer.title} text={`${prayer.title}. ${spoken(prayer.text)}`} />
            </div>
            <div className="space-y-4 text-[length:calc(19px*var(--text-scale,1))] leading-[1.75]" data-testid="prayer-text">
              {prayerParagraphs(prayer).map((para) => (
                <p key={para} className="whitespace-pre-line">
                  {para}
                </p>
              ))}
            </div>
          </Card>
        )}
      </div>
    </>
  );
}
