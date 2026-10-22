import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';

import { addDays, dateStringDaysAgo, getCycleDayForDate, getWeekdayLabel, parseDateString, toDateString } from '@/lib/date';
import {
  clearShoppingChecks,
  clearSlotTimes,
  getActivePlanMeta,
  getAllMeals,
  getCompletedMealIdsForDate,
  getCourseWeeks,
  getDayTotals,
  getMealSlots,
  getMealsForCycleDay,
  getShoppingItems,
  importNutritionPlan,
  resetCycleStart,
  setCycleStart,
  setMealCompletion,
  setShoppingItemChecked,
  setSlotTime,
} from '@/lib/nutrition-db';
import { progressRatio, sumConsumedMacros } from '@/lib/nutrition-progress';
import { formatQuantity, groupShoppingItems, parseCustomItemInput } from '@/lib/nutrition-courses';
import { addCustomItem, deleteCheckedCustomItems, deleteCustomItem, getCustomItems, setCustomItemChecked } from '@/lib/shopping-db';

import { freshDatabase } from './helpers';
import { buildNutritionPlan } from './fixtures';

beforeEach(freshDatabase);

test('import : repas, totaux et recettes retrouvés, étapes comprises', () => {
  importNutritionPlan(buildNutritionPlan());

  const meta = getActivePlanMeta();
  assert.equal(meta?.name, 'Plan de test');
  assert.equal(meta?.cycleLengthDays, 7);

  const meals = getMealsForCycleDay(1);
  assert.deepEqual(meals.map((m) => m.slotName), ['Petit-déjeuner', 'Déjeuner']);
  assert.equal(meals[0].dishName, 'Porridge avoine-lait');
  assert.deepEqual(meals[0].steps, ["Verse l'avoine et le lait dans une casserole.", 'Chauffe 5 minutes en remuant.']);
  assert.equal(meals[0].ingredients[0].quantity, '100g');
  assert.equal(meals[1].dishName, 'Poulet, riz et brocoli');
  assert.deepEqual(meals[1].steps, [], 'un plat sans étapes ne plante pas');
  assert.equal(getAllMeals().length, 14);
  assert.equal(getDayTotals(3)?.calories, 559 + 819.4);
  assert.equal(getDayTotals(8), null);
});

test('repas libre : pas de macros ni d\'ingrédients, mais une note', () => {
  const plan = buildNutritionPlan();
  plan.days[0].meals.push({ name: 'Dîner', time: '19:30', freeNote: 'Restaurant entre amis' });
  importNutritionPlan(plan);
  const dinner = getMealsForCycleDay(1).find((m) => m.slotName === 'Dîner');
  assert.equal(dinner?.dishName, 'Restaurant entre amis');
  assert.equal(dinner?.macros, null);
  assert.deepEqual(dinner?.ingredients, []);
  assert.equal(dinner?.isOffCycle, true);
});

test('réimport : le plan est remplacé, les repas cochés repartent à zéro, les heures choisies survivent', () => {
  importNutritionPlan(buildNutritionPlan());
  const [first] = getMealsForCycleDay(1);
  setMealCompletion(first.id, '2026-10-05', true);
  setSlotTime('Petit-déjeuner', '07:15');

  importNutritionPlan(buildNutritionPlan());
  assert.equal(getCompletedMealIdsForDate('2026-10-05').size, 0);
  assert.equal(getMealsForCycleDay(1)[0].time, '07:15');
  assert.equal(getAllMeals().length, 14, 'pas de doublons après réimport');
});

test('cocher / décocher un repas, par date', () => {
  importNutritionPlan(buildNutritionPlan());
  const [first, second] = getMealsForCycleDay(1);
  setMealCompletion(first.id, '2026-10-05', true);
  setMealCompletion(first.id, '2026-10-05', true);
  setMealCompletion(second.id, '2026-10-06', true);
  assert.deepEqual([...getCompletedMealIdsForDate('2026-10-05')], [first.id]);
  assert.deepEqual([...getCompletedMealIdsForDate('2026-10-06')], [second.id]);
  setMealCompletion(first.id, '2026-10-05', false);
  assert.equal(getCompletedMealIdsForDate('2026-10-05').size, 0);
});

test('heures personnalisées : appliquées par nom de créneau, repas retriés par heure effective', () => {
  importNutritionPlan(buildNutritionPlan());
  setSlotTime('Petit-déjeuner', '13:00');
  assert.deepEqual(getMealsForCycleDay(2).map((m) => m.slotName), ['Déjeuner', 'Petit-déjeuner']);
  const slots = getMealSlots();
  assert.equal(slots.find((s) => s.slotName === 'Petit-déjeuner')?.time, '13:00');
  clearSlotTimes();
  assert.deepEqual(getMealsForCycleDay(2).map((m) => m.slotName), ['Petit-déjeuner', 'Déjeuner']);
});

test('jauges : somme des repas cochés, repas libres ignorés, ratio', () => {
  const plan = buildNutritionPlan();
  plan.days[0].meals.push({ name: 'Dîner', time: '19:30', freeNote: 'Resto' });
  importNutritionPlan(plan);
  const meals = getMealsForCycleDay(1);
  const all = new Set(meals.map((m) => m.id));
  const consumed = sumConsumedMacros(meals, all);
  assert.equal(Math.round(consumed.calories * 10) / 10, 559 + 819.4);
  assert.equal(sumConsumedMacros(meals, new Set()).calories, 0);
  assert.equal(progressRatio(50, 100), 0.5);
  assert.equal(progressRatio(150, 100), 1.5);
  assert.equal(progressRatio(10, 0), 0);
});

test('début du cycle : choisi par jour de semaine, semaine 1 ou 2, survit au réimport', () => {
  importNutritionPlan(buildNutritionPlan());
  const today = new Date();
  for (const weekday of ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche']) {
    for (const week of [1, 2]) {
      setCycleStart(weekday, week);
      const meta = getActivePlanMeta()!;
      const start = parseDateString(meta.cycleStartDate);
      assert.equal(getWeekdayLabel(start), weekday);
      const age = Math.round((parseDateString(toDateString(today)).getTime() - start.getTime()) / 86_400_000);
      assert.equal(age, (week - 1) * 7 + ((today.getDay() - ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'].indexOf(weekday) + 7) % 7));
    }
  }
  setCycleStart('mercredi', 1);
  const chosen = getActivePlanMeta()!.cycleStartDate;
  importNutritionPlan(buildNutritionPlan());
  assert.equal(getActivePlanMeta()!.cycleStartDate, chosen);
  resetCycleStart();
  assert.equal(getActivePlanMeta()!.cycleStartDate, dateStringDaysAgo(0));
  assert.equal(getCycleDayForDate(getActivePlanMeta()!.cycleStartDate, 7, addDays(new Date(), 0)), 1);
});

test('liste de courses : semaines, cases persistantes, groupes par rayon, garde-manger en dernier', () => {
  importNutritionPlan(buildNutritionPlan());
  assert.deepEqual(getCourseWeeks(), [1]);
  const items = getShoppingItems(1);
  assert.equal(items.length, 6);
  assert.ok(items.every((item) => !item.checked));

  setShoppingItemChecked(items[0].id, true);
  assert.equal(getShoppingItems(1).filter((i) => i.checked).length, 1);
  clearShoppingChecks(1);
  assert.equal(getShoppingItems(1).filter((i) => i.checked).length, 0);

  const sections = groupShoppingItems(getShoppingItems(1));
  assert.match(sections[sections.length - 1].title, /Garde-manger/);
  const pantryNames = sections[sections.length - 1].items.map((i) => i.name).sort();
  assert.deepEqual(pantryNames, ["Flocons d'avoine", "Huile d'olive", 'Riz basmati cru']);
});

test('quantités lisibles', () => {
  assert.equal(formatQuantity({ grams: 500, units: null }), '500 g');
  assert.equal(formatQuantity({ grams: 1500, units: null }), '1,5 kg');
  assert.equal(formatQuantity({ grams: null, units: 6 }), '6 unités');
  assert.equal(formatQuantity({ grams: null, units: 1 }), '1 unité');
  assert.doesNotMatch(formatQuantity({ grams: 1200.0000000000002, units: null }), /0000/);
});

test('articles ajoutés à la main : saisie nettoyée, cochage, suppression, injection SQL inoffensive', () => {
  const parsed = parseCustomItemInput('  Lessive   liquide ', ' 2 bidons ');
  assert.deepEqual(parsed, { name: 'Lessive liquide', quantity: '2 bidons' });
  assert.equal(parseCustomItemInput('   ', ''), null);
  assert.deepEqual(parseCustomItemInput('Pain', '  '), { name: 'Pain', quantity: null });
  assert.equal(parseCustomItemInput('x'.repeat(200), '')?.name.length, 80);

  addCustomItem('Lessive', null);
  addCustomItem("Robert'); DROP TABLE shopping_custom_items;--", '1');
  addCustomItem('Éponges', '3');
  const items = getCustomItems();
  assert.equal(items.length, 3);
  assert.equal(items[1].name, "Robert'); DROP TABLE shopping_custom_items;--");

  setCustomItemChecked(items[0].id, true);
  setCustomItemChecked(items[2].id, true);
  deleteCheckedCustomItems();
  assert.deepEqual(getCustomItems().map((i) => i.name), [items[1].name]);
  deleteCustomItem(items[1].id);
  assert.equal(getCustomItems().length, 0);
});
