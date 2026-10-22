import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';

import { db } from '@/lib/database';
import { addDays, getTodayDateString, getWeekdayLabel, parseDateString, toDateString } from '@/lib/date';
import { formatDuration, parseActivityInput } from '@/lib/sport-activity';
import {
  addSportActivity,
  completeCurrentSession,
  deleteSportActivity,
  getActiveSportPlanMeta,
  getAllActivityDates,
  getAllSportActivities,
  getCompletionHistory,
  getCurrentSession,
  getExerciseLogRows,
  getFixedTrainingWeekdays,
  getLastSessionWeights,
  getLoggedExercises,
  getSessionProgress,
  getSportActivity,
  getTodayCompletedSessionName,
  importSportPlan,
  initSportSchema,
  logSetWeight,
  saveSessionProgress,
  updateSportActivity,
} from '@/lib/sport-db';
import { breakdownByActivity, buildHistory, filterHistory, groupByMonth, summarizeHistory } from '@/lib/sport-history';
import { parseSportPlan, type SportPlan } from '@/lib/sport-schema';
import {
  bestStreakWeeks,
  buildExerciseSeries,
  currentStreakWeeks,
  filterByRange,
  formatNumber,
  formatWeight,
  isAuxiliaryExercise,
  isBodyweightSeries,
  metricValue,
  mondayOf,
  niceAxis,
  sessionsThisWeek,
  weeklyCounts,
} from '@/lib/sport-stats';
import { placeTooltip } from '@/lib/chart-utils';
import { formatSetEntry, parseSetEntry, parseTargetReps } from '@/lib/set-entry';

import { buildContinuousSportPlan, buildFixedSportPlan, clone } from './fixtures';
import { freshDatabase } from './helpers';

beforeEach(freshDatabase);

function load(plan: unknown): SportPlan {
  const parsed = parseSportPlan(JSON.stringify(plan));
  assert.ok(parsed.success, parsed.success ? '' : parsed.error);
  if (!parsed.success) throw new Error('unreachable');
  return parsed.data;
}

// ---------------------------------------------------------------- schéma

test('schéma : programmes fixe et continu acceptés, JSON de LLM repêché', () => {
  load(buildFixedSportPlan());
  load(buildContinuousSportPlan());
  assert.ok(parseSportPlan('```json\n' + JSON.stringify(buildContinuousSportPlan()) + '\n```').success);
  assert.ok(!parseSportPlan('pas du json').success);
});

test('schéma : refus d\'une séance de repos avec exercices, d\'une séance sans exercice, d\'un fixe sans 7 jours', () => {
  const restWithExercises = clone(buildFixedSportPlan());
  restWithExercises.days[1].exercises = [{ name: 'Burpees', sets: 3, reps: '10', restSeconds: 30 }];
  assert.ok(!parseSportPlan(JSON.stringify(restWithExercises)).success);

  const emptySession = clone(buildFixedSportPlan());
  emptySession.days[0].exercises = [];
  assert.ok(!parseSportPlan(JSON.stringify(emptySession)).success);

  const sixDays = clone(buildFixedSportPlan());
  sixDays.days.pop();
  assert.ok(!parseSportPlan(JSON.stringify(sixDays)).success);

  const badTime = clone(buildFixedSportPlan());
  badTime.preferredTime = '25:99';
  assert.ok(!parseSportPlan(JSON.stringify(badTime)).success);
});

test('schéma : un programme sans aucun jour de repos est accepté avec un avertissement', () => {
  const plan = clone(buildContinuousSportPlan());
  plan.sequence.pop();
  const parsed = parseSportPlan(JSON.stringify(plan));
  assert.ok(parsed.success);
  if (parsed.success) assert.ok(parsed.warnings.length > 0);
});

// ---------------------------------------------------------------- base : modes fixe et continu

test('mode fixe : « aujourd\'hui » est la séance du jour de semaine réel', () => {
  importSportPlan(load(buildFixedSportPlan()));
  const current = getCurrentSession();
  assert.equal(current?.mode, 'fixe');
  const isMonday = getWeekdayLabel(new Date()) === 'lundi';
  assert.equal(current?.session.sessionName, isMonday ? 'Push' : 'Repos');
  assert.deepEqual(getFixedTrainingWeekdays(), ['lundi']);
});

test('mode continu : la séance suivante avance quand on termine, peu importe le jour, et boucle', () => {
  importSportPlan(load(buildContinuousSportPlan()));
  const order = ['Push', 'Pull', 'Legs', 'Repos', 'Push', 'Pull'];
  for (const expected of order) {
    assert.equal(getCurrentSession()?.session.sessionName, expected);
    completeCurrentSession();
  }
  assert.equal(getActiveSportPlanMeta()?.mode, 'continu');
});

test('séance terminée : enregistrée, et la reprise en cours est effacée', () => {
  importSportPlan(load(buildContinuousSportPlan()));
  assert.equal(getTodayCompletedSessionName(), null);
  saveSessionProgress('Push', { exerciseIndex: 0, currentSet: 2 });
  assert.deepEqual(getSessionProgress('Push'), { exerciseIndex: 0, currentSet: 2 });
  assert.equal(getSessionProgress('Pull'), null, 'une autre séance ne reprend pas cette position');

  completeCurrentSession();
  assert.equal(getTodayCompletedSessionName(), 'Push');
  assert.equal(getSessionProgress('Push'), null);
  assert.deepEqual(getCompletionHistory().map((c) => c.sessionName), ['Push']);
});

test('réimport d\'un programme : le plan change, mais l\'historique des charges et des séances reste', () => {
  importSportPlan(load(buildContinuousSportPlan()));
  logSetWeight('Squat', 1, 80);
  completeCurrentSession();
  importSportPlan(load(buildFixedSportPlan()));
  assert.equal(getLoggedExercises().length, 1);
  assert.equal(getCompletionHistory().length, 1);
  assert.equal(getActiveSportPlanMeta()?.mode, 'fixe');
});

test('charges : dernière fois ignorant aujourd\'hui, indexées par nom d\'exercice', () => {
  logSetWeight('Squat', 1, 80);
  logSetWeight('Squat', 2, 85);
  assert.deepEqual(getLastSessionWeights('Squat'), [], 'les entrées du jour même sont ignorées');
  assert.equal(getExerciseLogRows('Squat').length, 2);
  assert.deepEqual(getLoggedExercises().map((e) => e.name), ['Squat']);
});

test('activités saisies à la main : ajout, correction du nom, suppression, dates', () => {
  addSportActivity('2026-10-05', 'Football', 90);
  addSportActivity('2026-10-06', 'Vélo', null);
  const [latest, first] = getAllSportActivities();
  assert.equal(latest.name, 'Vélo');
  updateSportActivity(first.id, 'Sport collectif', 60);
  assert.equal(getSportActivity(first.id)?.name, 'Sport collectif');
  assert.equal(getSportActivity(first.id)?.durationMinutes, 60);
  assert.deepEqual(getAllActivityDates().sort(), ['2026-10-05', '2026-10-06']);
  deleteSportActivity(first.id);
  assert.equal(getSportActivity(first.id), null);
  assert.equal(getAllSportActivities().length, 1);
});

test('activité du jour et séance du programme comptent chacune dans les dates', () => {
  importSportPlan(load(buildContinuousSportPlan()));
  completeCurrentSession();
  addSportActivity(getTodayDateString(), 'Course à pied', 30);
  assert.deepEqual(getAllActivityDates(), [getTodayDateString(), getTodayDateString()]);
});

// ---------------------------------------------------------------- saisie d'une activité

test('saisie d\'une activité : nom obligatoire, durée entière de 1 à 1440', () => {
  assert.deepEqual(parseActivityInput(' Foot   salle ', ' 45 '), { success: true, data: { name: 'Foot salle', durationMinutes: 45 } });
  assert.deepEqual(parseActivityInput('Yoga', ''), { success: true, data: { name: 'Yoga', durationMinutes: null } });
  for (const bad of ['0', '1441', '-5', '4.5', '45min', 'abc']) {
    assert.ok(!parseActivityInput('Yoga', bad).success, bad);
  }
  assert.ok(!parseActivityInput('   ', '30').success);
  assert.equal(formatDuration(45), '45 min');
  assert.equal(formatDuration(60), '1 h');
  assert.equal(formatDuration(90), '1 h 30');
  assert.equal(formatDuration(125), '2 h 05');
});

// ---------------------------------------------------------------- séries de semaines

const TODAY = parseDateString('2026-10-21'); // un mercredi

test('lundi de la semaine, de n\'importe quel jour', () => {
  for (const [day, monday] of [['2026-10-19', '2026-10-19'], ['2026-10-21', '2026-10-19'], ['2026-10-25', '2026-10-19'], ['2026-10-26', '2026-10-26']]) {
    assert.equal(toDateString(mondayOf(parseDateString(day))), monday);
  }
});

test('série de semaines : la semaine en cours ne casse pas la série, un trou la casse', () => {
  assert.equal(currentStreakWeeks([], TODAY), 0);
  assert.equal(currentStreakWeeks(['2026-10-20'], TODAY), 1);
  assert.equal(currentStreakWeeks(['2026-10-13', '2026-10-06'], TODAY), 2, 'semaine en cours encore vide');
  assert.equal(currentStreakWeeks(['2026-10-21', '2026-10-13', '2026-10-06'], TODAY), 3);
  assert.equal(currentStreakWeeks(['2026-10-21', '2026-10-06'], TODAY), 1, 'trou la semaine du 12');
  assert.equal(currentStreakWeeks(['2026-09-01'], TODAY), 0);
});

test('record de série, séances de la semaine, histogramme', () => {
  const dates = ['2026-05-04', '2026-08-03', '2026-08-10', '2026-08-17', '2026-09-14', '2026-10-20', '2026-10-21'];
  assert.equal(bestStreakWeeks(dates), 3);
  assert.equal(bestStreakWeeks([]), 0);
  assert.equal(sessionsThisWeek(dates, TODAY), 2);
  const counts = weeklyCounts(dates, 12, TODAY);
  assert.equal(counts.length, 12);
  assert.equal(counts[11].weekStart, '2026-10-19');
  assert.equal(counts[11].count, 2);
  assert.equal(counts[0].weekStart, '2026-08-03');
  assert.equal(counts.reduce((sum, week) => sum + week.count, 0), 6, 'la séance de mai est hors des 12 dernières semaines');
});

test('semaines : mêmes résultats dans un autre fuseau (changement d\'heure en octobre)', () => {
  // Les calculs reposent sur des jours calendaires : la nuit du 25 au 26 octobre (heure d'hiver)
  // ne doit décaler aucune semaine.
  const dates = ['2026-10-12', '2026-10-19', '2026-10-26'];
  assert.equal(currentStreakWeeks(dates, parseDateString('2026-10-28')), 3);
  assert.equal(toDateString(addDays(parseDateString('2026-10-25'), 1)), '2026-10-26');
});

// ---------------------------------------------------------------- progression par exercice

test('série d\'un exercice : séance refaite le même jour = dernière charge de chaque série', () => {
  const series = buildExerciseSeries([
    { date: '2026-10-05', setNumber: 1, weight: 60 },
    { date: '2026-10-05', setNumber: 2, weight: 62.5 },
    { date: '2026-10-05', setNumber: 1, weight: 65 },
    { date: '2026-10-12', setNumber: 1, weight: 70 },
  ]);
  assert.deepEqual(series, [
    { date: '2026-10-05', maxWeight: 65, avgWeight: 63.8, sets: 2, reps: null, volume: null },
    { date: '2026-10-12', maxWeight: 70, avgWeight: 70, sets: 1, reps: null, volume: null },
  ]);
  assert.deepEqual(filterByRange(series, 7, parseDateString('2026-10-14')).map((p) => p.date), ['2026-10-12']);
  assert.equal(filterByRange(series, null, TODAY).length, 2);
});

test('échauffement et étirements n\'ont pas de charge à suivre', () => {
  for (const name of ['Échauffement', 'echauffement articulaire', 'Warm-up', 'warm up', 'Retour au calme', 'Cool-down', 'Étirements des ischios', 'Stretching']) {
    assert.ok(isAuxiliaryExercise(name), name);
  }
  for (const name of ['Squat', 'Développé couché', 'Tractions', 'Soulevé de terre roumain']) {
    assert.ok(!isAuxiliaryExercise(name), name);
  }
});

test('formats de charge et axes lisibles', () => {
  assert.equal(formatWeight(42.5), '42,5 kg');
  assert.equal(formatWeight(40), '40 kg');
  assert.equal(formatNumber(42.04), '42');
  for (let min = 0; min <= 200; min += 7) {
    for (const spread of [0, 1, 3, 12, 40]) {
      const axis = niceAxis(min, min + spread);
      assert.ok(axis.min >= 0 && axis.min <= min && axis.max >= min + spread, `${min}+${spread}`);
      const half = (axis.max - axis.min) / 2;
      assert.equal(Number.isFinite(half), true);
    }
  }
  const integer = niceAxis(2, 5, { integer: true });
  assert.ok(Number.isInteger(integer.min) && Number.isInteger((integer.min + integer.max) / 2) && Number.isInteger(integer.max));
});

test('info-bulle d\'un graphique : toujours entière dans le graphique', () => {
  for (let x = 0; x <= 300; x += 25) {
    for (let y = 0; y <= 160; y += 20) {
      const { left, top } = placeTooltip(x, y, 300, 90, 40);
      assert.ok(left >= 0 && left + 90 <= 300, `x=${x}`);
      assert.ok(top >= 0, `y=${y}`);
    }
  }
  assert.ok(placeTooltip(150, 10, 300, 90, 40).top > 10, 'en dessous du point quand il est trop haut');
  assert.ok(placeTooltip(150, 100, 300, 90, 40).top < 100, 'au-dessus sinon');
});

// ---------------------------------------------------------------- historique

test('historique : ordre stable à date égale, filtres, mois, répartition, totaux', () => {
  const history = buildHistory(
    [
      { date: '2026-10-20', sessionName: 'Push' },
      { date: '2026-09-30', sessionName: 'Legs' },
    ],
    [
      { id: 1, date: '2026-10-20', name: 'Vélo', durationMinutes: 40 },
      { id: 2, date: '2026-10-20', name: 'vélo', durationMinutes: 20 },
      { id: 3, date: '2026-10-02', name: 'Yoga', durationMinutes: null },
    ],
  );
  assert.deepEqual(history.map((e) => e.title), ['Push', 'vélo', 'Vélo', 'Yoga', 'Legs']);
  assert.deepEqual(filterHistory(history, 'program').map((e) => e.title), ['Push', 'Legs']);
  assert.equal(filterHistory(history, 'all').length, 5);
  assert.equal(filterHistory([], 'activity').length, 0);

  const months = groupByMonth(history);
  assert.deepEqual(months.map((m) => m.key), ['2026-10', '2026-09']);
  assert.equal(months[0].entries.length, 4);

  assert.deepEqual(breakdownByActivity([
    { id: 1, date: 'x', name: 'Vélo', durationMinutes: 40 },
    { id: 2, date: 'x', name: 'vélo', durationMinutes: 20 },
    { id: 3, date: 'x', name: 'Yoga', durationMinutes: null },
  ]), [
    { name: 'Vélo', count: 2, minutes: 60 },
    { name: 'Yoga', count: 1, minutes: 0 },
  ]);

  assert.deepEqual(summarizeHistory(history, TODAY), { total: 5, program: 2, activities: 3, thisMonth: 4 });
});

// ---------------------------------------------------------------- répétitions

test('répétitions visées : chiffre seul ou bas de la fourchette, rien pour le texte ou la durée', () => {
  assert.equal(parseTargetReps('10'), 10);
  assert.equal(parseTargetReps('8-12'), 8);
  assert.equal(parseTargetReps('8 à 12'), 8);
  assert.equal(parseTargetReps(' 12-15 reps'), 12);
  for (const text of ['AMRAP', 'échec', '30s', '45 sec', '1 min', '', '0']) assert.equal(parseTargetReps(text), null, text);
});

test("saisie d'une série : poids avec virgule, poids du corps, répétitions, rien à enregistrer", () => {
  assert.deepEqual(parseSetEntry('42,5', '8'), { weight: 42.5, reps: 8 });
  assert.deepEqual(parseSetEntry('60', ''), { weight: 60, reps: null });
  assert.deepEqual(parseSetEntry('', '12'), { weight: 0, reps: 12 }, 'poids du corps');
  assert.deepEqual(parseSetEntry('abc', ' 9 '), { weight: 0, reps: 9 });
  assert.deepEqual(parseSetEntry('50', '0'), { weight: 50, reps: null });
  assert.deepEqual(parseSetEntry('50', '4.5'), { weight: 50, reps: null }, 'répétitions entières seulement');
  assert.deepEqual(parseSetEntry('50', '1000'), { weight: 50, reps: null });
  assert.deepEqual(parseSetEntry('-5', ''), null);
  assert.equal(parseSetEntry('', ''), null);
  assert.equal(formatSetEntry({ weight: 60, reps: 8 }, formatWeight), '60 kg × 8');
  assert.equal(formatSetEntry({ weight: 60, reps: null }, formatWeight), '60 kg');
  assert.equal(formatSetEntry({ weight: 0, reps: 12 }, formatWeight), '12 reps');
});

test('volume et répétitions par jour ; les anciennes données sans répétitions restent lisibles', () => {
  const series = buildExerciseSeries([
    { date: '2026-10-05', setNumber: 1, weight: 60 },
    { date: '2026-10-05', setNumber: 2, weight: 60 },
    { date: '2026-10-12', setNumber: 1, weight: 60, reps: 8 },
    { date: '2026-10-12', setNumber: 2, weight: 62.5, reps: 6 },
    { date: '2026-10-12', setNumber: 3, weight: 60 },
  ]);
  assert.deepEqual(series.map((p) => [p.reps, p.volume]), [[null, null], [14, 855]]);
  assert.equal(metricValue(series[0], 'volume'), null);
  assert.equal(metricValue(series[1], 'volume'), 855);
  assert.equal(metricValue(series[1], 'reps'), 14);
  assert.equal(metricValue(series[1], 'max'), 62.5);
  assert.equal(isBodyweightSeries(series), false);
});

test('poids du corps : les répétitions comptent comme volume et deviennent la mesure suivie', () => {
  const series = buildExerciseSeries([
    { date: '2026-10-05', setNumber: 1, weight: 0, reps: 10 },
    { date: '2026-10-05', setNumber: 2, weight: 0, reps: 8 },
    { date: '2026-10-12', setNumber: 1, weight: 0, reps: 12 },
  ]);
  assert.deepEqual(series.map((p) => [p.reps, p.volume]), [[18, 18], [12, 12]]);
  assert.equal(isBodyweightSeries(series), true);
  assert.equal(isBodyweightSeries([]), false);
  assert.equal(isBodyweightSeries(buildExerciseSeries([{ date: '2026-10-05', setNumber: 1, weight: 0 }])), false, 'sans répétitions : rien à suivre');
});

test('base : répétitions enregistrées, reprises la fois suivante, dernière saisie du jour qui fait foi', () => {
  logSetWeight('Tractions', 1, 0, 10);
  logSetWeight('Squat', 1, 80, 5);
  logSetWeight('Squat', 1, 85, 6);
  logSetWeight('Squat', 2, 85);
  const rows = getExerciseLogRows('Squat');
  assert.deepEqual(rows.map((r) => [r.setNumber, r.weight, r.reps]), [[1, 80, 5], [1, 85, 6], [2, 85, null]]);

  // « la dernière fois » ignore aujourd'hui : on déplace ces lignes à hier pour la lire
  db.runSync("UPDATE sport_exercise_logs SET logged_at = '2020-01-01'");
  assert.deepEqual(
    getLastSessionWeights('Squat').map((e) => [e.setNumber, e.weight, e.reps]),
    [[1, 85, 6], [2, 85, null]],
  );
});

test("migration : une base d'avant les répétitions garde son historique", () => {
  db.execSync('DROP TABLE sport_exercise_logs');
  db.execSync(`CREATE TABLE sport_exercise_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT, exercise_name TEXT NOT NULL, set_number INTEGER NOT NULL,
    weight REAL NOT NULL, logged_at TEXT NOT NULL)`);
  db.runSync("INSERT INTO sport_exercise_logs (exercise_name, set_number, weight, logged_at) VALUES ('Squat', 1, 70, '2026-09-01')");
  initSportSchema();
  initSportSchema(); // idempotent
  assert.deepEqual(getExerciseLogRows('Squat'), [{ date: '2026-09-01', setNumber: 1, weight: 70, reps: null }]);
  logSetWeight('Squat', 2, 72, 5);
  assert.equal(getExerciseLogRows('Squat').length, 2);
});
