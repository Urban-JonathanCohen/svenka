// Free-text answer matching. Forgives missing å/ä/ö, small typos, articles
// and common Swedish plural/definite endings, and finds an accepted answer
// inside a longer phrase ("en stor älg" -> Älg).

export function slug(s) {
  return fold(norm(s)).replace(/\s+/g, '-');
}

export function norm(s) {
  return String(s).toLowerCase().normalize('NFC')
    .replace(/&/g, ' och ')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Fold Swedish and other diacritics so "alg" matches "älg". */
export function fold(s) {
  return s.replace(/[åä]/g, 'a').replace(/ö/g, 'o').normalize('NFD').replace(/\p{M}/gu, '');
}

const ARTICLES = new Set(['en', 'ett', 'den', 'det', 'de', 'the', 'a', 'an', 'och', 'eller', 'med', 'man', 'att', 'som', 'pa', 'i']);
const ENDINGS = ['arna', 'orna', 'erna', 'ena', 'na', 'ar', 'or', 'er', 'en', 'et', 'n', 't', 'a', 'e'];

function stem(token) {
  if (token.length < 5) return token;
  for (const e of ENDINGS) {
    if (token.endsWith(e) && token.length - e.length >= 3) return token.slice(0, -e.length);
  }
  return token;
}

// Edit distance where swapping two neighbouring letters counts as one edit
// (optimal string alignment), so "volov" is one typo away from "volvo".
function lev(a, b) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > 2) return 99;
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  }
  return d[a.length][b.length];
}

const tolerance = (len) => (len <= 3 ? 0 : len <= 6 ? 1 : 2);

/** Pre-compute normalised forms for a prompt's answers. */
export function prepare(prompt) {
  return prompt.answers.map((a) => {
    const id = a.id || slug(a.label);
    const forms = [a.label, ...(a.aka || [])].map((f) => {
      const all = fold(norm(f)).split(' ').filter(Boolean);
      const content = all.filter((t) => !ARTICLES.has(t));
      const tokens = content.length ? content : all;
      return { tokens, joined: tokens.join(' '), stems: tokens.map(stem).join(' ') };
    });
    return { ...a, id, forms };
  });
}

/**
 * Match raw input to an accepted answer.
 * @returns {{answer: object, how: string} | null}
 */
export function match(raw, prepared) {
  const tokens = fold(norm(raw)).split(' ').filter(Boolean);
  if (!tokens.length) return null;
  const content = tokens.filter((t) => !ARTICLES.has(t));
  const joined = (content.length ? content : tokens).join(' ');
  const stems = (content.length ? content : tokens).map(stem);
  const stemJoined = stems.join(' ');

  let best = null;
  const consider = (answer, score, how) => {
    if (!best || score > best.score) best = { answer, score, how };
  };

  for (const a of prepared) {
    for (const f of a.forms) {
      // 1. exact
      if (joined === f.joined) consider(a, 100, 'exact');
      else if (stemJoined === f.stems) consider(a, 95, 'stem');
      // 2. the accepted form appears inside a longer phrase
      else if (containsSeq(stems, f.stems.split(' '))) consider(a, 80 + f.tokens.length, 'contains');
      // 3. typo tolerance on the whole phrase
      else {
        const d = lev(joined, f.joined);
        if (d <= tolerance(f.joined.length)) consider(a, 70 - d * 5, 'typo');
        else if (f.tokens.length === 1 && f.joined.length >= 5) {
          // 4. typo tolerance per word
          for (const t of content) {
            const dt = lev(t, f.joined);
            if (dt <= tolerance(f.joined.length)) consider(a, 60 - dt * 5, 'typo-word');
          }
        }
      }
    }
  }
  return best ? { answer: best.answer, how: best.how } : null;
}

function containsSeq(hay, needle) {
  if (!needle.length || needle.length > hay.length) return false;
  outer: for (let i = 0; i <= hay.length - needle.length; i++) {
    for (let j = 0; j < needle.length; j++) if (hay[i + j] !== needle[j]) continue outer;
    return true;
  }
  return false;
}
