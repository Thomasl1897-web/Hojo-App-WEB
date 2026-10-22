import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildMonthGrid, daysBetween, isSameDay, shiftMonth } from '@/lib/calendar';
import {
  addDays,
  formatLongDate,
  formatShortDay,
  getCycleDayForDate,
  greetingForHour,
  isValidTimeString,
  parseDateString,
  toDateString,
} from '@/lib/date';
import { baseSlotName, mealSlotKind } from '@/lib/meal-slots';

test('toDateString et parseDateString sont réciproques', () => {
  for (const text of ['2026-01-01', '2026-02-28', '2028-02-29', '2026-12-31']) {
    assert.equal(toDateString(parseDateString(text)), text);
  }
});

test('addDays raisonne en jours calendaires (60 jours consécutifs, changements d\'heure compris)', () => {
  let date = parseDateString('2026-03-01');
  for (let i = 1; i <= 60; i++) {
    date = addDays(date, 1);
    assert.equal(date.getHours(), 0);
    assert.equal(daysBetween(parseDateString('2026-03-01'), date), i);
  }
  assert.equal(toDateString(date), '2026-04-30');
});

test('addDays traverse les années bissextiles', () => {
  assert.equal(toDateString(addDays(parseDateString('2028-02-28'), 1)), '2028-02-29');
  assert.equal(toDateString(addDays(parseDateString('2026-02-28'), 1)), '2026-03-01');
  assert.equal(toDateString(addDays(parseDateString('2026-01-01'), -1)), '2025-12-31');
});

test('jour du cycle : boucle sur 7 et 14 jours, avant comme après la date d\'ancrage', () => {
  const start = '2026-10-05';
  assert.equal(getCycleDayForDate(start, 7, parseDateString('2026-10-05')), 1);
  assert.equal(getCycleDayForDate(start, 7, parseDateString('2026-10-11')), 7);
  assert.equal(getCycleDayForDate(start, 7, parseDateString('2026-10-12')), 1);
  assert.equal(getCycleDayForDate(start, 14, parseDateString('2026-10-18')), 14);
  assert.equal(getCycleDayForDate(start, 14, parseDateString('2026-10-19')), 1);
  assert.equal(getCycleDayForDate(start, 14, parseDateString('2026-10-04')), 14);
  assert.equal(getCycleDayForDate(start, 14, parseDateString('2026-09-21')), 1);
});

test('formats français', () => {
  assert.equal(formatLongDate(parseDateString('2026-10-14')), 'Mercredi 14 octobre');
  assert.match(formatShortDay(parseDateString('2026-10-14')), /mer/i);
  assert.equal(greetingForHour(8), 'Bonjour');
  assert.equal(greetingForHour(14), 'Bon après-midi');
  assert.equal(greetingForHour(22), 'Bonsoir');
  assert.equal(greetingForHour(3), 'Bonsoir');
});

test('heures valides', () => {
  for (const ok of ['00:00', '07:30', '23:59']) assert.ok(isValidTimeString(ok), ok);
  for (const bad of ['24:00', '7:30', '12:60', '', 'abc']) assert.ok(!isValidTimeString(bad), bad);
});

test('grille du mois : lundi en premier, toutes les dates, lignes de 7', () => {
  const grid = buildMonthGrid(2026, 9); // octobre 2026 : le 1er est un jeudi
  assert.ok(grid.every((week) => week.length === 7));
  assert.equal(grid[0][0], null);
  assert.equal(grid[0][3]?.getDate(), 1);
  const days = grid.flat().filter((cell): cell is Date => cell !== null);
  assert.equal(days.length, 31);
  assert.deepEqual(days.map((d) => d.getDate()), Array.from({ length: 31 }, (_, i) => i + 1));
  for (const week of grid) {
    week.forEach((cell, column) => {
      if (cell) assert.equal((cell.getDay() + 6) % 7, column);
    });
  }
});

test('mois : décalage à travers les années, comparaison de jours', () => {
  assert.deepEqual(shiftMonth(2026, 11, 1), { year: 2027, monthIndex: 0 });
  assert.deepEqual(shiftMonth(2026, 0, -1), { year: 2025, monthIndex: 11 });
  assert.ok(isSameDay(new Date(2026, 5, 1, 3), new Date(2026, 5, 1, 22)));
  assert.ok(!isSameDay(new Date(2026, 5, 1), new Date(2026, 5, 2)));
});

test('créneaux de repas : famille et nom court', () => {
  const kinds: Record<string, string> = {
    'Petit-déjeuner': 'breakfast',
    'PETIT-DEJEUNER': 'breakfast',
    Déjeuner: 'lunch',
    'Collation 2': 'snack',
    Goûter: 'snack',
    'En-cas': 'snack',
    'Collation du soir': 'evening',
    Dîner: 'dinner',
    Souper: 'dinner',
    'Repas post-entraînement': 'lunch',
  };
  for (const [name, kind] of Object.entries(kinds)) assert.equal(mealSlotKind(name), kind, name);
  assert.equal(baseSlotName('Collation 2'), 'Collation');
  assert.equal(baseSlotName('Collation 10'), 'Collation');
  assert.equal(baseSlotName('Dîner'), 'Dîner');
  assert.equal(baseSlotName('2'), '2');
});
