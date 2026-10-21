"use client";

import { Bookmark } from "lucide-react";
import type { ReadingKind } from "@/lib/types";
import { SECTION_LABELS } from "@/lib/section-labels";
import { usePersonal } from "@/lib/offline/use-personal";

export interface BookmarkRow {
  id: string;
  date: string;
  section: ReadingKind;
}

export function BookmarkButton({ date, section }: { date: string; section: ReadingKind }) {
  const { rows, upsert, remove, signedIn } = usePersonal<BookmarkRow>("bookmarks");
  const existing = rows.find((r) => r.date === date && r.section === section);
  const pressed = Boolean(existing);
  const disabled = signedIn === false;
  const label = disabled
    ? "Sign in on the Me tab to bookmark"
    : `Bookmark ${SECTION_LABELS[section]}`;

  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={() =>
        existing ? remove(existing.id) : upsert({ id: crypto.randomUUID(), date, section })
      }
      className="inline-flex size-11 shrink-0 touch-manipulation items-center justify-center rounded-md text-muted-foreground transition-colors duration-200 ease-out hover:bg-muted hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50"
    >
      <Bookmark aria-hidden="true" className={pressed ? "size-5 fill-accent text-accent" : "size-5"} />
    </button>
  );
}
