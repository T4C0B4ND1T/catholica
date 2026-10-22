-- Sunday prep questions (AI, beside the reflection) and an AI summary of each bulletin's text.
-- Both are nullable and written only by the service role, like the rest of reflections and bulletins.

alter table public.reflections add column questions jsonb;

alter table public.bulletins add column summary jsonb;
