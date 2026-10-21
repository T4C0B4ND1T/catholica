"use client";

import { useState } from "react";
import { Check, Trash2 } from "lucide-react";
import { usePersonal } from "@/lib/offline/use-personal";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";

interface Intention {
  id: string;
  text: string;
  answered_at: string | null;
  created_at?: string;
}

export function Intentions() {
  const { rows, upsert, remove } = usePersonal<Intention>("intentions");
  const [text, setText] = useState("");
  const sorted = [...rows].sort((a, b) =>
    Number(Boolean(a.answered_at)) - Number(Boolean(b.answered_at)) ||
    (b.created_at ?? "").localeCompare(a.created_at ?? ""),
  );

  function add(e: React.FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    upsert({ id: crypto.randomUUID(), text: t, answered_at: null, created_at: new Date().toISOString() });
    setText("");
  }

  return (
    <section aria-labelledby="intentions-title">
      <h2 id="intentions-title" className="font-display text-xl">
        Intentions
      </h2>
      <form onSubmit={add} className="mt-3 flex gap-2">
        <input
          aria-label="New intention"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={2000}
          className="min-h-11 min-w-0 flex-1 rounded-md border border-border bg-background px-3 text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        />
        <Button type="submit" variant="outline" disabled={!text.trim()}>
          Add
        </Button>
      </form>
      <ul className="mt-3 space-y-2">
        {sorted.map((i) => {
          const answered = Boolean(i.answered_at);
          return (
            <li key={i.id} className="flex items-center gap-1">
              <button
                type="button"
                aria-pressed={answered}
                aria-label={`Answered: ${i.text}`}
                onClick={() =>
                  upsert({ ...i, answered_at: answered ? null : new Date().toISOString() })
                }
                className="inline-flex size-11 shrink-0 touch-manipulation items-center justify-center rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <span
                  aria-hidden="true"
                  className={`flex size-6 items-center justify-center rounded-full border ${
                    answered ? "border-accent bg-accent text-accent-foreground" : "border-border"
                  }`}
                >
                  {answered && <Check className="size-4" />}
                </span>
              </button>
              <span className={`min-w-0 flex-1 break-words ${answered ? "text-muted-foreground line-through" : ""}`}>
                {i.text}
              </span>
              <IconButton label={`Delete intention: ${i.text}`} onClick={() => remove(i.id)}>
                <Trash2 className="size-5" aria-hidden="true" />
              </IconButton>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
