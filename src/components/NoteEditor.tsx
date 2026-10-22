"use client";

import { useState } from "react";
import { usePersonal } from "@/lib/offline/use-personal";
import { Button } from "@/components/ui/Button";

export interface Note {
  id: string;
  date: string;
  body: string;
}

/** The one note kept for a day (notes are unique per day). Saved offline first, synced when there is signal. */
export function NoteEditor({ date, label, rows = 4 }: { date: string; label: string; rows?: number }) {
  const { rows: notes, upsert, signedIn } = usePersonal<Note>("notes");
  const current = notes.find((n) => n.date === date);
  const [draft, setDraft] = useState<string | null>(null);
  const value = draft ?? current?.body ?? "";
  const id = `note-${date}`;

  async function save() {
    await upsert({ id: current?.id ?? crypto.randomUUID(), date, body: value });
    setDraft(null);
  }

  if (signedIn === false) {
    return <p className="text-sm text-muted-foreground">Sign in on the Me tab to keep a note for this day.</p>;
  }

  return (
    <div>
      <label htmlFor={id} className="block text-sm text-muted-foreground">
        {label}
      </label>
      <textarea
        id={id}
        rows={rows}
        value={value}
        onChange={(e) => setDraft(e.target.value)}
        className="mt-1 w-full rounded-md border border-border bg-background p-3 text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      />
      <Button className="mt-2" variant="outline" onClick={save} disabled={draft === null}>
        Save note
      </Button>
    </div>
  );
}
