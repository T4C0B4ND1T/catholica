-- The biblical theology insight, Catechism connections and prayer prompt (AI) beside each day's reflection.
-- Nullable and written only by the service role, like the rest of reflections.

alter table public.reflections add column insights jsonb;
