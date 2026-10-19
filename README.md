# Svenka

Two static web apps for learning Swedish, in one repo. Both deploy as-is to GitHub Pages.

| | What | Path |
|---|---|---|
| 📚 **Svensktränaren** | A personal exam trainer for Swedish at C1 / SVA level, with a civics module for the citizenship test | [`trainer/`](trainer/) |
| 👑 **Kung Bulle** | A cheeky "how Swedish are you?" game: rare-but-correct answers score most | [`kung-bulle/`](kung-bulle/) |
| 🇸🇪 Shared content | Sweden knowledge used by both (civics questions) | [`shared/`](shared/) |

Live site (after you enable Pages): **https://urban-jonathancohen.github.io/svenka/**

---

## Svensktränaren (`trainer/`)

Pure HTML, CSS and vanilla JS (ES modules). There is no build step and no backend. It can be installed as an app (PWA) and works offline.

| Tab | Status |
|---|---|
| **Nivåtest**: adaptive placement A2→C1 | ✅ |
| **Läsförståelse**: texts by level, MC, true/false, open question | ✅ |
| **Hörförståelse**: speechSynthesis (sv-SE), adjustable speed, transcript after answering | ✅ |
| **Skriftlig färdighet**: genre prompts, word count, timer, checklist, exam-style AI feedback | ✅ |
| **Ordförråd**: SM-2 flashcards and a sunburst theme map coloured by mastery | ✅ |
| **Sverigekunskap**: civics for the citizenship test, in UHR's chapter structure, with practice and exam modes | ✅ |
| **Bildbeskrivning** | 🔜 planned (schema ready) |
| **Muntlig** | 🔜 placeholder |

**Settings:** level override, exam profile (General C1 / SVA 3 – national test / Tisus / Citizenship test), English hints, optional API key (Anthropic or OpenAI) for AI grading, and a sv-SE voice.

**Data:** progress lives in `localStorage` and can be exported and imported as JSON. The API key stays in the browser and is never included in exports. Everything goes through an adapter ([`js/core/storage.js`](trainer/js/core/storage.js), [`js/core/llm.js`](trainer/js/core/llm.js)), so accounts, sync or a server-side key proxy can be added later without touching the modules.

### Structure

```
trainer/
├── index.html, manifest.webmanifest, sw.js   # shell + offline
├── css/style.css
├── js/
│   ├── app.js            # router + tabs
│   ├── core/             # storage, state, content loader, LLM client, quiz renderer, SM-2, UI helpers
│   └── modules/          # one module per tab
├── content/              # exercise JSON (level, reading, listening, writing, vocab)
├── docs/SCHEMA.md        # content schema
├── docs/GENERATE_PROMPT.md  # reusable prompt for making more content with an LLM
└── vendor/d3.min.js      # D3 v7.9.0 (vendored for offline use)
shared/content/civics/    # Sverigekunskap questions (chapters mirror UHR "Sverige i fokus")
tools/validate-content.mjs
```

### Adding content

1. Write JSON following [`trainer/docs/SCHEMA.md`](trainer/docs/SCHEMA.md), or generate it with the prompt in [`GENERATE_PROMPT.md`](trainer/docs/GENERATE_PROMPT.md).
2. List the file in the folder's `index.json` (or in `tree.json` for vocabulary).
3. Run `node tools/validate-content.mjs`.
4. Commit and push.

---

## Kung Bulle (`kung-bulle/`)

Ten prompts ("Något som hör till ett midsommarfirande"), 20 seconds each. A valid answer scores **more the fewer other players gave it**. The daily round uses the same prompts for everyone, and free play is unlimited. You finish with a title, from *Turist på Arlanda ✈️* up to **Kung Bulle 👑**, and a shareable emoji result.

- Matching forgives missing å/ä/ö, typos and Swedish endings ([`js/match.js`](kung-bulle/js/match.js)).
- **Live answers** are stored in Supabase: the answer, an approximate country/time zone, and a random session id. No IP addresses and no accounts. See [`kung-bulle/backend/`](kung-bulle/backend/).
- Without a backend configured, it runs in **offline mode** against popularity priors.
- Add prompts in [`kung-bulle/content/prompts.json`](kung-bulle/content/prompts.json).

---

## Run locally

ES modules need a web server (opening `file://` won't work):

```bash
# from the repo root, any of:
npx serve .
python -m http.server 8000
```

Then open http://localhost:8000/trainer/ or http://localhost:8000/kung-bulle/.

## Deploy to GitHub Pages

1. Push to `main` on GitHub.
2. **Settings → Pages → Build and deployment**: Source = *Deploy from a branch*, Branch = `main`, folder `/ (root)`. Save.
3. After about a minute the site is live at `https://<user>.github.io/svenka/`.

To use a custom domain later, for example for ads, add a `CNAME` file with the domain and set the DNS records as described in GitHub's Pages docs.

**After changing app code** in `trainer/`, bump `VERSION` in [`trainer/sw.js`](trainer/sw.js) so installed apps pick up the new shell. Content JSON is fetched network-first and doesn't need a bump.

## Roadmap

- Bildbeskrivning with Wikimedia Commons images and generous LLM scoring.
- Muntlig: Web Speech API speech-to-text plus an LLM examiner role-play.
- Accounts and cloud sync (swap the storage adapter), plus a server-side LLM proxy so users don't need their own key.
- Kung Bulle: rate limiting through an edge function, edge geo, realtime top answers, and ads with a consent banner once there's a custom domain.

## Sources and licences

- Civics chapters follow UHR's *Sverige i fokus* ([uhr.se/medborgarskapsprovet](https://www.uhr.se/medborgarskapsprovet/utbildningsmaterial/)). The questions are original practice items, not official test questions.
- D3 is © Mike Bostock, ISC licence.
