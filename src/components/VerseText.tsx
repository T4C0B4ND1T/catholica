import type { VerseMark } from "@/lib/types";
import { verseRuns } from "@/lib/verses";

/**
 * A reading's text with its verse numbers set as small superscripts before each verse. "Chapter:verse" shows at the
 * first verse and wherever the chapter changes; the words themselves are exactly the saved text.
 */
export function VerseText({ text, verses }: { text: string; verses?: VerseMark[] }) {
  return (
    <>
      {verseRuns(text, verses).map((run, i) => (
        <span key={i}>
          {run.label && (
            <sup
              data-verse={run.label}
              className="mr-[0.2em] font-sans text-[0.6em] font-semibold tabular-nums text-accent-ink"
            >
              {run.label}
            </sup>
          )}
          {run.text}
        </span>
      ))}
    </>
  );
}
