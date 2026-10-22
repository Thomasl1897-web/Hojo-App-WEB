import assert from 'node:assert/strict';
import { test } from 'node:test';

import { verifyPlanInvariants } from '@/lib/nutrition-invariants';
import { parseNutritionPlan, type NutritionPlan } from '@/lib/nutrition-schema';

import { buildNutritionPlan, clone } from './fixtures';

const errors = (plan: NutritionPlan) => verifyPlanInvariants(plan).filter((v) => v.severity === 'error');
const messages = (plan: NutritionPlan) => verifyPlanInvariants(plan).map((v) => v.message).join(' | ');

/** Générateur pseudo-aléatoire déterministe (mulberry32) : un échec doit pouvoir se rejouer. */
function seeded(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test('le plan de référence est accepté, sans aucune violation', () => {
  const parsed = parseNutritionPlan(JSON.stringify(buildNutritionPlan()));
  assert.ok(parsed.success, parsed.success ? '' : parsed.error);
  assert.deepEqual(verifyPlanInvariants(parsed.data), []);
});

test('le JSON est repêché dans une réponse de LLM (bloc markdown, texte autour)', () => {
  const json = JSON.stringify(buildNutritionPlan());
  assert.ok(parseNutritionPlan('```json\n' + json + '\n```').success);
  assert.ok(parseNutritionPlan('Voici ton plan :\n' + json + '\nBon appétit !').success);
});

test('refus clairs : JSON illisible, jour manquant, sous-calorique', () => {
  const broken = parseNutritionPlan('{ pas du json');
  assert.ok(!broken.success && /JSON/.test(broken.error));

  const missingDay = buildNutritionPlan();
  missingDay.days.pop();
  assert.ok(!parseNutritionPlan(JSON.stringify(missingDay)).success);

  const underfed = buildNutritionPlan();
  underfed.days[2].totals.calories = 900;
  const refused = parseNutritionPlan(JSON.stringify(underfed));
  assert.ok(!refused.success && /sécurité/.test(refused.error));
});

test('les étapes de recette sont facultatives', () => {
  const plan = buildNutritionPlan();
  assert.ok(plan.singles[0].steps && plan.singles[0].steps.length > 0);
  delete plan.singles[0].steps;
  assert.ok(parseNutritionPlan(JSON.stringify(plan)).success);
  plan.singles[0].steps = [''];
  assert.ok(!parseNutritionPlan(JSON.stringify(plan)).success);
});

test('invariant : macros d\'une recette incohérentes avec ses ingrédients', () => {
  const plan = clone(buildNutritionPlan());
  plan.singles[0].protein = 40;
  assert.ok(errors(plan).length > 0);
  assert.match(messages(plan), /porridge|Porridge/);
});

test('invariant : total du jour différent de la somme des repas', () => {
  const plan = clone(buildNutritionPlan());
  plan.days[3].totals.calories += 50;
  assert.ok(errors(plan).length > 0);
});

test('invariants : références et ingrédients inexistants', () => {
  const unknownRef = clone(buildNutritionPlan());
  unknownRef.days[0].meals[0].ref = 'fantome';
  assert.ok(errors(unknownRef).length > 0);

  const unknownFood = clone(buildNutritionPlan());
  unknownFood.singles[0].ingredients[0].foodId = 'inconnu';
  assert.ok(errors(unknownFood).length > 0);
});

test('invariants : portions d\'un batch (trou, doublon, portion 1 hors du jour de cuisson)', () => {
  const gap = clone(buildNutritionPlan());
  gap.days[3].meals[1].portionIndex = 7;
  assert.ok(errors(gap).length > 0, 'doublon de la portion 7 / portion 4 manquante');

  const wrongCookDay = clone(buildNutritionPlan());
  wrongCookDay.batches[0].cookDay = 3;
  assert.ok(errors(wrongCookDay).length > 0);
});

test('invariants : liste de courses (achat manquant, achat fantôme, doublon garde-manger)', () => {
  const missing = clone(buildNutritionPlan());
  missing.courses[0].items = missing.courses[0].items.filter((item) => item.foodId !== 'poulet');
  assert.ok(errors(missing).length > 0);

  const short = clone(buildNutritionPlan());
  short.courses[0].items[2].grams = 700;
  assert.ok(errors(short).length > 0);

  const phantom = clone(buildNutritionPlan());
  phantom.foods.push({ ...phantom.foods[0], id: 'fantome', name: 'Fantôme' });
  phantom.courses[0].items.push({ foodId: 'fantome', grams: 100, isPantry: false, needsFreezing: false });
  assert.ok(errors(phantom).length > 0);
});

test('invariant : plausibilité physique par portion, pas sur la ligne brute d\'un batch', () => {
  // 1400 g de poulet pour 7 portions = 200 g par portion : normal, aucune violation.
  assert.deepEqual(errors(buildNutritionPlan()), []);

  // 3 g de poulet par portion : grossier, doit être attrapé.
  const tiny = clone(buildNutritionPlan());
  tiny.batches[0].ingredients[0].grams = 21;
  tiny.courses[0].items[2].grams = 21;
  assert.ok(errors(tiny).length > 0);
});

test('baseDayKcal incohérent : avertissement seulement, jamais un rejet', () => {
  const plan = clone(buildNutritionPlan());
  plan.meta.baseDayKcal = 2600;
  const violations = verifyPlanInvariants(plan);
  assert.ok(violations.some((v) => v.severity === 'warning'));
  assert.deepEqual(violations.filter((v) => v.severity === 'error'), []);
});

test('l\'ordre des jours dans le fichier ne change pas le verdict (25 mélanges)', () => {
  const random = seeded(2026);
  for (let round = 0; round < 25; round++) {
    const plan = clone(buildNutritionPlan());
    for (let i = plan.days.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [plan.days[i], plan.days[j]] = [plan.days[j], plan.days[i]];
    }
    const parsed = parseNutritionPlan(JSON.stringify(plan));
    assert.ok(parsed.success, `mélange ${round}`);
    assert.deepEqual(verifyPlanInvariants(parsed.data), [], `mélange ${round}`);
  }
});
