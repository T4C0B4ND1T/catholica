'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { snippetParts } from '@/lib/bulletin-text';
import { formatDay } from '@/lib/dates';

interface Result {
  sundayDate: string;
  snippet: string;
}

type State = { status: 'idle' } | { status: 'loading' } | { status: 'done'; results: Result[] } | { status: 'error' };

export function BulletinSearch() {
  const [q, setQ] = useState('');
  const [state, setState] = useState<State>({ status: 'idle' });
  const term = q.trim();

  useEffect(() => {
    if (term.length < 2) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setState({ status: 'loading' });
      try {
        const res = await fetch(`/api/bulletins/search?q=${encodeURIComponent(term)}`, { signal: ctrl.signal });
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as { results: Result[] };
        setState({ status: 'done', results: body.results });
      } catch (e) {
        if (!ctrl.signal.aborted) setState({ status: 'error' });
        void e;
      }
    }, 300);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [term]);

  const active = term.length >= 2 ? state : ({ status: 'idle' } as State);

  return (
    <div>
      <label htmlFor="bulletin-search" className="sr-only">
        Search bulletins
      </label>
      <input
        id="bulletin-search"
        type="search"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setState({ status: 'idle' });
        }}
        placeholder="Search bulletins"
        autoComplete="off"
        className="h-12 w-full rounded-md border border-border bg-background px-4 text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      />
      <div aria-live="polite" className="mt-3">
        {active.status === 'loading' && <p className="text-muted-foreground">Searching…</p>}
        {active.status === 'error' && <p className="text-muted-foreground">Search is unavailable right now.</p>}
        {active.status === 'done' && active.results.length === 0 && (
          <p className="text-muted-foreground">No bulletins match “{term}”.</p>
        )}
        {active.status === 'done' && active.results.length > 0 && (
          <ul className="divide-y divide-border" data-testid="bulletin-results">
            {active.results.map((r) => (
              <li key={r.sundayDate}>
                <Link
                  href={`/bulletin/${r.sundayDate}`}
                  className="block min-h-11 py-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  <span className="font-display text-lg">{formatDay(r.sundayDate)}</span>
                  <span className="mt-1 block break-words text-sm text-muted-foreground">
                    {snippetParts(r.snippet).map((p, i) =>
                      p.mark ? (
                        <mark key={i} className="rounded-sm bg-accent-muted px-0.5 text-foreground">
                          {p.text}
                        </mark>
                      ) : (
                        <span key={i}>{p.text}</span>
                      ),
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
