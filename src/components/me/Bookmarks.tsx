"use client";

import Link from "next/link";
import { Trash2 } from "lucide-react";
import { formatDay } from "@/lib/dates";
import { usePersonal } from "@/lib/offline/use-personal";
import { SECTION_LABELS, type BookmarkRow } from "@/components/BookmarkButton";
import { IconButton } from "@/components/ui/IconButton";

export function Bookmarks() {
  const { rows, remove, ready } = usePersonal<BookmarkRow>("bookmarks");
  const sorted = [...rows].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <section aria-labelledby="bookmarks-title">
      <h2 id="bookmarks-title" className="font-display text-xl">
        Bookmarks
      </h2>
      {ready && sorted.length === 0 && (
        <p className="mt-3 text-sm text-muted-foreground">Bookmark a reading from the Mass tab and it will appear here.</p>
      )}
      <ul className="mt-3">
        {sorted.map((b) => (
          <li key={b.id} className="flex items-center gap-1 border-t border-border first:border-t-0">
            <Link
              href={`/?date=${b.date}`}
              className="flex min-h-11 min-w-0 flex-1 flex-col justify-center py-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              <span>{formatDay(b.date)}</span>
              <span className="text-sm text-muted-foreground">{SECTION_LABELS[b.section] ?? b.section}</span>
            </Link>
            <IconButton
              label={`Remove bookmark ${formatDay(b.date)} ${SECTION_LABELS[b.section] ?? b.section}`}
              onClick={() => remove(b.id)}
            >
              <Trash2 className="size-5" aria-hidden="true" />
            </IconButton>
          </li>
        ))}
      </ul>
    </section>
  );
}
