# Kung Bulle backend (Supabase)

The game is a static page. Live answers go to a Supabase Postgres database through two RPC functions. Until you connect a backend, the game runs in **offline mock mode**: scores are calculated against the popularity priors in `content/prompts.json` and the answers stored in your own browser.

## Set up (about 10 minutes)

1. Create a free project at [supabase.com](https://supabase.com). Pick an EU region (Stockholm or Frankfurt) to keep the data inside the EU.
2. In **SQL Editor**, paste and run [`migrations/001_init.sql`](migrations/001_init.sql).
3. Under **Project Settings → API**, copy the **Project URL** and the **anon public** key.
4. Put both in [`../js/config.js`](../js/config.js):
   ```js
   SUPABASE_URL: 'https://xxxx.supabase.co',
   SUPABASE_ANON_KEY: 'eyJ…',
   ```
5. Commit and push. The start screen shows a red **Live** dot when the connection works.

The anon key is meant to be public. The table has row-level security enabled with no policies, so the key can only call `kb_submit` and `kb_stats`, and those return only aggregated data.

## What gets stored

| column | source | why |
|---|---|---|
| `prompt_id`, `answer_id` | game | the uniqueness count |
| `raw` (≤ 60 chars) | what the player typed | to grow the answer lists (see `kb_rejected_answers`) |
| `session_id` | random UUID in localStorage | one answer per player, prompt and day |
| `country` | `cf-ipcountry` request header, when the platform forwards it | "where do players answer from" |
| `timezone`, `lang` | browser `Intl` / `navigator.language` | rough region without asking for location permission |

IP addresses and exact positions are not stored. See [`../privacy.html`](../privacy.html).

> **Note on country:** whether Supabase forwards `cf-ipcountry` to Postgres depends on the platform setup. If `country` stays empty, timezone is the fallback. For reliable country data, put a Cloudflare Worker or a Supabase Edge Function in front of `kb_submit` and pass the country from the edge (see Roadmap).

## Looking at the data

Run these in the SQL editor:

```sql
-- Answers we rejected, most common first → add good ones as `aka` in prompts.json
select * from kb_rejected_answers limit 50;

-- Players per day and country
select * from kb_daily_by_country limit 50;

-- Distribution for one prompt
select answer_id, count(*) from kb_answers where prompt_id = 'midsommar' group by 1 order by 2 desc;
```

## Roadmap

- **Abuse protection:** the anon RPC can be spammed. Before a big launch, route `kb_submit` through an Edge Function with rate limiting per IP (hashed, not stored) and optionally Cloudflare Turnstile.
- **Edge geo:** derive the country in an Edge Function or Worker so it doesn't depend on header forwarding.
- **Realtime:** stream today's top answers with Supabase Realtime on an aggregated table.
- **Ads (later):** need a custom domain, an AdSense account and a GDPR consent banner (CMP) before any ad script loads.
