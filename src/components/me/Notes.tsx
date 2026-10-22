"use client";

import { Download, Trash2 } from "lucide-react";
import { formatDay, todayInChicago } from "@/lib/dates";
import { usePersonal } from "@/lib/offline/use-personal";
import { NoteEditor, type Note } from "@/components/NoteEditor";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { notesMarkdown } from "@/lib/me/export";

export function Notes() {
  const { rows, remove } = usePersonal<Note>("notes");
  const today = todayInChicago();
  const earlier = rows.filter((n) => n.date !== today).sort((a, b) => b.date.localeCompare(a.date));

  function download() {
    const url = URL.createObjectURL(new Blob([notesMarkdown(rows)], { type: "text/markdown" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `catholica-notes-${today}.md`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <section aria-labelledby="notes-title">
      <div className="flex items-center justify-between gap-3">
        <h2 id="notes-title" className="font-display text-xl">
          Notes
        </h2>
        {rows.some((n) => n.body.trim()) && (
          <Button variant="ghost" onClick={download}>
            <Download className="size-4" aria-hidden="true" />
            Download
          </Button>
        )}
      </div>
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
