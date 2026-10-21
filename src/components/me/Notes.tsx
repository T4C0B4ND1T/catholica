"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { formatDay, todayInChicago } from "@/lib/dates";
import { usePersonal } from "@/lib/offline/use-personal";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";

interface Note {
  id: string;
  date: string;
  body: string;
}

export function Notes() {
  const { rows, upsert, remove } = usePersonal<Note>("notes");
  const today = todayInChicago();
  const current = rows.find((n) => n.date === today);
  const [draft, setDraft] = useState<string | null>(null);
  const value = draft ?? current?.body ?? "";
  const earlier = rows.filter((n) => n.date !== today).sort((a, b) => b.date.localeCompare(a.date));

  async function save() {
    await upsert({ id: current?.id ?? crypto.randomUUID(), date: today, body: value });
    setDraft(null);
  }

  return (
    <section aria-labelledby="notes-title">
      <h2 id="notes-title" className="font-display text-xl">
        Notes
      </h2>
      <label htmlFor="note-today" className="mt-3 block text-sm text-muted-foreground">
        {formatDay(today)}
      </label>
      <textarea
        id="note-today"
        rows={4}
        value={value}
        onChange={(e) => setDraft(e.target.value)}
        className="mt-1 w-full rounded-md border border-border bg-background p-3 text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      />
      <Button className="mt-2" variant="outline" onClick={save} disabled={draft === null}>
        Save note
      </Button>
      {earlier.length > 0 && (
        <ul className="mt-6 space-y-4">
          {earlier.map((n) => (
            <li key={n.id} className="flex items-start gap-2 border-t border-border pt-3">
              <div className="min-w-0 flex-1">
                <p className="small-caps text-sm text-muted-foreground">{formatDay(n.date)}</p>
                <p className="mt-1 whitespace-pre-line break-words">{n.body}</p>
              </div>
              <IconButton label={`Delete note from ${formatDay(n.date)}`} onClick={() => remove(n.id)}>
                <Trash2 className="size-5" aria-hidden="true" />
              </IconButton>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
