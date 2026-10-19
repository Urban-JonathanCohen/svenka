// Loads versioned JSON content. Each module folder has an index.json that
// lists its files, so adding material means: drop a file in, list it.

const cache = new Map();

export async function loadJSON(path) {
  if (cache.has(path)) return cache.get(path);
  const promise = fetch(path).then((res) => {
    if (!res.ok) throw new Error(`Kunde inte läsa ${path} (${res.status})`);
    return res.json();
  });
  cache.set(path, promise);
  promise.catch(() => cache.delete(path));
  return promise;
}

// Returns every item listed in <base>/index.json, loaded in parallel.
export async function loadCollection(base) {
  const index = await loadJSON(`${base}/index.json`);
  const items = await Promise.all(index.files.map((f) => loadJSON(`${base}/${f}`)));
  return { index, items };
}

export const PATHS = {
  level: 'content/level/questions.json',
  reading: 'content/reading',
  listening: 'content/listening',
  writing: 'content/writing/prompts.json',
  vocab: 'content/vocab',
  civics: '../shared/content/civics',
};
