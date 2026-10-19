# Prompt for generating new content

Copy the prompt below into Claude or another LLM. Fill in the parts in `{curly braces}`, then paste the JSON it returns into a new file and list it in `index.json`. Validate the result with `node tools/validate-content.mjs`.

Always read the generated text yourself before committing. For civics content, check every fact against an official source.

---

```text
Du är läromedelsförfattare för vuxna som lär sig svenska som andraspråk och förbereder sig för {prov: t.ex. "nationella provet i SVA 3" / "Tisus" / "medborgarskapsprovet"}.

Skapa {antal} nya övningar av typen {modul: reading | listening | vocab | civics | level | writing} på nivå {A2 | B1 | B2 | C1} (GERS).
Ämne/tema: {t.ex. "miljö och klimat", "arbetsliv", "skog och natur"}.

KRAV
- Skriv idiomatisk, naturlig svenska anpassad till nivån. Inga påhittade fakta om verkliga personer, siffror eller händelser. Skriv hellre allmänt än fel.
- Texter: originaltexter (kopiera inte befintliga artiklar). Längd: A2 100–150 ord, B1 200–300, B2 300–450, C1 450–650.
- Frågor: 2–4 flervalsfrågor (fyra alternativ, ett rätt, rimliga distraktorer), 1–2 sant/falskt och 1 öppen fråga med modellsvar och 4–8 nyckelord.
- Varje fråga har en kort förklaring på svenska som hänvisar till texten.
- För hörförståelse: skriv siffror och tider så som de uttalas ("kvart i tio", "tjugotre").
- För ordförråd: ange en/ett, böjningsformer (substantiv: best. sg, obest. pl, best. pl; verb: presens, preteritum, supinum; adjektiv: utrum, neutrum, plural), en naturlig exempelmening och en engelsk översättning.
- id: unika, små bokstäver, a–z, 0–9 och bindestreck, med nivå eller tema som prefix (t.ex. "b2-fjarrvarme").

FORMAT
Svara ENDAST med giltig JSON enligt schemat nedan. Inga kommentarer, ingen markdown.

{klistra in relevant del av docs/SCHEMA.md här}
```

## Tips

- **Ask for one file at a time.** Reading and listening are one object per file. Vocabulary is an object `{ "version": 1, "category": "...", "cards": [...] }`.
- **Matching the exam:** add a line such as "Uppgifterna ska likna nationella provets läsdel" to get the right style.
- **Your own field:** for professional vocabulary, give the LLM a list of terms you actually use at work and ask it to write the cards.
- **Second pass:** ask the LLM to proofread its own JSON: "Granska språket och kontrollera att varje 'answer' pekar på rätt alternativ."
