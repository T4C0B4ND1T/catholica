"use client";

import { Trash2 } from "lucide-react";
import { formatDay, todayInChicago } from "@/lib/dates";
import { usePersonal } from "@/lib/offline/use-personal";
import { NoteEditor, type Note } from "@/components/NoteEditor";
import { IconButton } from "@/components/ui/IconButton";

export function Notes() {
  const { rows, remove } = usePersonal<Note>("notes");
  const today = todayInChicago();
  const earlier = rows.filter((n) => n.date !== today).sort((a, b) => b.date.localeCompare(a.date));

  return (
    <section aria-labelledby="notes-title">
      <h2 id="notes-title" className="font-display text-xl">
        Notes
      </h2>
      <div className="mt-3">
        <NoteEditor date={today} label={formatDay(today)} />
      </div>
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
