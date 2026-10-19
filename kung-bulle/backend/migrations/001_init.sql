-- Kung Bulle: answers table + RPC functions.
-- Run in the Supabase SQL editor (or `supabase db push`).
--
-- Security model: the table has RLS enabled and NO policies, so the public
-- anon key cannot read or write it directly. The browser can only call the
-- SECURITY DEFINER functions below, which validate input and return
-- aggregated data only.

create table if not exists public.kb_answers (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  play_date   date not null default ((now() at time zone 'Europe/Stockholm')::date),
  session_id  uuid not null,
  prompt_id   text not null check (prompt_id ~ '^[a-z0-9-]{1,64}$'),
  answer_id   text check (answer_id is null or answer_id ~ '^[a-z0-9-]{1,64}$'), -- null = not accepted
  raw         text check (char_length(raw) <= 60),
  country     text check (country is null or country ~ '^[A-Z]{2}$'),
  timezone    text check (char_length(timezone) <= 64),
  lang        text check (char_length(lang) <= 16)
);

-- One answer per player, prompt and day.
create unique index if not exists kb_answers_once
  on public.kb_answers (session_id, prompt_id, play_date);
create index if not exists kb_answers_prompt on public.kb_answers (prompt_id, answer_id);
create index if not exists kb_answers_date on public.kb_answers (play_date);

alter table public.kb_answers enable row level security;
revoke all on public.kb_answers from anon, authenticated;

-- Submit an answer and get the live distribution for that prompt back.
create or replace function public.kb_submit(
  p_session uuid,
  p_prompt  text,
  p_answer  text,
  p_raw     text,
  p_tz      text default null,
  p_lang    text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_headers jsonb;
  v_country text;
  v_result  jsonb;
begin
  -- Country from the edge network if the platform forwards it (Cloudflare: cf-ipcountry).
  begin
    v_headers := current_setting('request.headers', true)::jsonb;
  exception when others then
    v_headers := '{}'::jsonb;
  end;
  v_country := upper(nullif(coalesce(v_headers ->> 'cf-ipcountry', v_headers ->> 'x-vercel-ip-country', ''), ''));
  if v_country !~ '^[A-Z]{2}$' then v_country := null; end if;

  insert into kb_answers (session_id, prompt_id, answer_id, raw, country, timezone, lang)
  values (p_session, p_prompt, nullif(p_answer, ''), left(p_raw, 60), v_country, left(p_tz, 64), left(p_lang, 16))
  on conflict do nothing;

  select jsonb_build_object(
    'total',  coalesce(sum(n), 0),
    'counts', coalesce(jsonb_object_agg(answer_id, n), '{}'::jsonb)
  )
  into v_result
  from (
    select answer_id, count(*)::int as n
    from kb_answers
    where prompt_id = p_prompt and answer_id is not null
    group by answer_id
  ) s;

  return v_result;
end;
$$;

-- Aggregated, anonymous live stats for the start screen.
create or replace function public.kb_stats()
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  with today as (
    select * from kb_answers
    where play_date = (now() at time zone 'Europe/Stockholm')::date
  )
  select jsonb_build_object(
    'playersToday', (select count(distinct session_id) from today),
    'answersToday', (select count(*) from today),
    'countries', coalesce((
      select jsonb_agg(jsonb_build_object('country', country, 'n', n) order by n desc)
      from (select country, count(distinct session_id) as n from today where country is not null group by country) c
    ), '[]'::jsonb)
  );
$$;

revoke all on function public.kb_submit(uuid, text, text, text, text, text) from public;
revoke all on function public.kb_stats() from public;
grant execute on function public.kb_submit(uuid, text, text, text, text, text) to anon, authenticated;
grant execute on function public.kb_stats() to anon, authenticated;

-- Analyst views (not exposed to anon): use them from the SQL editor / dashboard.
create or replace view public.kb_rejected_answers as
  select prompt_id, lower(raw) as raw, count(*) as n
  from kb_answers
  where answer_id is null and raw <> ''
  group by prompt_id, lower(raw)
  order by n desc;

create or replace view public.kb_daily_by_country as
  select play_date, coalesce(country, '??') as country, count(distinct session_id) as players, count(*) as answers
  from kb_answers
  group by play_date, country
  order by play_date desc, players desc;

revoke all on public.kb_rejected_answers from anon, authenticated;
revoke all on public.kb_daily_by_country from anon, authenticated;
