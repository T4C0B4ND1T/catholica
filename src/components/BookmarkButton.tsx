"use client";

import { Bookmark } from "lucide-react";
import type { ReadingKind } from "@/lib/types";
import { usePersonal } from "@/lib/offline/use-personal";

export interface BookmarkRow {
  id: string;
  date: string;
  /** `index|label` (see bookmarkKey in src/lib/mass-options.ts), or a bare kind in bookmarks saved before that. */
  section: string;
}

/**
 * Bookmarks one section of a day by its stable key. `legacyKind` is set on the one section an older kind-only
 * bookmark meant (the first of that kind in the default Mass), so such a bookmark still shows as pressed.
 */
export function BookmarkButton({
  date,
  sectionKey,
  label,
  legacyKind,
}: {
  date: string;
  sectionKey: string;
  label: string;
  legacyKind?: ReadingKind;
}) {
  const { rows, upsert, remove, signedIn } = usePersonal<BookmarkRow>("bookmarks");
  const existing = rows.find(
    (r) => r.date === date && (r.section === sectionKey || (legacyKind !== undefined && r.section === legacyKind)),
  );
  const pressed = Boolean(existing);
  const disabled = signedIn === false;
  const ariaLabel = disabled ? "Sign in on the Me tab to bookmark" : `Bookmark ${label}`;

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={() =>
        existing ? remove(existing.id) : upsert({ id: crypto.randomUUID(), date, section: sectionKey })
      }
      className="inline-flex size-11 shrink-0 touch-manipulation items-center justify-center rounded-md text-muted-foreground transition-colors duration-200 ease-out hover:bg-muted hover:text-accent-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50"
    >
      <Bookmark aria-hidden="true" className={pressed ? "size-5 fill-accent-ink text-accent-ink" : "size-5"} />
    </button>
  );
}
