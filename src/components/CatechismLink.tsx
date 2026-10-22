"use client";

import { useState } from "react";
import type { CatechismParagraph } from "@/lib/sources/catechism";

/** A Catechism paragraph number that opens the paragraph's real text in place. */
export function CatechismLink({ paragraph }: { paragraph: number }) {
  const [state, setState] = useState<{ para?: CatechismParagraph; error?: boolean; open: boolean }>({ open: false });

  async function toggle() {
    if (state.open) return setState((s) => ({ ...s, open: false }));
    setState((s) => ({ ...s, open: true }));
    if (state.para) return;
    try {
      const res = await fetch(`/api/catechism/${paragraph}`);
      if (!res.ok) throw new Error();
      setState({ para: (await res.json()) as CatechismParagraph, open: true });
    } catch {
      setState({ error: true, open: true });
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={state.open}
        className="inline-flex min-h-11 touch-manipulation items-center rounded-md border border-border px-3 text-sm text-accent-ink hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        CCC {paragraph}
      </button>
      {state.open && (
        <blockquote className="mt-2 border-l-2 border-accent pl-3 text-sm">
          {state.para ? (
            <>
              <p>{state.para.text}</p>
              <p className="mt-1 text-muted-foreground">Catechism of the Catholic Church, {paragraph}</p>
            </>
          ) : state.error ? (
            <p className="text-muted-foreground">Could not load the paragraph. Check your connection and try again.</p>
          ) : (
            <p className="text-muted-foreground">Loading…</p>
          )}
        </blockquote>
      )}
    </>
  );
}
