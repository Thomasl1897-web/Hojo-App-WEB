import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';

import { createBackup, markExported, parseBackup, restoreBackup, savePlanSource, summarizeBackup, type BackupFile } from '@/lib/backup';
import { addDays, getWeekdayLabel, parseDateString, toDateString } from '@/lib/date';
import {
  getActivePlanMeta,
  getAllMeals,
  importNutritionPlan,
  setCycleStartDate,
  setSlotTime,
} from '@/lib/nutrition-db';
import { parseNutritionPlan } from '@/lib/nutrition-schema';
import { setSetting } from '@/lib/settings-db';
import { addCustomItem, getCustomItems, setCustomItemChecked } from '@/lib/shopping-db';
import {
  addSportActivity,
  completeCurrentSession,
  getAllSportActivities,
  getCompletionHistory,
  getCurrentSession,
  getExerciseLogRows,
  importSportPlan,
  logSetWeight,
} from '@/lib/sport-db';
import { parseSportPlan } from '@/lib/sport-schema';
import {
  binsCollectedOn,
  buildWasteReminders,
  candidateAnchors,
  formatBinList,
  isCollectionDay,
  nextCollectionDate,
  type WasteBinConfig,
} from '@/lib/waste';
import { getWasteBins, getWasteReminderTime, hasWasteSchedule, setWasteBin, setWasteReminderTime } from '@/lib/waste-db';

import { buildContinuousSportPlan, buildNutritionPlan } from './fixtures';
import { freshDatabase } from './helpers';

beforeEach(freshDatabase);

// ------------------------------------------------------------------ poubelles : logique pure

const everyOther = (weekday: string, anchorDate: string): WasteBinConfig => ({ id: 2, weekday, everyOtherWeek: true, anchorDate });
const weekly = (id: number, weekday: string): WasteBinConfig => ({ id, weekday, everyOtherWeek: false, anchorDate: null });

test('une semaine sur deux : alternance exacte de 14 jours sur deux ans, avant comme après l\'ancrage', () => {
  const anchor = '2026-10-15'; // un jeudi
  const bin = everyOther('jeudi', anchor);
  let date = addDays(parseDateString(anchor), -365);
  const end = addDays(parseDateString(anchor), 365);
  let expected = parseDateString(anchor);
  while (expected.getTime() > date.getTime()) expected = addDays(expected, -14);
  if (expected.getTime() < date.getTime()) expected = addDays(expected, 14);
  let hits = 0;
  while (date.getTime() <= end.getTime()) {
    const should = date.getTime() === expected.getTime();
    assert.equal(isCollectionDay(bin, date), should, toDateString(date));
    if (should) {
      hits++;
      expected = addDays(expected, 14);
    }
    date = addDays(date, 1);
  }
  assert.ok(hits >= 52);
});

test('sans date d\'ancrage, « une semaine sur deux » retombe sur chaque semaine (mieux vaut un rappel de trop)', () => {
  const bin: WasteBinConfig = { id: 1, weekday: 'jeudi', everyOtherWeek: true, anchorDate: null };
  assert.ok(isCollectionDay(bin, parseDateString('2026-10-15')));
  assert.ok(isCollectionDay(bin, parseDateString('2026-10-22')));
  assert.ok(!isCollectionDay({ ...bin, weekday: null }, parseDateString('2026-10-15')));
});

test('prochain ramassage, dates candidates et liste en français', () => {
  const from = parseDateString('2026-10-19'); // un lundi
  assert.equal(toDateString(nextCollectionDate(weekly(1, 'jeudi'), from)!), '2026-10-22');
  assert.equal(toDateString(nextCollectionDate(weekly(1, 'lundi'), from)!), '2026-10-19', 'aujourd\'hui compris');
  assert.equal(nextCollectionDate({ id: 1, weekday: null, everyOtherWeek: false, anchorDate: null }, from), null);
  const [near, far] = candidateAnchors('mercredi', from);
  assert.deepEqual([toDateString(near), toDateString(far)], ['2026-10-21', '2026-10-28']);
  assert.equal(formatBinList([]), '');
  assert.equal(formatBinList(['A']), 'A');
  assert.equal(formatBinList(['A', 'B']), 'A et B');
  assert.equal(formatBinList(['A', 'B', 'C']), 'A, B et C');
});

test('rappels de poubelles : veille au soir, regroupés, soirs déjà passés ignorés, heure d\'été comprise', () => {
  const bins = [weekly(2, 'jeudi'), weekly(3, 'jeudi'), everyOther('vendredi', '2026-10-16')];
  const now = new Date(2026, 9, 21, 12, 0); // mercredi 21 octobre, midi
  const reminders = buildWasteReminders(bins, now, '19:00', 14);

  const evenings = reminders.map((r) => toDateString(r.fireDate));
  assert.ok(evenings.includes('2026-10-21'), 'ce soir, pour jeudi');
  assert.ok(evenings.includes('2026-10-28'), 'mercredi suivant, pour jeudi');
  assert.ok(evenings.includes('2026-10-29'), 'jeudi soir, pour vendredi (semaine sur deux)');
  assert.ok(!evenings.includes('2026-10-22'));
  const first = reminders.find((r) => toDateString(r.fireDate) === '2026-10-21')!;
  assert.deepEqual(first.bins.map((b) => b.id), [2, 3], 'un seul rappel pour les deux sacs');
  assert.ok(reminders.every((r) => r.fireDate.getHours() === 19 && r.fireDate.getTime() > now.getTime()));

  // Le soir est déjà passé : plus de rappel pour ce soir.
  const late = buildWasteReminders([weekly(2, 'jeudi')], new Date(2026, 9, 21, 20, 0), '19:00', 3);
  assert.equal(late.length, 0);
  assert.equal(binsCollectedOn(bins, parseDateString('2026-10-22')).length, 2);
});

// ------------------------------------------------------------------ poubelles : base

test('poubelles en base : quatre types, réglages conservés, heure de rappel', () => {
  assert.equal(getWasteBins().length, 4);
  assert.equal(hasWasteSchedule(), false);
  setWasteBin({ id: 4, weekday: 'mardi', everyOtherWeek: true, anchorDate: '2026-10-20' });
  assert.equal(hasWasteSchedule(), true);
  assert.deepEqual(getWasteBins().find((b) => b.id === 4), { id: 4, weekday: 'mardi', everyOtherWeek: true, anchorDate: '2026-10-20' });
  assert.equal(getWasteReminderTime(), '19:00');
  setWasteReminderTime('20:30');
  assert.equal(getWasteReminderTime(), '20:30');
  assert.equal(getWeekdayLabel(parseDateString('2026-10-20')), 'mardi');
});

// ------------------------------------------------------------------ sauvegarde

function importBothPlans() {
  const nutritionRaw = JSON.stringify(buildNutritionPlan());
  const nutrition = parseNutritionPlan(nutritionRaw);
  assert.ok(nutrition.success);
  if (nutrition.success) importNutritionPlan(nutrition.data);
  savePlanSource('nutrition', nutritionRaw);

  const sportRaw = JSON.stringify(buildContinuousSportPlan());
  const sport = parseSportPlan(sportRaw);
  assert.ok(sport.success);
  if (sport.success) importSportPlan(sport.data);
  savePlanSource('sport', sportRaw);
}

function populate() {
  importBothPlans();
  setCycleStartDate('2026-10-12');
  setSlotTime('Petit-déjeuner', '07:10');
  setSetting('theme', 'dark');
  setSetting('today_show_details', '1');
  addCustomItem('Lessive', '2');
  addCustomItem('Éponges', null);
  setCustomItemChecked(getCustomItems()[1].id, true);
  setWasteBin({ id: 2, weekday: 'jeudi', everyOtherWeek: true, anchorDate: '2026-10-15' });
  logSetWeight('Squat', 1, 80);
  logSetWeight('Squat', 2, 82.5, 6);
  completeCurrentSession();
  completeCurrentSession();
  addSportActivity('2026-10-05', 'Football', 90);
}

/** Tout ce qu'une sauvegarde est censée capturer, sans la date de création. */
function snapshot(): Omit<BackupFile, 'createdAt'> {
  const { createdAt: _createdAt, ...rest } = createBackup(new Date(2026, 9, 21));
  return rest;
}

test('sauvegarde : aller-retour complet après effacement total de la base', () => {
  populate();
  const before = snapshot();
  const raw = JSON.stringify(createBackup());

  freshDatabase();
  assert.equal(getActivePlanMeta(), null);
  assert.equal(getExerciseLogRows('Squat').length, 0);

  const parsed = parseBackup(raw);
  assert.ok(parsed.success);
  if (!parsed.success) return;
  const { warnings } = restoreBackup(parsed.data);
  assert.deepEqual(warnings, []);

  assert.deepEqual(snapshot(), before);
  assert.equal(getAllMeals().length, 14);
  assert.equal(getActivePlanMeta()?.cycleStartDate, '2026-10-12', 'la position dans le cycle est conservée');
  assert.equal(getCurrentSession()?.session.sessionName, 'Legs', 'le mode continu reprend où il en était');
  assert.deepEqual(getExerciseLogRows('Squat').map((r) => [r.weight, r.reps]), [[80, null], [82.5, 6]], 'répétitions restaurées');
  assert.equal(getCompletionHistory().length, 1);
  assert.equal(getAllSportActivities().length, 1);
  assert.equal(getCustomItems().length, 2);
});

test('restaurer deux fois donne le même état, et re-sauvegarder est identique', () => {
  populate();
  const backup = createBackup();
  restoreBackup(backup);
  const once = snapshot();
  restoreBackup(backup);
  assert.deepEqual(snapshot(), once);
});

test('l\'heure du dernier export n\'est pas dans la sauvegarde', () => {
  populate();
  markExported(new Date(2026, 9, 21));
  assert.ok(!createBackup().settings.some((s) => s.key === 'last_backup_export_at'));
});

test('résumé d\'une sauvegarde pour la confirmation', () => {
  populate();
  const summary = summarizeBackup(createBackup());
  assert.equal(summary.weightEntries, 2);
  assert.equal(summary.sessionsDone, 1);
  assert.equal(summary.activities, 1);
  assert.equal(summary.shoppingItems, 2);
  assert.equal(summary.hasNutritionPlan, true);
  assert.equal(summary.hasSportPlan, true);
});

test('refus clairs : JSON illisible, autre fichier, sauvegarde abîmée, version plus récente', () => {
  const good = JSON.stringify(createBackup());
  assert.match((parseBackup('{pas du json') as { error: string }).error, /illisible/);
  assert.match((parseBackup('{"hello":"world"}') as { error: string }).error, /pas une sauvegarde/);

  const damaged = JSON.parse(good);
  delete damaged.sportLogs;
  assert.match((parseBackup(JSON.stringify(damaged)) as { error: string }).error, /abîmée|incomplète/);

  const future = JSON.parse(good);
  future.version = 99;
  assert.match((parseBackup(JSON.stringify(future)) as { error: string }).error, /plus récente/);
});

test('une sauvegarde faite avant les activités manuelles reste restaurable', () => {
  populate();
  const old = JSON.parse(JSON.stringify(createBackup()));
  delete old.sportActivities;
  const parsed = parseBackup(JSON.stringify(old));
  assert.ok(parsed.success);
  if (parsed.success) assert.deepEqual(parsed.data.sportActivities, []);
});

test('un plan absent de la sauvegarde laisse le plan actuel intact ; un plan illisible = avertissement', () => {
  populate();
  const withoutPlans = createBackup();
  withoutPlans.plans = { nutrition: null, sport: null };
  restoreBackup(withoutPlans);
  assert.equal(getActivePlanMeta()?.name, 'Plan de test');

  const broken = createBackup();
  broken.plans = { nutrition: '{ cassé', sport: null };
  const { warnings } = restoreBackup(broken);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /plan nutrition/);
  assert.equal(getCustomItems().length, 2, 'le reste est bien restauré');
});

test('échec en cours de restauration : aucune donnée n\'est à moitié remplacée', () => {
  populate();
  const before = snapshot();
  const bad = createBackup();
  bad.shoppingItems = [{ name: 'Seul article', quantity: null, checked: false }];
  bad.sportLogs = [{ exerciseName: null as unknown as string, setNumber: 1, weight: 10, reps: null, loggedAt: 'x' }];
  assert.throws(() => restoreBackup(bad));
  assert.deepEqual(snapshot(), before);
});

test('une sauvegarde faite avant la saisie des répétitions reste restaurable (répétitions inconnues)', () => {
  populate();
  const old = JSON.parse(JSON.stringify(createBackup()));
  for (const log of old.sportLogs) delete log.reps;
  const parsed = parseBackup(JSON.stringify(old));
  assert.ok(parsed.success);
  if (!parsed.success) return;
  assert.ok(parsed.data.sportLogs.every((log) => log.reps === null));
  restoreBackup(parsed.data);
  assert.deepEqual(getExerciseLogRows('Squat').map((r) => r.reps), [null, null]);
});
