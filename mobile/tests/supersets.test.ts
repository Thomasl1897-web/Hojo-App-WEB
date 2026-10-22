import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { beforeEach, test } from 'node:test';

import { db } from '@/lib/database';
import { getCatalogExercise, resolveExercise } from '@/lib/exercise-catalog';
import { nextPosition, restAfter, supersetBounds, supersetInfo, type Position } from '@/lib/session-flow';
import {
  completeCurrentSession,
  completeOptionalSession,
  getCurrentSession,
  getOptionalSessions,
  getSessionAtPosition,
  getSportPlanForEdit,
  getTodayCompletedSessionName,
  importSportPlan,
  saveEditedSportPlan,
} from '@/lib/sport-db';
import { draftToPlan, planToDraft } from '@/lib/sport-draft';
import { parseSportPlan, type Exercise } from '@/lib/sport-schema';
import { isAuxiliaryExercise } from '@/lib/sport-stats';

import { freshDatabase } from './helpers';

beforeEach(freshDatabase);

const HYBRID = readFileSync(new URL('./data/programme-hybrid-athlete.json', import.meta.url), 'utf8');

function ex(name: string, sets: number, restSeconds: number, superset?: string): Exercise {
  return { name, sets, reps: '10', restSeconds, ...(superset ? { superset } : {}) };
}

/** Toutes les positions d'une séance, dans l'ordre où l'écran de séance les propose. */
function walk(exercises: Exercise[]): string[] {
  const steps: string[] = [];
  let position: Position | null = { exerciseIndex: 0, currentSet: 1 };
  while (position) {
    const { exerciseIndex, currentSet } = position;
    steps.push(`${exercises[exerciseIndex].name}${currentSet}(${restAfter(exercises, exerciseIndex, currentSet)})`);
    position = nextPosition(exercises, exerciseIndex, currentSet);
  }
  return steps;
}

test('séance sans superset : toutes les séries d’un exercice, puis le suivant, repos de chaque exercice', () => {
  assert.deepEqual(walk([ex('A', 2, 90), ex('B', 1, 60)]), ['A1(90)', 'A2(90)', 'B1(60)']);
});

test('superset : séries alternées, pas de repos dans le tour, repos du groupe en fin de tour', () => {
  const exercises = [ex('Seul', 1, 120), ex('X', 3, 0, '5'), ex('Y', 3, 60, '5'), ex('Fin', 1, 30)];
  assert.deepEqual(walk(exercises), ['Seul1(120)', 'X1(0)', 'Y1(60)', 'X2(0)', 'Y2(60)', 'X3(0)', 'Y3(60)', 'Fin1(30)']);
  assert.deepEqual(supersetBounds(exercises, 2), { start: 1, end: 2 });
  assert.deepEqual(supersetInfo(exercises, 1), { label: '5', rank: 1, size: 2 });
  assert.equal(supersetInfo(exercises, 0), null);
});

test('superset inégal : l’exercice qui n’a plus de série est sauté ; deux supersets voisins restent distincts', () => {
  const exercises = [ex('X', 3, 0, 'a'), ex('Y', 2, 45, 'a'), ex('Z', 1, 0, 'b'), ex('W', 1, 30, 'b')];
  assert.deepEqual(walk(exercises), ['X1(0)', 'Y1(45)', 'X2(0)', 'Y2(45)', 'X3(45)', 'Z1(0)', 'W1(30)']);
});

test('un superset de un seul exercice se comporte comme un exercice seul', () => {
  assert.deepEqual(walk([ex('X', 2, 40, 'solo'), ex('Y', 1, 0)]), ['X1(40)', 'X2(40)', 'Y1(0)']);
});

function continuous(sequence: object[]): string {
  return JSON.stringify({ type: 'sport', mode: 'continu', name: 'Test', preferredTime: '18:00', sequence });
}

test('schéma : superset non consécutif, séance facultative mal placée', () => {
  const split = parseSportPlan(
    continuous([{ sessionName: 'S', isRestDay: false, exercises: [ex('X', 3, 0, '5'), ex('Y', 3, 60), ex('Z', 3, 60, '5')] }]),
  );
  assert.equal(split.success, false);
  assert.match(split.success ? '' : split.error, /superset "5"/);

  const allOptional = parseSportPlan(continuous([{ sessionName: 'E', isRestDay: false, optional: true, exercises: [ex('X', 1, 0)] }]));
  assert.equal(allOptional.success, false);

  const optionalRest = parseSportPlan(
    continuous([
      { sessionName: 'A', isRestDay: false, exercises: [ex('X', 1, 0)] },
      { sessionName: 'Repos', isRestDay: true, optional: true, exercises: [] },
    ]),
  );
  assert.equal(optionalRest.success, false);

  const days = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'].map((weekday, i) =>
    i === 0
      ? { weekday, sessionName: 'Full', isRestDay: false, optional: true, exercises: [ex('X', 1, 0)] }
      : { weekday, sessionName: 'Repos', isRestDay: true, exercises: [] },
  );
  const fixed = parseSportPlan(JSON.stringify({ type: 'sport', mode: 'fixe', name: 'F', preferredTime: '18:00', days }));
  assert.equal(fixed.success, false);
});

test('programme Hybrid Athlete : valide, chaque exercice à charge reconnu par son identifiant', () => {
  const parsed = parseSportPlan(HYBRID);
  assert.ok(parsed.success, parsed.success ? '' : parsed.error);
  let counted = 0;
  for (const session of parsed.data.mode === 'continu' ? parsed.data.sequence : []) {
    for (const exercise of session.exercises) {
      if (isAuxiliaryExercise(exercise.name)) continue;
      counted++;
      assert.ok(exercise.exerciseId && getCatalogExercise(exercise.exerciseId), exercise.name);
      assert.equal(resolveExercise(exercise.name, exercise.exerciseId)?.id, exercise.exerciseId);
    }
  }
  assert.ok(counted > 40);
  // La mobilité et la respiration n'ont pas de charge à suivre.
  assert.ok(isAuxiliaryExercise('Mobilité : squat cosaque assisté'));
  assert.ok(isAuxiliaryExercise('Respiration 90/90 allongé'));
  assert.ok(!isAuxiliaryExercise('Développé couché haltères'));
});

test('enchaînement : les séances facultatives sont hors rotation et ne la font pas avancer', () => {
  const parsed = parseSportPlan(HYBRID);
  assert.ok(parsed.success);
  importSportPlan(parsed.data);

  assert.deepEqual(
    getOptionalSessions().map((s) => s.sessionName),
    ['E · Mobilité et résilience', 'Routine anti-bureau (10 min)'],
  );
  const order: string[] = [];
  for (let i = 0; i < 5; i++) {
    order.push(getCurrentSession()!.session.sessionName.slice(0, 1));
    completeCurrentSession();
  }
  assert.deepEqual(order, ['A', 'B', 'C', 'D', 'A']);

  // Après une facultative, la prochaine séance de l'enchaînement est inchangée (B, puisque A vient d'être faite).
  db.runSync('DELETE FROM sport_session_completions');
  const before = getCurrentSession()!.session.sessionName;
  const mobility = getSessionAtPosition(getOptionalSessions()[0].position)!;
  assert.ok(mobility.isOptional);
  completeOptionalSession(mobility.sessionName);
  assert.equal(getCurrentSession()!.session.sessionName, before);
  assert.equal(getTodayCompletedSessionName(), mobility.sessionName);
  // Elle ne remplace pas une séance de l'enchaînement déjà faite le même jour.
  db.runSync('DELETE FROM sport_session_completions');
  completeCurrentSession();
  const done = getTodayCompletedSessionName();
  completeOptionalSession(mobility.sessionName);
  assert.equal(getTodayCompletedSessionName(), done);
});

test('superset, tempo, RIR, alternative et séance facultative survivent à la base et à l’éditeur', () => {
  const parsed = parseSportPlan(HYBRID);
  assert.ok(parsed.success);
  importSportPlan(parsed.data);
  const back = getSportPlanForEdit();
  assert.ok(back && back.mode === 'continu' && parsed.data.mode === 'continu');
  assert.deepEqual(JSON.parse(JSON.stringify(back.sequence)), parsed.data.sequence);

  const redone = draftToPlan(planToDraft(back));
  assert.ok(redone.success, redone.success ? '' : redone.error);
  assert.deepEqual(JSON.parse(JSON.stringify(redone.plan)), JSON.parse(JSON.stringify(parsed.data)));

  // Position conservée en ignorant les facultatives : 4 séances dans l'enchaînement.
  db.runSync('UPDATE sport_progress SET current_index = 3 WHERE id = 1');
  saveEditedSportPlan(redone.plan);
  assert.equal(getCurrentSession()!.session.sessionName.slice(0, 1), 'D');
});
