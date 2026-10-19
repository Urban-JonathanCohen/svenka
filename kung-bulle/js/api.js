// Backend adapter. Two implementations with the same interface:
//   - Supabase (live): answers are stored centrally, counts are shared by all players.
//   - Mock (offline): counts live in localStorage, seeded by the priors.
//
// interface:
//   submit({ promptId, answerId|null, raw }) -> { counts: {answerId: n}, total }
//   stats() -> { playersToday, answersToday, countries: [{country, n}] } | null
//   live: boolean

import { CONFIG } from './config.js';

const SESSION_KEY = 'kb:session';
const MOCK_KEY = 'kb:mock-counts';

export function sessionId() {
  let id = safeGet(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    safeSet(SESSION_KEY, id);
  }
  return id;
}

function clientMeta() {
  return {
    p_tz: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
    p_lang: navigator.language || null,
  };
}

const supabase = {
  live: true,
  async rpc(fn, body) {
    const res = await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        apikey: CONFIG.SUPABASE_ANON_KEY,
        authorization: `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Backend ${res.status}`);
    return res.json();
  },
  async submit({ promptId, answerId, raw }) {
    return this.rpc('kb_submit', {
      p_session: sessionId(), p_prompt: promptId, p_answer: answerId, p_raw: raw.slice(0, 60), ...clientMeta(),
    });
  },
  async stats() {
    return this.rpc('kb_stats', {});
  },
};

const mock = {
  live: false,
  async submit({ promptId, answerId }) {
    const all = safeJSON(MOCK_KEY, {});
    const counts = all[promptId] || {};
    if (answerId) counts[answerId] = (counts[answerId] || 0) + 1;
    all[promptId] = counts;
    safeSet(MOCK_KEY, JSON.stringify(all));
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    return { counts, total };
  },
  async stats() {
    return null;
  },
};

export const api = CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY ? supabase : mock;

/** Submit, falling back to mock if the backend is unreachable so the game never blocks. */
export async function submitAnswer(payload) {
  try {
    return { ...(await api.submit(payload)), live: api.live };
  } catch (err) {
    console.warn('Backend unavailable, using local counts', err);
    return { ...(await mock.submit(payload)), live: false };
  }
}

// --- storage helpers (private mode / blocked storage must not break the game) ---
function safeGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
function safeSet(k, v) { try { localStorage.setItem(k, v); } catch { /* ignore */ } }
function safeJSON(k, fallback) { try { return JSON.parse(localStorage.getItem(k)) ?? fallback; } catch { return fallback; } }
