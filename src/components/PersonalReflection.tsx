"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";

interface Personal {
  text: string;
  createdAt: string;
}

type State =
  | { kind: "loading" }
  | { kind: "hidden" }
  | { kind: "ready"; personal: Personal | null }
  | { kind: "writing"; personal: Personal | null }
  | { kind: "failed"; personal: Personal | null };

/**
 * The signed-in reader's own reflection for the day, written by AI from the readings, their recent notes and their
 * open intentions. Hidden when signed out or offline. The daily job writes today's and Sunday's; a button writes or
 * rewrites it on demand (after adding a note, say).
 */
export function PersonalReflection({ date }: { date: string }) {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/reflection/personal/${date}`)
      .then(async (res) => {
        if (cancelled) return;
        if (!res.ok) return setState({ kind: "hidden" });
        const body = (await res.json()) as { personal: Personal | null };
        if (!cancelled) setState({ kind: "ready", personal: body.personal });
      })
      .catch(() => !cancelled && setState({ kind: "hidden" }));
    return () => {
      cancelled = true;
    };
  }, [date]);

  if (state.kind === "loading" || state.kind === "hidden") return null;
  const personal = state.personal;

  async function write() {
    setState({ kind: "writing", personal });
    try {
      const res = await fetch(`/api/reflection/personal/${date}`, { method: "POST" });
      if (!res.ok) throw new Error(String(res.status));
      const body = (await res.json()) as { personal: Personal | null };
      setState({ kind: "ready", personal: body.personal });
    } catch {
      setState({ kind: "failed", personal });
    }
  }

  return (
    <section className="mt-5" data-testid="personal-reflection" aria-busy={state.kind === "writing"}>
      <h3 className="small-caps text-sm text-muted-foreground">For you</h3>
      {personal ? (
        <p className="mt-1 whitespace-pre-line">{personal.text}</p>
      ) : (
        <p className="mt-1 text-sm text-muted-foreground">
          A reflection written from today&apos;s readings, your recent notes and your open intentions.
        </p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <Button variant="ghost" className="px-0" onClick={write} disabled={state.kind === "writing"}>
          {state.kind === "writing" ? "Writing…" : personal ? "Rewrite with my latest notes" : "Write my reflection"}
        </Button>
        {state.kind === "failed" && (
          <p role="status" className="text-sm text-muted-foreground">
            Couldn&apos;t write it right now. Try again in a minute.
          </p>
        )}
      </div>
    </section>
  );
}
