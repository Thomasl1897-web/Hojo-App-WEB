import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';

import { completeOnboarding, shouldShowOnboarding } from '@/lib/onboarding';
import { importSportPlan } from '@/lib/sport-db';
import { draftToPlan, newDraft, emptyExercise } from '@/lib/sport-draft';
import { freshDatabase } from './helpers';

beforeEach(() => freshDatabase());

test('accueil : affiché à la première utilisation, plus après avoir été terminé ou passé', () => {
  assert.equal(shouldShowOnboarding(), true);
  completeOnboarding();
  assert.equal(shouldShowOnboarding(), false);
});

test("accueil : jamais pour quelqu'un qui a déjà un programme", () => {
  const draft = newDraft('continu');
  draft.name = 'Existant';
  draft.sessions[0].sessionName = 'Push';
  draft.sessions[0].exercises = [{ ...emptyExercise(), name: 'Squat' }];
  const result = draftToPlan(draft);
  assert.ok(result.success);
  importSportPlan(result.plan);
  assert.equal(shouldShowOnboarding(), false);
});
