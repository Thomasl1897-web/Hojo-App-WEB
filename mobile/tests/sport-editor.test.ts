import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';

import { setSetting } from '@/lib/settings-db';
import { getActiveSportPlanMeta, getSportPlanForEdit, saveEditedSportPlan, importSportPlan } from '@/lib/sport-db';
import { draftToPlan, emptyExercise, newDraft, planToDraft } from '@/lib/sport-draft';
import { db } from '@/lib/database';
import { freshDatabase } from './helpers';

beforeEach(() => freshDatabase());

function validContinuous() {
  const draft = newDraft('continu');
  draft.name = 'Mon programme';
  draft.sessions[0].sessionName = 'Push';
  draft.sessions[0].exercises = [{ name: 'Développé couché', sets: '4', reps: '6-8', restSeconds: '120' }];
  draft.sessions.push({ sessionName: 'Pull', isRestDay: false, exercises: [{ ...emptyExercise(), name: 'Tractions' }] });
  draft.sessions.push({ sessionName: 'Repos', isRestDay: true, exercises: [] });
  return draft;
}

test("brouillon valide : plan créé, relu tel quel par l'éditeur", () => {
  const result = draftToPlan(validContinuous());
  assert.ok(result.success);
  assert.equal(result.plan.mode, 'continu');
  saveEditedSportPlan(result.plan);
  const back = getSportPlanForEdit();
  assert.ok(back && back.mode === 'continu');
  assert.deepEqual(back.sequence.map((s) => s.sessionName), ['Push', 'Pull', 'Repos']);
  assert.equal(back.sequence[0].exercises[0].sets, 4);
  assert.equal(planToDraft(back).sessions[1].exercises[0].name, 'Tractions');
});

test('brouillon fixe : sept jours de repos par défaut, une séance par jour modifiable', () => {
  const draft = newDraft('fixe');
  draft.name = 'Semaine';
  const monday = draft.sessions[0];
  assert.equal(monday.weekday, 'lundi');
  monday.isRestDay = false;
  monday.sessionName = 'Full body';
  monday.exercises = [{ ...emptyExercise(), name: 'Squat' }];
  const result = draftToPlan(draft);
  assert.ok(result.success);
  saveEditedSportPlan(result.plan);
  assert.equal(getSportPlanForEdit()?.mode, 'fixe');
});

test('erreurs de saisie : messages précis, aucune écriture', () => {
  const noName = validContinuous();
  noName.name = ' ';
  assert.match((draftToPlan(noName) as { error: string }).error, /nom au programme/);

  const badTime = validContinuous();
  badTime.preferredTime = '25:99';
  assert.match((draftToPlan(badTime) as { error: string }).error, /HH:MM/);

  const badSets = validContinuous();
  badSets.sessions[0].exercises[0].sets = '0';
  assert.match((draftToPlan(badSets) as { error: string }).error, /Séance 1, exercice 1/);

  const decimalRest = validContinuous();
  decimalRest.sessions[0].exercises[0].restSeconds = '1,5';
  assert.equal(draftToPlan(decimalRest).success, false);

  const empty = validContinuous();
  empty.sessions[1].exercises = [];
  assert.match((draftToPlan(empty) as { error: string }).error, /Séance 2/);

  assert.equal(getSportPlanForEdit(), null);
});

test('enregistrer garde la position du flux continu et ne touche pas aux charges', () => {
  const first = draftToPlan(validContinuous());
  assert.ok(first.success);
  importSportPlan(first.plan);
  db.runSync('UPDATE sport_progress SET current_index = 2 WHERE id = 1');
  db.runSync("INSERT INTO sport_exercise_logs (exercise_name, set_number, weight, logged_at) VALUES ('Tractions', 1, 10, '2026-01-01')");

  const edited = planToDraft(first.plan);
  edited.sessions.pop();
  const result = draftToPlan(edited);
  assert.ok(result.success);
  saveEditedSportPlan(result.plan);

  const index = db.getFirstSync<{ current_index: number }>('SELECT current_index FROM sport_progress WHERE id = 1');
  assert.equal(index?.current_index, 1);
  assert.equal(db.getFirstSync<{ n: number }>('SELECT COUNT(*) AS n FROM sport_exercise_logs')?.n, 1);
});

test("l'heure du rappel choisie dans les réglages suit l'éditeur", () => {
  const first = draftToPlan(validContinuous());
  assert.ok(first.success);
  importSportPlan(first.plan);
  setSetting('sport_reminder_time', '07:00');
  const draft = planToDraft(first.plan);
  draft.preferredTime = '20:15';
  const result = draftToPlan(draft);
  assert.ok(result.success);
  saveEditedSportPlan(result.plan);
  assert.equal(getActiveSportPlanMeta()?.preferredTime, '20:15');
});
