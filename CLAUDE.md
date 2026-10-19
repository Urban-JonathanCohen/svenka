# Project: Personal Swedish exam trainer (static site on GitHub Pages)

## Context
I'm an adult learner preparing for a Swedish exam at roughly C1 / SVA level (Svenska som andraspråk). Duolingo doesn't work for me. I want a simple, personal, interactive practice tool I can open anywhere. You are the technical lead; I provide the language-learning insight.

## Tech constraints
- Pure static site: HTML, CSS and vanilla JavaScript (ES modules). No backend, no build step required. Must deploy as-is to GitHub Pages.
- Exercise content lives in versioned JSON files in the repo (e.g. /content/reading/*.json), so I can add material by hand or have an LLM generate it.
- Progress, level and settings are saved in localStorage, with export and import to a JSON file.
- Optional "Bring your own API key" setting (Anthropic or OpenAI), stored only in localStorage, used for grading open answers and generating new exercises. The app must still work offline/without a key using the stored exercises and answer keys.
- Clean, minimal, mobile-friendly UI. Swedish interface with optional English hints.

## Tabs / modules
1. **Level check**: an adaptive placement test. Questions start easy and get harder until accuracy drops, then the app estimates a level (roughly A2 to C1) and stores it. All other modules default to that level, and I can override it manually.
2. **Reading (Läsförståelse)**: short texts graded by level (adapted news, Sweden facts, society, environment). Each has a short summary, multiple-choice + true/false + one open question. Instant feedback with explanations.
3. **Listening (Hörförståelse)**: dialogues and short monologues played with the browser's speechSynthesis using a sv-SE voice (adjustable speed; the transcript is hidden until I've answered). Same question types as reading.
4. **Writing (Skriftlig färdighet)**: prompts by genre, e.g. letter to a friend about my weekend or summer; letter to the editor on how immigrants can feel more connected to local life in Sweden; formal complaint email; argumentative text; description of a process. Show word count, a timer and a checklist (structure, connectors, register). With an API key, return feedback in exam style: grammar errors with corrections, vocabulary range, coherence, an estimated level and one rewritten paragraph.
5. **Vocabulary (Ordförråd)**: flashcards with spaced repetition (SM-2 or similar). Words are organised in a theme tree, shown as an interactive visual map (e.g. D3 radial tree or treemap) coloured by mastery, so I can see at a glance how strong each area is.
   - Core language: adjectives, time and place prepositions, conjunctions, particle verbs, common phrases.
   - Themes: body, forest and nature, camping and outdoor life, culture and traditions, society and work, languages.
   - Professional: circular economy, urban metabolism, sustainability, research vocabulary.
   Cards include the article (en/ett), plural forms, an example sentence and an optional English gloss.
6. **Picture description (Bildbeskrivning)**: show an openly licensed image (e.g. Wikimedia Commons). Two modes: name the highlighted objects, or describe the image in 3–5 sentences. Open answers are scored generously with an LLM (any correct word counts), plus a list of useful words I missed.
7. **Conversation (Muntlig)**: placeholder for now. Plan it for later: Web Speech API for speech-to-text, an LLM role-playing exam situations (opinion discussion, describing experiences), and spoken replies via speechSynthesis.

## Deliverables for this first iteration
- Repo structure, README with deployment steps for GitHub Pages.
- Working shell: navigation, settings (level, API key), localStorage progress.
- Fully working Level check, Reading, Vocabulary (with the theme map), and Writing (prompts + LLM feedback).
- 3 sample exercises per module and ~100 vocabulary cards across themes as seed content, plus a documented JSON schema and a reusable prompt I can give an LLM to generate more content in that schema.
- Keep code modular and readable; one module per tab.

## Decisions since the first brief (2026-10-19)

- **Monorepo**: `trainer/` (this exam trainer), `kung-bulle/` (game), `shared/` (Sweden content used by both), `tools/` (content validator). Root `index.html` links both.
- **Exam profile** is a user setting (General C1, SVA 3/national test, Tisus, Citizenship test) and drives the writing rubric. See `trainer/js/core/exams.js`.
- **8th tab: Sverigekunskap** for the citizenship civics test (required since 2026-06-06). The chapters mirror UHR's "Sverige i fokus". Every civics fact must be verifiable against an official source.
- **Production-minded**: installable PWA (service worker), with storage and LLM calls behind adapters so accounts, sync and a server-side key proxy can be added later.
- **Kung Bulle**: a Krillion-style uniqueness game ("Hur svensk är du?"). The frontend is static, live answers go to Supabase (EU), and an offline mock is used until it's configured. No ads in v1; ads later need a custom domain and a GDPR consent banner.
- Run `node tools/validate-content.mjs` after editing any content JSON.
