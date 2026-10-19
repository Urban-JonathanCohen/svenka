// Provider-neutral LLM client. The browser calls the provider directly with the
// user's own key (stored only in localStorage). When the app becomes a service,
// replace `callProvider` with a call to our own server-side proxy.
//
// Plain fetch (no SDK) because the app has no build step.

import { getSettings } from './state.js';

export const PROVIDERS = {
  anthropic: { label: 'Anthropic (Claude)', defaultModel: 'claude-opus-5-5' },
  openai: { label: 'OpenAI', defaultModel: 'gpt-5-mini' },
};

export class LLMError extends Error {}

/**
 * Ask the model for a JSON object.
 * @param {{system: string, prompt: string, maxTokens?: number}} req
 */
export async function askJSON({ system, prompt, maxTokens = 16000 }) {
  const text = await complete({
    system: `${system}\n\nSvara ENDAST med ett giltigt JSON-objekt, utan markdown eller annan text.`,
    prompt,
    maxTokens,
    json: true,
  });
  return parseJSON(text);
}

export async function complete({ system, prompt, maxTokens = 16000, json = false }) {
  const s = getSettings();
  if (s.provider === 'none' || !s.apiKey) {
    throw new LLMError('Ingen API-nyckel är inställd. Lägg till en under Inställningar.');
  }
  const model = s.model || PROVIDERS[s.provider].defaultModel;
  if (s.provider === 'anthropic') return callAnthropic({ key: s.apiKey, model, system, prompt, maxTokens });
  if (s.provider === 'openai') return callOpenAI({ key: s.apiKey, model, system, prompt, maxTokens, json });
  throw new LLMError(`Okänd leverantör: ${s.provider}`);
}

async function callAnthropic({ key, model, system, prompt, maxTokens }) {
  const body = {
    model,
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: prompt }],
    output_config: { effort: 'medium' },
    // Server-side refusal fallback: if a classifier declines, the API retries on a suitable model.
    fallbacks: 'default',
  };
  const headers = {
    'content-type': 'application/json',
    'x-api-key': key,
    'anthropic-version': '2023-06-01',
    'anthropic-dangerous-direct-browser-access': 'true',
    'anthropic-beta': 'server-side-fallback-2026-07-01',
  };

  let res;
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers, body: JSON.stringify(body) });
  } catch {
    // Network/CORS failure: retry once without the beta feature.
    delete body.fallbacks;
    delete headers['anthropic-beta'];
    res = await safeFetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers, body: JSON.stringify(body) });
  }
  const data = await readResponse(res);
  if (data.stop_reason === 'refusal') {
    throw new LLMError('Modellen avböjde att svara på den här texten. Försök formulera om.');
  }
  return (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
}

async function callOpenAI({ key, model, system, prompt, maxTokens, json }) {
  const body = {
    model,
    max_completion_tokens: maxTokens,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: prompt },
    ],
  };
  if (json) body.response_format = { type: 'json_object' };
  const res = await safeFetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
  });
  const data = await readResponse(res);
  return data.choices?.[0]?.message?.content || '';
}

async function safeFetch(url, opts) {
  try {
    return await fetch(url, opts);
  } catch {
    throw new LLMError('Kunde inte nå AI-tjänsten. Kontrollera internetanslutningen.');
  }
}

async function readResponse(res) {
  let data = null;
  try { data = await res.json(); } catch { /* non-JSON body */ }
  if (!res.ok) {
    const msg = data?.error?.message || res.statusText;
    if (res.status === 401) throw new LLMError('API-nyckeln godtogs inte (401). Kontrollera den under Inställningar.');
    if (res.status === 429) throw new LLMError('För många anrop just nu (429). Vänta en stund och försök igen.');
    throw new LLMError(`AI-tjänsten svarade med fel ${res.status}: ${msg}`);
  }
  return data;
}

export function parseJSON(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) throw new LLMError('Svaret från AI:n gick inte att tolka.');
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new LLMError('Svaret från AI:n gick inte att tolka.');
  }
}
