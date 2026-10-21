-- Full-text search over saved bulletins: newest first, at most 20 rows, <mark> highlighted snippets.
-- SECURITY INVOKER (default): the public-read RLS policy on bulletins applies to the caller.
create or replace function public.search_bulletins(q text)
returns table (sunday_date date, snippet text)
language sql
stable
set search_path = public, pg_temp
as $$
  select b.sunday_date,
         ts_headline(
           'english', coalesce(b.text, ''), websearch_to_tsquery('english', q),
           'StartSel=<mark>, StopSel=</mark>, MaxWords=30, MinWords=12, MaxFragments=1'
         ) as snippet
  from public.bulletins b
  where b.text_search @@ websearch_to_tsquery('english', q)
  order by b.sunday_date desc
  limit 20;
$$;

revoke all on function public.search_bulletins(text) from public;
grant execute on function public.search_bulletins(text) to anon, authenticated;
