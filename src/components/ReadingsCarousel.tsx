"use client";

import { useRef, useState } from "react";
import { SECTION_LABELS } from "@/lib/section-labels";
import type { ReadingKind } from "@/lib/types";

/** Horizontal scroll-snap cards (children, one per section) with a pill row that jumps to a card. */
export function ReadingsCarousel({ kinds, children }: { kinds: ReadingKind[]; children: React.ReactNode }) {
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

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
      <nav aria-label="Readings" className="mb-4 flex flex-wrap justify-center gap-2">
        {kinds.map((kind, i) => (
          <button
            key={i}
            type="button"
            onClick={() => jump(i)}
            aria-current={i === active ? "true" : undefined}
            className={`min-h-11 touch-manipulation rounded-full border px-4 text-sm tracking-[0.05em] transition-colors duration-200 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
              i === active
                ? "border-foreground bg-foreground text-background"
                : "border-border text-muted-foreground hover:border-accent hover:text-foreground"
            }`}
          >
            {SECTION_LABELS[kind]}
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
        {children}
      </div>
    </div>
  );
}
