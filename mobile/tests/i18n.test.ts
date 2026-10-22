import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { decimalSeparator, getLanguage, setLanguage, t, tp } from '@/i18n';
import { en } from '@/i18n/en';

const SRC = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'src');

function sourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      if (path.endsWith(join('i18n', 'en'))) continue; // les dictionnaires eux-mêmes
      files.push(...sourceFiles(path));
    } else if (/\.tsx?$/.test(name)) {
      files.push(path);
    }
  }
  return files;
}

/** Lit un littéral de chaîne JS (', " ou ` sans ${}) à partir de `start`, ou null. */
function readLiteral(source: string, start: number): { value: string; end: number } | null {
  const quote = source[start];
  if (quote !== "'" && quote !== '"' && quote !== '`') return null;
  let value = '';
  for (let i = start + 1; i < source.length; i++) {
    const char = source[i];
    if (char === '\\') {
      const next = source[i + 1];
      value += next === 'n' ? '\n' : next === 't' ? '\t' : next;
      i++;
    } else if (char === quote) {
      return { value, end: i + 1 };
    } else if (quote === '`' && char === '$' && source[i + 1] === '{') {
      return null; // modèle dynamique : pas une clé statique
    } else {
      value += char;
    }
  }
  return null;
}

function skipSpace(source: string, index: number): number {
  while (index < source.length && /\s/.test(source[index])) index++;
  return index;
}

type Found = { key: string; where: string };

/** Tous les textes français passés à t / tp / msg, et ceux écrits en attribut ou en propriété d'interface. */
function extractKeys(): Found[] {
  const found: Found[] = [];
  for (const file of sourceFiles(SRC)) {
    // Les commentaires (qui citent des exemples d'appels) ne sont pas du code : on les blanchit sans changer les positions.
    const blank = (comment: string) => comment.replace(/[^\n]/g, ' ');
    const source = readFileSync(file, 'utf-8')
      .replace(/\/\*[\s\S]*?\*\//g, blank)
      .replace(/^[ \t]*\/\/.*$/gm, blank);
    const where = (index: number) => `${relative(SRC, file)}:${source.slice(0, index).split('\n').length}`;

    // t('…'), msg('…'), tp(n, '…', '…')
    for (const match of source.matchAll(/(?<![\w.])(t|msg|tp)\(/g)) {
      let index = skipSpace(source, match.index! + match[0].length);
      if (match[1] === 'tp') {
        // saute le premier argument (le nombre) jusqu'à la première virgule de niveau 0
        let depth = 0;
        for (; index < source.length; index++) {
          const char = source[index];
          if (char === '(' || char === '[' || char === '{') depth++;
          else if (char === ')' || char === ']' || char === '}') depth--;
          else if (char === ',' && depth === 0) break;
        }
        index = skipSpace(source, index + 1);
        for (let argument = 0; argument < 2; argument++) {
          const literal = readLiteral(source, index);
          if (!literal) break;
          found.push({ key: literal.value, where: where(index) });
          index = skipSpace(source, literal.end);
          if (source[index] !== ',') break;
          index = skipSpace(source, index + 1);
        }
        continue;
      }
      const literal = readLiteral(source, index);
      if (literal) found.push({ key: literal.value, where: where(index) });
    }

    // Attributs de nos composants : title="…", label="…", placeholder="…", accessibilityLabel="…"
    for (const match of source.matchAll(/\b(title|label|placeholder|accessibilityLabel)=(["'])((?:(?!\2).)*)\2/g)) {
      found.push({ key: match[3].replace(/&apos;/g, "'"), where: where(match.index!) });
    }
    for (const match of source.matchAll(/\b(title|label|placeholder|accessibilityLabel)=\{(['"])((?:(?!\2).)*)\2\}/g)) {
      found.push({ key: match[3], where: where(match.index!) });
    }
  }
  return found.filter(({ key }) => /[A-Za-zÀ-ÿ]/.test(key));
}

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();

test('chaque texte du code a une traduction anglaise', () => {
  const missing = extractKeys().filter(({ key }) => !Object.prototype.hasOwnProperty.call(en, key));
  const unique = [...new Map(missing.map((item) => [item.key, item])).values()];
  if (process.env.I18N_DUMP) writeFileSync(process.env.I18N_DUMP, JSON.stringify(unique, null, 1));
  assert.equal(
    unique.length,
    0,
    `${unique.length} texte(s) sans traduction :\n` + unique.map((item) => `  ${item.where}  ${JSON.stringify(item.key)}`).join('\n'),
  );
});

test('les paramètres {…} sont les mêmes en français et en anglais', () => {
  const broken = Object.entries(en).filter(([fr, english]) => placeholders(fr).join() !== placeholders(english).join());
  assert.deepEqual(broken.map(([fr]) => fr), []);
});

test('aucune traduction vide ni identique par erreur à une autre langue de travail', () => {
  const empty = Object.entries(en).filter(([, english]) => english.trim() === '');
  assert.deepEqual(empty.map(([fr]) => fr), []);
});

test('t : français inchangé, anglais traduit, paramètres, texte inconnu rendu tel quel', () => {
  setLanguage('fr');
  assert.equal(t('Réglages'), 'Réglages');
  assert.equal(t('Sortir {bins}', { bins: 'les cartons' }), 'Sortir les cartons');
  setLanguage('en');
  assert.equal(t('Réglages'), 'Settings');
  assert.equal(t('Sortir {bins}', { bins: 'the cardboard' }), 'Put out the cardboard');
  assert.equal(t('Un texte saisi par la personne'), 'Un texte saisi par la personne');
  assert.equal(t('Sortir {bins}', { other: 1 }), 'Put out {bins}', 'paramètre absent : laissé tel quel');
  setLanguage('fr');
});

test('tp : pluriel français (0 et 1 au singulier) et anglais (seulement 1)', () => {
  setLanguage('fr');
  assert.equal(tp(0, '{count} unité', '{count} unités'), '0 unité');
  assert.equal(tp(1, '{count} unité', '{count} unités'), '1 unité');
  assert.equal(tp(2, '{count} unité', '{count} unités'), '2 unités');
  setLanguage('en');
  assert.equal(tp(0, '{count} unité', '{count} unités'), '0 units');
  assert.equal(tp(1, '{count} unité', '{count} unités'), '1 unit');
  assert.equal(tp(2, '{count} unité', '{count} unités'), '2 units');
  setLanguage('fr');
});

test('séparateur décimal et langue courante', () => {
  setLanguage('fr');
  assert.equal(decimalSeparator(), ',');
  setLanguage('en');
  assert.equal(decimalSeparator(), '.');
  assert.equal(getLanguage(), 'en');
  setLanguage('fr');
});

test('prompts : aucun paramètre non résolu, langue demandée pour le contenu, identifiants intacts', async () => {
  const { buildNutritionPrompt, EMPTY_QUESTIONNAIRE_ANSWERS, nutritionGenericPrompt } = await import('@/lib/nutrition-prompt');
  const { buildSportPrompt, EMPTY_SPORT_QUESTIONNAIRE_ANSWERS, sportGenericPrompt } = await import('@/lib/sport-prompt');
  const answers = {
    ...EMPTY_QUESTIONNAIRE_ANSWERS,
    age: '16',
    sex: 'femme' as const,
    weightKg: '58',
    groceryDay: 'jeudi' as const,
    leftoverDays: ['mardi' as const],
    flexMealDays: ['samedi' as const, 'dimanche' as const],
    kitchenEquipment: ['Four'],
    medicalConditions: 'asthme',
    pregnancyStatus: 'allaitante' as const,
    wantsLunchLeftoversNextDay: true,
    snacksPerDay: 2,
  };
  const sportAnswers = { ...EMPTY_SPORT_QUESTIONNAIRE_ANSWERS, age: '15', injuriesOrLimitations: 'genou', equipment: ['Haltères'], sessionDurationMinutes: '45' };

  const build = () => [
    buildNutritionPrompt(answers),
    nutritionGenericPrompt(),
    buildSportPrompt(sportAnswers),
    buildSportPrompt({ ...sportAnswers, mode: 'continu' }),
    sportGenericPrompt(),
  ];

  for (const language of ['fr', 'en'] as const) {
    setLanguage(language);
    for (const prompt of build()) {
      assert.doesNotMatch(prompt, /\{[a-zA-Z]+\}(?!\s*[,}\]])/, `${language}: paramètre non résolu`);
      for (const identifier of ['"feculent"', '"isRestDay"', '"cookDay"', '"preferredTime"'].filter((id) => prompt.includes(id.slice(1, -1)))) {
        assert.ok(prompt.includes(identifier), `${language}: ${identifier}`);
      }
    }
  }

  setLanguage('en');
  const [nutrition, genericNutrition, fixedSport, continuousSport] = build();
  assert.match(nutrition, /in English/);
  assert.match(nutrition, /Thursday/, 'jour des courses affiché dans la langue courante');
  assert.match(nutrition, /breastfeeding/);
  assert.match(nutrition, /2 snacks per day/);
  assert.match(genericNutrition, /You are a nutritionist/);
  assert.match(fixedSport, /"weekday": "lundi"/, 'les identifiants de jour restent en français');
  assert.match(continuousSport, /"sequence"/);
  assert.match(fixedSport, /Warm-up/);

  setLanguage('fr');
  const [frNutrition] = build();
  assert.match(frNutrition, /en français/);
  assert.match(frNutrition, /jeudi/);
  assert.match(frNutrition, /2 collations par jour/);
});

test('les noms de jours et de mois ont une traduction', () => {
  setLanguage('en');
  for (const day of ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche']) assert.notEqual(t(day), day);
  setLanguage('fr');
});

test('formats localisés : dates, décimales, listes, créneaux de repas', async () => {
  const { formatLongDate, formatShortDay, formatMonthYear, greetingForHour, parseDateString } = await import('@/lib/date');
  const { formatShortDate, formatWeight, formatNumber } = await import('@/lib/sport-stats');
  const { formatBinList } = await import('@/lib/waste');
  const { formatQuantity } = await import('@/lib/nutrition-courses');
  const { mealSlotKind } = await import('@/lib/meal-slots');
  const date = parseDateString('2026-10-14');

  setLanguage('fr');
  assert.equal(formatLongDate(date), 'Mercredi 14 octobre');
  assert.equal(formatShortDay(date), 'mer. 14 oct.');
  assert.equal(formatMonthYear(date), 'Octobre 2026');
  assert.equal(formatShortDate('2026-10-14'), '14/10');
  assert.equal(formatWeight(42.5), '42,5 kg');
  assert.equal(formatNumber(42.5), '42,5');
  assert.equal(formatBinList(['A', 'B', 'C']), 'A, B et C');
  assert.equal(formatQuantity({ grams: 1500, units: null }), '1,5 kg');
  assert.equal(greetingForHour(9), 'Bonjour');

  setLanguage('en');
  assert.equal(formatLongDate(date), 'Wednesday, October 14');
  assert.equal(formatShortDay(date), 'Wed, Oct 14');
  assert.equal(formatMonthYear(date), 'October 2026');
  assert.equal(formatShortDate('2026-10-14'), '10/14');
  assert.equal(formatWeight(42.5), '42.5 kg');
  assert.equal(formatNumber(42.5), '42.5');
  assert.equal(formatBinList(['A', 'B', 'C']), 'A, B and C');
  assert.equal(formatQuantity({ grams: 1500, units: null }), '1.5 kg');
  assert.equal(formatQuantity({ grams: null, units: 1 }), '1 unit');
  assert.equal(greetingForHour(9), 'Good morning');
  assert.equal(greetingForHour(14), 'Good afternoon');
  assert.equal(greetingForHour(21), 'Good evening');

  for (const [name, kind] of Object.entries({ Breakfast: 'breakfast', Lunch: 'lunch', 'Snack 2': 'snack', 'Evening snack': 'evening', Dinner: 'dinner', Supper: 'dinner' })) {
    assert.equal(mealSlotKind(name), kind, name);
  }
  setLanguage('fr');
});

test('en anglais, les messages d\'import et les rappels sont traduits', async () => {
  const { parseNutritionPlan } = await import('@/lib/nutrition-schema');
  const { parseSportPlan } = await import('@/lib/sport-schema');
  const { parseActivityInput } = await import('@/lib/sport-activity');
  setLanguage('en');
  const nutrition = parseNutritionPlan('{ not json');
  assert.ok(!nutrition.success && /not valid JSON/.test(nutrition.error));
  const sport = parseSportPlan('{ not json');
  assert.ok(!sport.success && /not valid JSON/.test(sport.error));
  const activity = parseActivityInput('', '');
  assert.ok(!activity.success && /name of the activity/.test(activity.error));
  setLanguage('fr');
  const french = parseNutritionPlan('{ pas du json');
  assert.ok(!french.success && /pas un JSON valide/.test(french.error));
});
