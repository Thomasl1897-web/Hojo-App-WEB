import assert from 'node:assert/strict';
import { test } from 'node:test';

import { revealDelay } from '@/lib/reveal-delay';
import { freshDatabase } from './helpers';

test('revealDelay: cascade plafonnée, jamais négative', () => {
  assert.equal(revealDelay(0), 0);
  assert.equal(revealDelay(2), 90);
  assert.equal(revealDelay(8), 360);
  assert.equal(revealDelay(50), 360);
  assert.equal(revealDelay(-3), 0);
});

test('haptics: activé par défaut, réglage mémorisé et relu après restauration', async () => {
  freshDatabase();
  const haptics = await import('@/lib/haptics');
  haptics.reloadHapticsPreference();
  assert.equal(haptics.isHapticsEnabled(), true);
  haptics.setHapticsEnabled(false);
  assert.equal(haptics.isHapticsEnabled(), false);
  haptics.reloadHapticsPreference();
  assert.equal(haptics.isHapticsEnabled(), false);
  haptics.setHapticsEnabled(true);
  assert.doesNotThrow(() => haptics.hapticSuccess());
});
