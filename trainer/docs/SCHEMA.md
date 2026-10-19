# Content schema

All exercise content is plain JSON in the repo. To add material:

1. Create a JSON file in the right folder following the schema below.
2. List it in that folder's `index.json` (reading, listening) or `tree.json` (vocabulary).
3. Commit and push. The service worker fetches content network-first, so the new material shows up on the next online visit.

Validate locally with `node tools/validate-content.mjs` before committing.

General rules

- Every exercise has a stable, unique `id` (lowercase, `a-z0-9-`). Progress is stored by id, so **never rename an id** once it has been published.
- `level` is one of `A2`, `B1`, `B2`, `C1`.
- Text is UTF-8 with Swedish characters (å ä ö). Use typographic quotes ”…” inside Swedish text.
- Separate paragraphs with a blank line (`\n\n`).

---

## Question types (shared)

Used in reading, listening, the level check and civics.

```jsonc
// Multiple choice. `answer` is the 0-based index of the correct option.
{ "type": "mc", "q": "Fråga?", "options": ["A", "B", "C", "D"], "answer": 1, "explanation": "Varför B är rätt." }

// True/false. `q` is a statement.
{ "type": "tf", "q": "Påstående.", "answer": false, "explanation": "Varför det är falskt." }

// Open question. Graded by the LLM when an API key is set, otherwise by keyword overlap.
{ "type": "open", "q": "Fråga?", "modelAnswer": "Ett bra svar.", "keywords": ["nyckelord", "begrepp"] }
```

Write `keywords` as short stems or phrases that a correct answer is likely to contain. About half of them must match for full marks offline.

The app shuffles `mc` options every time a question is shown, so the order in the file doesn't matter. Add `"keepOrder": true` to keep the order, for example for "Alla ovanstående".

---

## Level check — `content/level/questions.json`

```jsonc
{
  "version": 1,
  "questions": [
    { "id": "b1-7", "level": "B1", "type": "mc", "q": "…", "options": ["…"], "answer": 0, "explanation": "…" }
  ]
}
```

The test draws 4 random questions per level, so each level needs **at least 4** questions (more gives more variety). Only `mc` is used here.

---

## Reading — `content/reading/<id>.json`

```jsonc
{
  "id": "b2-kontantlost",
  "level": "B2",
  "topic": "Samhälle · ekonomi",      // shown under the title
  "title": "…",
  "source": "Originaltext i nyhetsstil", // provenance; credit adapted sources
  "summary": "2–3 meningar.",
  "text": "Stycke ett.\n\nStycke två.",
  "glossary": [{ "sv": "sårbarhet", "en": "vulnerability" }],  // optional
  "questions": [ /* 2–4 mc, 1–2 tf, 1 open */ ]
}
```

Approximate text length: A2 100–150 words, B1 200–300, B2 300–450, C1 450–650.

## Listening — `content/listening/<id>.json`

```jsonc
{
  "id": "b1-vardcentralen",
  "level": "B1",
  "kind": "dialog",                    // "dialog" | "monolog"
  "topic": "Vardag · vård",
  "title": "…",
  "situation": "Du hör ett telefonsamtal …",
  "segments": [
    { "speaker": "Sjuksköterska", "text": "…" },   // speaker "" for monologues
    { "speaker": "Ahmed", "text": "…" }
  ],
  "questions": [ /* same as reading */ ]
}
```

Write numbers the way they should be **spoken** (e.g. "kvart i tio", "elva sjuttiosju") because speech synthesis reads them literally.

## Writing — `content/writing/prompts.json`

```jsonc
{
  "id": "klagomal-mejl",
  "title": "…",
  "genre": "Formellt mejl",
  "level": "B2",
  "register": "formal",               // "formal" | "informal"
  "words": [180, 280],
  "minutes": 30,
  "exams": ["c1", "sva3", "tisus", "citizenship"],  // exam profiles this suits
  "instructions": "…",
  "points": ["Innehållspunkter som ska vara med"],
  "checklist": ["Självgranskning: struktur, sambandsord, register"],
  "tip": "Valfritt tips."
}
```

## Vocabulary — `content/vocab/tree.json` + card files

`tree.json` defines the theme hierarchy (root → category → theme) and lists the card files. Every leaf `id` is a theme that cards refer to. `short` is an optional short label for the map.

```jsonc
// card
{
  "id": "natur-alg",                 // unique, stable
  "theme": "skog-natur",             // a leaf id in tree.json
  "sv": "älg",
  "pos": "substantiv",               // substantiv | verb | adjektiv | adverb | preposition | konjunktion | subjunktion | partikelverb | fras | idiom
  "article": "en",                   // "en" | "ett" | null
  "forms": "älgen, älgar, älgarna",  // nouns: def. sg, indef. pl, def. pl · verbs: present, past, supine · adjectives: utr, neutr, pl
  "example": "Se upp för älgar på vägen.",
  "en": "moose (US), elk (UK)"       // optional English gloss
}
```

To add a new theme, add a leaf to `tree.json` and give cards that `theme` id. You can put the cards in an existing file or add a new file to `files`.

## Civics — `shared/content/civics/`

`index.json` holds the chapter list (it mirrors UHR's *Sverige i fokus*), the exam facts and the question files. Each question carries its `chapter`:

```jsonc
{ "id": "c04-ledamoter", "chapter": "kap04", "type": "mc", "q": "…", "options": ["…"], "answer": 0, "explanation": "…" }
```

Civics answers **must be factually verifiable**. Check each one against the UHR material, riksdagen.se, regeringen.se or migrationsverket.se. Write the correct option first; the app shuffles the options.

## Picture description (planned) — `content/picture/<id>.json`

```jsonc
{
  "id": "torget-vinter",
  "level": "B1",
  "image": "https://upload.wikimedia.org/…",
  "credit": "Foto: Namn, CC BY-SA 4.0, via Wikimedia Commons",
  "objects": [{ "label": "spark", "accept": ["spark", "sparkstötting"], "box": [0.12, 0.55, 0.2, 0.3] }],
  "usefulWords": ["torg", "snö", "spark", "marknadsstånd"]
}
```

`box` is `[x, y, width, height]` as fractions of the image size.
