import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { test } from 'node:test';

import { setLanguage, t } from '@/i18n';
import { computeSleepScore, formatSleepDuration, sleepScoreLabel, STAGE, summarizeSleep, type RawSleep } from '@/lib/sleep';

/** Nuit du `day` (jour de réveil) : coucher la veille à 23h, durée `minutes`, phases en minutes (dans l'ordre donné). */
function night(id: string, wakeDay: number, minutes: number, stages: [number, number][] = []): RawSleep {
  const end = new Date(2026, 9, wakeDay, 7, 0);
  const start = new Date(end.getTime() - minutes * 60_000);
  let cursor = start.getTime();
  const spans = stages.map(([stage, length]) => {
    const span = { stage, startTime: new Date(cursor).toISOString(), endTime: new Date(cursor + length * 60_000).toISOString() };
    cursor += length * 60_000;
    return span;
  });
  return { id, startTime: start.toISOString(), endTime: end.toISOString(), stages: spans };
}

// 8 h au lit : 7 h 30 de sommeil dont 18 % profond et 22 % paradoxal, 30 min éveillé (efficacité 94 %).
const GOOD_STAGES: [number, number][] = [
  [STAGE.LIGHT, 450 - 81 - 99],
  [STAGE.DEEP, 81],
  [STAGE.REM, 99],
  [STAGE.AWAKE, 30],
];

test('les codes de phase sont ceux de la bibliothèque Health Connect', () => {
  const require = createRequire(import.meta.url);
  const { SleepStageType } = require('react-native-health-connect/lib/commonjs/constants.js') as { SleepStageType: Record<string, number> };
  assert.equal(SleepStageType.AWAKE, STAGE.AWAKE);
  assert.equal(SleepStageType.SLEEPING, STAGE.SLEEPING);
  assert.equal(SleepStageType.OUT_OF_BED, STAGE.OUT_OF_BED);
  assert.equal(SleepStageType.LIGHT, STAGE.LIGHT);
  assert.equal(SleepStageType.DEEP, STAGE.DEEP);
  assert.equal(SleepStageType.REM, STAGE.REM);
});

test('une bonne nuit détaillée obtient un score élevé, une nuit courte un score bas', () => {
  const [good] = summarizeSleep([night('a', 20, 480, GOOD_STAGES)]);
  assert.equal(good.asleepMinutes, 450);
  assert.equal(good.deepMinutes, 81);
  assert.equal(good.remMinutes, 99);
  assert.equal(good.awakeMinutes, 30);
  assert.equal(good.inBedMinutes, 480);
  assert.ok(good.hasStages);
  assert.ok(good.score >= 95, `score ${good.score}`);

  const [short] = summarizeSleep([night('b', 20, 240, [[STAGE.LIGHT, 150], [STAGE.DEEP, 40], [STAGE.REM, 30], [STAGE.AWAKE, 20]])]);
  assert.ok(short.score < 60, `score ${short.score}`);
});

test('sans phases : la durée seule compte, score plafonné à 90', () => {
  const [full] = summarizeSleep([night('a', 20, 480)]);
  assert.equal(full.hasStages, false);
  assert.equal(full.asleepMinutes, 480);
  assert.equal(full.score, 90);
  const [half] = summarizeSleep([night('b', 20, 225)]);
  assert.equal(half.score, 45);
});

test('le score baisse quand le sommeil profond manque ou que la nuit est hachée', () => {
  const base = { asleepMinutes: 450, deepMinutes: 81, remMinutes: 99, lightMinutes: 270, awakeMinutes: 30, inBedMinutes: 480, hasStages: true };
  const reference = computeSleepScore(base);
  assert.ok(computeSleepScore({ ...base, deepMinutes: 10, lightMinutes: 341 }) < reference);
  assert.ok(computeSleepScore({ ...base, awakeMinutes: 150, inBedMinutes: 600 }) < reference);
  assert.ok(computeSleepScore({ ...base, asleepMinutes: 750, lightMinutes: 570, inBedMinutes: 780 }) < reference, 'trop dormir réduit un peu le score');
  for (const value of [0, 1, 300, 450, 900, 2000]) {
    const score = computeSleepScore({ ...base, asleepMinutes: value });
    assert.ok(score >= 0 && score <= 100);
  }
});

test('regroupement par jour de réveil : morceaux additionnés, siestes ignorées, plus récent d\'abord', () => {
  const nights = summarizeSleep([
    night('old', 18, 420),
    night('part1', 20, 300),
    { ...night('part2', 20, 120), id: 'part2' },
    night('nap', 20, 60),
    { id: 'cassee', startTime: 'x', endTime: 'y', stages: [] },
  ]);
  assert.deepEqual(nights.map((n) => n.date), ['2026-10-20', '2026-10-18']);
  assert.equal(nights[0].asleepMinutes, 420, 'deux morceaux de 300 et 120 min, sieste de 60 min ignorée');
});

test('durée et mention', () => {
  assert.equal(formatSleepDuration(452), '7 h 32');
  assert.equal(formatSleepDuration(480), '8 h 00');
  assert.equal(formatSleepDuration(-5), '0 h 00');
  assert.deepEqual([90, 75, 55, 20].map(sleepScoreLabel), ['Excellent', 'Bon', 'Moyen', 'Court']);
});

test('les mentions du score ont une traduction anglaise (clés dynamiques, hors du scan automatique)', () => {
  setLanguage('en');
  try {
    for (const label of ['Excellent', 'Bon', 'Moyen', 'Court'] as const) {
      assert.ok(label === 'Excellent' || t(label) !== label, label);
    }
  } finally {
    setLanguage('fr');
  }
});
