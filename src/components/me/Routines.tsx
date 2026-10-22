"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowDown, ArrowUp, BookOpen, Check, Trash2 } from "lucide-react";
import { PRAYERS, prayerForName } from "@/data/prayers";
import { todayInChicago } from "@/lib/dates";
import { usePersonal } from "@/lib/offline/use-personal";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";

interface Routine {
  id: string;
  name: string;
  sort_order: number;
}
interface Tick {
  id: string;
  routine_id: string;
  date: string;
}

const field =
  "min-h-11 w-full min-w-0 rounded-md border border-border bg-background px-3 text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

/** One routine while editing: rename (saved on blur or Enter), move up or down, delete. */
function EditRow({
  routine,
  first,
  last,
  onRename,
  onMove,
  onDelete,
}: {
  routine: Routine;
  first: boolean;
  last: boolean;
  onRename: (name: string) => void;
  onMove: (by: -1 | 1) => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(routine.name);
  const commit = () => {
    const next = name.trim();
    if (next && next !== routine.name) onRename(next);
    else setName(routine.name);
  };
  return (
    <li className="flex items-center gap-1">
      <input
        aria-label={`Name of ${routine.name}`}
        value={name}
        maxLength={100}
        onChange={(e) => setName(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        className={field}
      />
      <IconButton label={`Move ${routine.name} up`} onClick={() => onMove(-1)} disabled={first}>
        <ArrowUp className="size-5" aria-hidden="true" />
      </IconButton>
      <IconButton label={`Move ${routine.name} down`} onClick={() => onMove(1)} disabled={last}>
        <ArrowDown className="size-5" aria-hidden="true" />
      </IconButton>
      <IconButton label={`Delete ${routine.name}`} onClick={onDelete}>
        <Trash2 className="size-5" aria-hidden="true" />
      </IconButton>
    </li>
  );
}

export function Routines() {
  const routines = usePersonal<Routine>("routines");
  const ticks = usePersonal<Tick>("routine_ticks");
  const today = todayInChicago();
  const sorted = [...routines.rows].sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id));
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  async function add() {
    const name = draft.trim();
    if (!name) return;
    const order = sorted.length ? sorted[sorted.length - 1].sort_order + 1 : 0;
    await routines.upsert({ id: crypto.randomUUID(), name, sort_order: order });
    setDraft("");
  }

  /** Swaps a routine with its neighbour, renumbering all so equal sort_order values never stall a move. */
  async function move(index: number, by: -1 | 1) {
    const next = [...sorted];
    const [item] = next.splice(index, 1);
    next.splice(index + by, 0, item);
    for (const [i, r] of next.entries()) {
      if (r.sort_order !== i) await routines.upsert({ ...r, sort_order: i });
    }
  }

  return (
    <section aria-labelledby="routines-title">
      <div className="flex items-center justify-between gap-3">
        <h2 id="routines-title" className="font-display text-xl">
          Daily prayers
        </h2>
        <Button variant="ghost" onClick={() => setEditing((e) => !e)} aria-pressed={editing}>
          {editing ? "Done" : "Edit"}
        </Button>
      </div>

      {editing ? (
        <>
          <ul className="mt-3 space-y-2">
            {sorted.map((r, i) => (
              <EditRow
                key={r.id}
                routine={r}
                first={i === 0}
                last={i === sorted.length - 1}
                onRename={(name) => routines.upsert({ ...r, name })}
                onMove={(by) => move(i, by)}
                onDelete={() => routines.remove(r.id)}
              />
            ))}
          </ul>
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void add();
            }}
          >
            <input
              aria-label="New prayer"
              placeholder="Add a prayer"
              list="prayer-names"
              value={draft}
              maxLength={100}
              onChange={(e) => setDraft(e.target.value)}
              className={field}
            />
            <datalist id="prayer-names">
              {PRAYERS.map((p) => (
                <option key={p.slug} value={p.title} />
              ))}
            </datalist>
            <Button type="submit" variant="outline" disabled={!draft.trim()}>
              Add
            </Button>
          </form>
        </>
      ) : (
        <ul className="mt-3 space-y-2">
          {sorted.map((r) => {
            const tick = ticks.rows.find((t) => t.routine_id === r.id && t.date === today);
            const prayer = prayerForName(r.name);
            return (
              <li key={r.id} className="flex items-center gap-1">
                <button
                  type="button"
                  aria-pressed={Boolean(tick)}
                  onClick={() =>
                    tick
                      ? ticks.remove(tick.id)
                      : ticks.upsert({ id: crypto.randomUUID(), routine_id: r.id, date: today })
                  }
                  className="flex min-h-11 min-w-0 flex-1 touch-manipulation items-center gap-3 rounded-md border border-border px-3 text-left transition-colors duration-200 ease-out hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <span
                    aria-hidden="true"
                    className={`flex size-6 shrink-0 items-center justify-center rounded-full border ${
                      tick ? "border-accent bg-accent text-accent-foreground" : "border-border"
                    }`}
                  >
                    {tick && <Check className="size-4" />}
                  </span>
                  <span className={tick ? "text-muted-foreground" : ""}>{r.name}</span>
                </button>
                {prayer && (
                  <Link
                    href={`/prayers/${prayer.slug}`}
                    aria-label={`Read the ${prayer.title}`}
                    className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors duration-200 ease-out hover:bg-muted hover:text-accent-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    <BookOpen className="size-5" aria-hidden="true" />
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {routines.ready && sorted.length === 0 && !editing && (
        <p className="mt-3 text-sm text-muted-foreground">No prayers yet. Tap Edit to add one.</p>
      )}
    </section>
  );
}
