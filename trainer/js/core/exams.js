// Exam profiles. The chosen profile steers writing formats and the rubric the
// LLM grades against. Add a profile here to support another exam.

export const LEVELS = ['A2', 'B1', 'B2', 'C1'];

export const EXAMS = {
  c1: {
    id: 'c1',
    name: 'Allmän C1 (GERS)',
    en: 'General C1 (CEFR)',
    targetLevel: 'C1',
    rubric:
      'Bedöm enligt GERS/CEFR (A2–C2). Fokus: grammatisk korrekthet, ordförrådets bredd och precision, ' +
      'textbindning (sambandsord, styckeindelning), anpassning till mottagare och register, samt hur väl uppgiften löses.',
  },
  sva3: {
    id: 'sva3',
    name: 'SVA 3 / nationella provet',
    en: 'Swedish as a second language 3 / national test',
    targetLevel: 'C1',
    rubric:
      'Bedöm som Skolverkets nationella prov i svenska som andraspråk 3 (betyg F, E, C, A). Kriterier: ' +
      'innehåll och argumentation (relevant, nyanserad, med källhänvisning där det passar), struktur och textbindning, ' +
      'språklig korrekthet, ordförråd och stil anpassad till genre och mottagare. Ange betyg och motivera kort.',
  },
  tisus: {
    id: 'tisus',
    name: 'Tisus',
    en: 'Tisus (university entry)',
    targetLevel: 'C1',
    rubric:
      'Bedöm som skriftlig del av Tisus (godkänd motsvarar ungefär C1). Kriterier: argumenterande/utredande text med ' +
      'tydlig tes, saklig och akademisk stil, god textbindning, språklig korrekthet och varierat, precist ordförråd.',
  },
  citizenship: {
    id: 'citizenship',
    name: 'Medborgarskapsprov',
    en: 'Citizenship test',
    targetLevel: 'B1',
    rubric:
      'Bedöm mot kraven för svenskt medborgarskap: B1 för läs- och hörförståelse, A2 för skriftlig och muntlig ' +
      'färdighet. Var uppmuntrande. Fokusera på begriplighet, grundläggande grammatik och vardagligt ordförråd.',
  },
};

export const DEFAULT_EXAM = 'c1';
