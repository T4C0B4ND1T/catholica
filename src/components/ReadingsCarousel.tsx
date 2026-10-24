"use client";

import { useRef, useState } from "react";
import { ReadingCard } from "@/components/ReadingCard";
import { defaultMass, massNames, massSections, sectionForKind } from "@/lib/mass-options";
import type { ReadingSection, StudyGuide } from "@/lib/types";

/**
 * Horizontal scroll-snap cards, one per section, with a pill row that jumps to a card. On a day of several Masses
 * (Christmas, a Vigil and Day) a Mass picker above the pills chooses which Mass's sections are shown. Each card carries
 * its reading's study notes when the day has a study guide.
 */
export function ReadingsCarousel({
  date,
  sections,
  study = null,
}: {
  date: string;
  sections: ReadingSection[];
  study?: StudyGuide | null;
}) {
  const track = useRef<HTMLDivElement>(null);
  const masses = massNames(sections);
  const [mass, setMass] = useState<string | null>(() => defaultMass(sections));
  const [active, setActive] = useState(0);
  const shown = massSections(sections, masses.length > 1 ? mass : null);

  function chooseMass(name: string) {
    setMass(name);
    setActive(0);
    track.current?.scrollTo({ left: 0, behavior: "auto" });
  }

  function jump(i: number) {
    const el = track.current;
    const card = el?.children[i] as HTMLElement | undefined;
    if (!el || !card) return;
    setActive(i);
    el.scrollTo({ left: card.offsetLeft, behavior: "auto" });
  }

  function onScroll() {
    const el = track.current;
    if (!el) return;
    let best = 0;
    let bestDist = Infinity;
    Array.from(el.children).forEach((c, i) => {
      const d = Math.abs((c as HTMLElement).offsetLeft - el.scrollLeft);
      if (d < bestDist) {
        best = i;
        bestDist = d;
      }
    });
    setActive(best);
  }

  return (
    <div>
      {masses.length > 1 && (
        <div role="group" aria-label="Mass" data-testid="mass-picker" className="mb-4 flex flex-wrap justify-center gap-2">
          {masses.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => chooseMass(name)}
              aria-pressed={name === mass}
              className={`min-h-11 touch-manipulation rounded-md border px-3 text-sm transition-colors duration-200 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
                name === mass
                  ? "border-accent bg-muted text-foreground"
                  : "border-border text-muted-foreground hover:border-accent hover:text-foreground"
              }`}
            >
              {name}
            </button>
          ))}
        </div>
      )}
      <nav aria-label="Readings" className="mb-4 flex flex-wrap justify-center gap-2">
        {shown.map((m, i) => (
          <button
            key={m.index}
            type="button"
            onClick={() => jump(i)}
            aria-current={i === active ? "true" : undefined}
            className={`min-h-11 touch-manipulation rounded-full border px-4 text-sm tracking-[0.05em] transition-colors duration-200 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
              i === active
                ? "border-foreground bg-foreground text-background"
                : "border-border text-muted-foreground hover:border-accent hover:text-foreground"
            }`}
          >
            {m.label}
          </button>
        ))}
      </nav>
      <div
        ref={track}
        onScroll={onScroll}
        role="region"
        aria-label="Readings carousel"
        tabIndex={0}
        className="relative flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain pb-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        {shown.map((m) => (
          <ReadingCard
            key={m.index}
            date={date}
            item={m}
            legacyKind={sectionForKind(sections, m.section.kind)?.index === m.index ? m.section.kind : undefined}
            study={study?.readings.find((r) => r.index === m.index)}
          />
        ))}
      </div>
    </div>
  );
}
