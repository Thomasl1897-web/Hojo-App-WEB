import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';

import { getActivePlanMeta, importNutritionPlan, setSlotTime } from '@/lib/nutrition-db';
import { getActiveSportPlanMeta, importSportPlan } from '@/lib/sport-db';
import { setWasteBin } from '@/lib/waste-db';
import { addDays, getWeekdayLabel, parseDateString, toDateString } from '@/lib/date';
import { parseSportPlan } from '@/lib/sport-schema';

import { buildContinuousSportPlan, buildFixedSportPlan, buildNutritionPlan } from './fixtures';
import { freshDatabase } from './helpers';

// Le module charge expo-notifications avec un `require` (voir notifications.ts) : on lui en
// fournit un faux qui enregistre chaque programmation, avant de l'importer.
type Scheduled = { content: { title: string; body: string }; trigger: { type: string; date?: Date; weekday?: number; hour?: number } };
const scheduled: Scheduled[] = [];
let cancelAllCalls = 0;

const fakeNotifications = {
  setNotificationHandler() {},
  setNotificationChannelAsync: async () => {},
  AndroidImportance: { HIGH: 4 },
  SchedulableTriggerInputTypes: { DATE: 'date', WEEKLY: 'weekly', TIME_INTERVAL: 'timeInterval' },
  scheduleNotificationAsync: async (request: Scheduled) => {
    scheduled.push(request);
    return `id-${scheduled.length}`;
  },
  cancelAllScheduledNotificationsAsync: async () => {
    cancelAllCalls++;
    scheduled.length = 0;
  },
  getPermissionsAsync: async () => ({ granted: true, canAskAgain: true }),
};
(globalThis as unknown as { require: (name: string) => unknown }).require = () => fakeNotifications;

const { rescheduleAllNotifications, rescheduleIfPermitted, scheduleRestEndNotification } = await import('@/lib/notifications');

beforeEach(() => {
  freshDatabase();
  scheduled.length = 0;
  cancelAllCalls = 0;
});

const dated = () => scheduled.filter((s) => s.trigger.type === 'date');

async function reschedule() {
  await rescheduleAllNotifications(getActivePlanMeta(), getActiveSportPlanMeta());
}

test('rien à programmer sans plan ni poubelles : tout est annulé, rien n\'est posé', async () => {
  await reschedule();
  assert.equal(cancelAllCalls, 1);
  assert.equal(scheduled.length, 0);
});

test('nutrition : rappels datés sur 7 jours au plus, tous dans le futur, du plus proche au plus lointain', async () => {
  importNutritionPlan(buildNutritionPlan());
  await reschedule();

  const dates = dated().map((s) => s.trigger.date!);
  assert.ok(dates.length >= 12 && dates.length <= 14, `${dates.length} rappels`);
  const now = Date.now();
  assert.ok(dates.every((date) => date.getTime() > now));
  assert.deepEqual([...dates].sort((a, b) => a.getTime() - b.getTime()), dates);
  const horizon = addDays(new Date(), 7).getTime();
  assert.ok(dates.every((date) => date.getTime() < horizon));
  assert.match(dated()[0].content.title, /Petit-déjeuner|Déjeuner/);
});

test('heure personnalisée d\'un créneau : prise en compte dans les rappels', async () => {
  importNutritionPlan(buildNutritionPlan());
  setSlotTime('Petit-déjeuner', '06:05');
  await reschedule();
  const breakfasts = dated().filter((s) => /Petit-déjeuner/.test(s.content.title));
  assert.ok(breakfasts.length >= 6);
  assert.ok(breakfasts.every((s) => s.trigger.date!.getHours() === 6 && s.trigger.date!.getMinutes() === 5));
});

test('plan pathologique à 10 repas par jour : plafonné à 60 rappels', async () => {
  const plan = buildNutritionPlan();
  for (const day of plan.days) {
    for (let i = 0; i < 8; i++) {
      day.meals.push({ name: `Collation ${i + 1}`, time: `23:${String(50 + i).padStart(2, '0')}`, freeNote: 'Encas' });
    }
  }
  importNutritionPlan(plan);
  await reschedule();
  assert.equal(scheduled.length, 60);
});

test('sport en séances fixes : un rappel hebdomadaire par jour d\'entraînement, posé avant les repas', async () => {
  importNutritionPlan(buildNutritionPlan());
  const sport = parseSportPlan(JSON.stringify(buildFixedSportPlan()));
  assert.ok(sport.success);
  if (!sport.success) return;
  importSportPlan(sport.data);
  await reschedule();

  const weekly = scheduled.filter((s) => s.trigger.type === 'weekly');
  assert.equal(weekly.length, 1);
  assert.equal(weekly[0].trigger.weekday, 2, 'lundi = 2 pour expo-notifications');
  assert.deepEqual([weekly[0].trigger.hour], [18]);
  assert.equal(scheduled[0].trigger.type, 'weekly', 'le sport est programmé en premier');
});

test('sport en mode continu : aucun rappel automatique', async () => {
  const sport = parseSportPlan(JSON.stringify(buildContinuousSportPlan()));
  assert.ok(sport.success);
  if (!sport.success) return;
  importSportPlan(sport.data);
  await reschedule();
  assert.equal(scheduled.length, 0);
});

test('poubelles : un seul rappel par soir, regroupant les sacs, sans plan nutrition', async () => {
  const tomorrow = addDays(new Date(), 2);
  const weekday = getWeekdayLabel(tomorrow);
  setWasteBin({ id: 2, weekday, everyOtherWeek: false, anchorDate: null });
  setWasteBin({ id: 3, weekday, everyOtherWeek: false, anchorDate: null });
  await reschedule();

  const reminders = dated();
  assert.ok(reminders.length >= 2 && reminders.length <= 3, `${reminders.length} rappels sur 14 jours`);
  assert.match(reminders[0].content.body, /sacs PMC bleus et les sacs jardin verts/);
  assert.ok(reminders.every((r) => r.trigger.date!.getHours() === 19));
  const eveningOf = toDateString(addDays(parseDateString(toDateString(reminders[0].trigger.date!)), 1));
  assert.equal(getWeekdayLabel(parseDateString(eveningOf)), weekday);
});

test('rescheduleIfPermitted : reprogramme tout quand la permission est accordée', async () => {
  importNutritionPlan(buildNutritionPlan());
  assert.equal(await rescheduleIfPermitted(), true);
  assert.ok(scheduled.length > 0);
});

test('fin de repos : notification programmée, ignorée pour une durée nulle', async () => {
  assert.equal(await scheduleRestEndNotification(0), null);
  const id = await scheduleRestEndNotification(90);
  assert.ok(id);
});
