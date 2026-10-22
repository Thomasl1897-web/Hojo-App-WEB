import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { beforeEach, test } from 'node:test';

import { setLanguage } from '@/i18n';
import { createBackup, parseBackup, restoreBackup } from '@/lib/backup';
import { addDays, toDateString } from '@/lib/date';
import type { DayTotals, HealthSource, HealthStatus, RawSession } from '@/lib/health-connect';
import { getHealthDay, getLatestSleep } from '@/lib/health-db';
import type { RawSleep } from '@/lib/sleep';
import {
  AUTO_SYNC_INTERVAL_MINUTES,
  connectHealth,
  DAILY_WINDOW_DAYS,
  disconnectHealth,
  forgetHealthData,
  getLastHealthSync,
  importedActivityName,
  isHealthConnected,
  MIN_SESSION_MINUTES,
  STRENGTH,
  syncHealth,
  syncHealthIfDue,
  toImportedSessions,
} from '@/lib/health-sync';
import { buildHistory } from '@/lib/sport-history';
import {
  addSportActivity,
  completeCurrentSession,
  getAllActivityDates,
  getAllSportActivities,
  importSportPlan,
  initSportSchema,
} from '@/lib/sport-db';
import { db } from '@/lib/database';
import { parseSportPlan } from '@/lib/sport-schema';

import { buildContinuousSportPlan } from './fixtures';
import { freshDatabase } from './helpers';

beforeEach(freshDatabase);

const NOW = new Date(2026, 9, 21, 15, 0); // mercredi 21 octobre 2026, 15h

function session(id: string, daysBack: number, startHour: number, minutes: number, exerciseType: number, title?: string): RawSession {
  const start = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate() - daysBack, startHour, 0);
  return { id, startTime: start.toISOString(), endTime: new Date(start.getTime() + minutes * 60_000).toISOString(), exerciseType, title };
}

type FakeOptions = {
  sessions?: RawSession[];
  status?: HealthStatus;
  access?: boolean;
  grants?: boolean;
  kcalFor?: Record<string, number | null>;
  days?: (dayStart: Date) => DayTotals;
  sleep?: RawSleep[];
};

function fakeSource(options: FakeOptions = {}) {
  const calls = { readSessions: 0, requestAccess: 0, dayTotals: [] as { start: Date; end: Date }[] };
  const source: HealthSource = {
    status: async () => options.status ?? 'ready',
    hasAccess: async () => options.access ?? false,
    requestAccess: async () => {
      calls.requestAccess++;
      return options.grants ?? true;
    },
    readSessions: async () => {
      calls.readSessions++;
      return options.sessions ?? [];
    },
    hasSleepAccess: async () => true,
    readSleep: async () => options.sleep ?? [],
    activeKcalBetween: async (start) => {
      const match = (options.sessions ?? []).find((candidate) => candidate.startTime === start);
      return match && options.kcalFor ? (options.kcalFor[match.id] ?? null) : null;
    },
    dayTotals: async (start, end) => {
      calls.dayTotals.push({ start, end });
      return options.days ? options.days(start) : { steps: 1000, activeKcal: 100 };
    },
  };
  return { source, calls };
}

/** Connecte Health Connect (ce qui lance une première synchronisation, à l'heure donnée) et rend ce premier résultat. */
async function connected(options: FakeOptions = {}, now: Date = NOW) {
  const fake = fakeSource({ access: true, ...options });
  const result = await connectHealth(fake.source, now);
  assert.ok(result.success);
  return { ...fake, first: result.success ? result.sync : null };
}

test('les codes d\'exercice utilisés sont ceux de la bibliothèque Health Connect', () => {
  const require = createRequire(import.meta.url);
  const { ExerciseType } = require('react-native-health-connect/lib/commonjs/constants.js') as { ExerciseType: Record<string, number> };
  const expected: Record<string, number> = { RUNNING: 56, RUNNING_TREADMILL: 57, WALKING: 79, HIKING: 37, BIKING: 8, BIKING_STATIONARY: 9, SWIMMING_OPEN_WATER: 73, SWIMMING_POOL: 74, STRENGTH_TRAINING: 70, WEIGHTLIFTING: 81, CALISTHENICS: 13, YOGA: 83, STRETCHING: 71, PILATES: 48, BASKETBALL: 5, SOCCER: 64, VOLLEYBALL: 78, RUGBY: 55, HANDBALL: 35 };
  for (const [name, code] of Object.entries(expected)) assert.equal(ExerciseType[name], code, name);
  assert.deepEqual(STRENGTH, [ExerciseType.STRENGTH_TRAINING, ExerciseType.WEIGHTLIFTING, ExerciseType.CALISTHENICS]);
});

test('nom d\'une activité importée : catégorie connue, sinon titre de la montre, sinon « Autre activité »', () => {
  assert.equal(importedActivityName(56), 'Course à pied');
  assert.equal(importedActivityName(79), 'Marche');
  assert.equal(importedActivityName(9), 'Vélo');
  assert.equal(importedActivityName(74), 'Natation');
  assert.equal(importedActivityName(70), 'Musculation');
  assert.equal(importedActivityName(83), 'Yoga / étirements');
  assert.equal(importedActivityName(64), 'Sport collectif');
  assert.equal(importedActivityName(36, '  Cardio   du matin '), 'Cardio du matin');
  assert.equal(importedActivityName(36, '   '), 'Autre activité');
  assert.equal(importedActivityName(0), 'Autre activité');
  assert.equal(importedActivityName(36, 'x'.repeat(200)).length, 60);
  setLanguage('en');
  assert.equal(importedActivityName(56), 'Running');
  assert.equal(importedActivityName(0), 'Other activity');
});

test('activités importables : durée minimale, dates illisibles ignorées, jour local du début', () => {
  const sessions = toImportedSessions([
    session('ok', 1, 7, 45, 56),
    session('court', 1, 9, MIN_SESSION_MINUTES - 1, 56),
    session('limite', 1, 10, MIN_SESSION_MINUTES, 79),
    { id: 'cassee', startTime: 'pas une date', endTime: 'non plus', exerciseType: 56 },
    { ...session('nuit', 2, 23, 90, 8) },
  ]);
  assert.deepEqual(sessions.map((s) => s.externalId), ['ok', 'limite', 'nuit']);
  assert.equal(sessions[0].date, toDateString(addDays(NOW, -1)));
  assert.equal(sessions[0].durationMinutes, 45);
  assert.equal(sessions[2].date, toDateString(addDays(NOW, -2)), 'une séance commencée à 23h compte pour ce jour-là');
});

test('sans connexion, rien ne se synchronise', async () => {
  const fake = fakeSource({ sessions: [session('a', 1, 8, 30, 56)] });
  assert.equal(isHealthConnected(), false);
  assert.equal(await syncHealth(NOW, fake.source), null);
  assert.equal(await syncHealthIfDue(NOW, fake.source), null);
  assert.equal(fake.calls.readSessions, 0);
});

test('connexion : état de Health Connect, refus, accès déjà accordé, accord', async () => {
  for (const status of ['unavailable_build', 'not_installed', 'update_required'] as const) {
    const result = await connectHealth(fakeSource({ status }).source);
    assert.deepEqual(result, { success: false, reason: 'status', status });
    assert.equal(isHealthConnected(), false);
  }
  const denied = fakeSource({ grants: false });
  assert.deepEqual(await connectHealth(denied.source), { success: false, reason: 'denied', status: 'ready' });
  assert.equal(denied.calls.requestAccess, 1);
  assert.equal(isHealthConnected(), false);

  const already = fakeSource({ access: true });
  const ok = await connectHealth(already.source);
  assert.ok(ok.success);
  assert.equal(already.calls.requestAccess, 0, 'pas de nouvelle demande si l\'accès existe déjà');
  assert.equal(isHealthConnected(), true);
});

test('synchronisation : activités importées, calories, pas quotidiens, sans doublon à la resynchronisation', async () => {
  const sessions = [session('run', 1, 7, 45, 56), session('bike', 3, 18, 60, 8, 'Sortie vélo'), session('court', 1, 12, 2, 79)];
  const fake = await connected({ sessions, kcalFor: { run: 410, bike: 0 } });
  assert.deepEqual(fake.first, { imported: 2, skipped: 0, days: DAILY_WINDOW_DAYS });

  const activities = getAllSportActivities();
  assert.equal(activities.length, 2);
  const run = activities.find((a) => a.externalId === 'run')!;
  assert.deepEqual([run.name, run.durationMinutes, run.calories, run.source], ['Course à pied', 45, 410, 'health_connect']);
  assert.equal(activities.find((a) => a.externalId === 'bike')!.calories, null, '0 kcal = inconnu');

  const second = await syncHealth(NOW, fake.source);
  assert.equal(second?.imported, 0);
  assert.equal(getAllSportActivities().length, 2);
  assert.ok(getLastHealthSync());
});

test('les activités importées comptent dans la série et l\'historique, signalées comme importées', async () => {
  await connected({ sessions: [session('run', 1, 7, 45, 56)] });
  assert.deepEqual(getAllActivityDates(), [toDateString(addDays(NOW, -1))]);
  const history = buildHistory([], getAllSportActivities());
  assert.equal(history.length, 1);
  assert.equal(history[0].imported, true);

  addSportActivity('2026-10-01', 'Football', 60);
  const mixed = buildHistory([], getAllSportActivities());
  assert.deepEqual(mixed.map((entry) => [entry.title, entry.imported]), [['Course à pied', true], ['Football', false]]);
});

test('musculation : ignorée le jour où une séance du programme a déjà été faite avec l\'app', async () => {
  const parsed = parseSportPlan(JSON.stringify(buildContinuousSportPlan()));
  assert.ok(parsed.success);
  if (!parsed.success) return;
  importSportPlan(parsed.data);
  completeCurrentSession(); // aujourd'hui (date réelle de la machine)
  const today = new Date();
  const at = (hour: number) => {
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate(), hour, 0);
    return { startTime: start.toISOString(), endTime: new Date(start.getTime() + 3_600_000).toISOString() };
  };
  const sessions: RawSession[] = [
    { id: 'muscu-aujourdhui', exerciseType: 70, ...at(7) },
    { id: 'course-aujourdhui', exerciseType: 56, ...at(8) },
  ];
  const fake = await connected({ sessions }, new Date(today.getFullYear(), today.getMonth(), today.getDate(), 20, 0));
  assert.deepEqual(fake.first && [fake.first.imported, fake.first.skipped], [1, 1]);
  assert.deepEqual(getAllSportActivities().map((a) => a.externalId), ['course-aujourdhui']);
});

test('totaux quotidiens : 14 jours, journée du jour arrêtée à maintenant, un jour sans donnée = 0', async () => {
  const fake = await connected({ days: (start) => (toDateString(start) === toDateString(NOW) ? { steps: 6420, activeKcal: 310.4 } : { steps: 0, activeKcal: 0 }) });
  assert.equal(fake.calls.dayTotals.length, DAILY_WINDOW_DAYS);
  assert.equal(fake.calls.dayTotals[0].end.getTime(), NOW.getTime(), 'aujourd\'hui s\'arrête à maintenant');
  assert.equal(fake.calls.dayTotals[1].end.getTime(), fake.calls.dayTotals[0].start.getTime(), 'les jours se suivent sans trou');
  assert.deepEqual(getHealthDay(toDateString(NOW)), { date: '2026-10-21', steps: 6420, activeKcal: 310 });
  assert.deepEqual(getHealthDay('2026-10-20'), { date: '2026-10-20', steps: 0, activeKcal: 0 });
  assert.equal(getHealthDay('2026-09-01'), null);
});

test('synchronisation automatique : seulement si le dernier passage date de plus de 20 minutes', async () => {
  const fake = await connected(); // première synchronisation à NOW
  assert.equal(await syncHealthIfDue(NOW, fake.source), null, 'immédiatement : trop tôt');
  assert.equal(await syncHealthIfDue(new Date(NOW.getTime() + (AUTO_SYNC_INTERVAL_MINUTES - 1) * 60_000), fake.source), null);
  assert.ok(await syncHealthIfDue(new Date(NOW.getTime() + (AUTO_SYNC_INTERVAL_MINUTES + 1) * 60_000), fake.source));
});

test('une erreur de lecture n\'interrompt pas l\'app en synchronisation automatique', async () => {
  const fake = await connected();
  const broken: HealthSource = { ...fake.source, readSessions: async () => { throw new Error('Health Connect indisponible'); } };
  const later = new Date(NOW.getTime() + 60 * 60_000);
  assert.equal(await syncHealthIfDue(later, broken), null);
  await assert.rejects(() => syncHealth(NOW, broken), /indisponible/);
});

test('déconnexion : la synchronisation s\'arrête, les données restent ; oublier efface seulement l\'importé', async () => {
  const fake = await connected({ sessions: [session('run', 1, 7, 45, 56)] });
  addSportActivity('2026-10-02', 'Yoga', 30);

  disconnectHealth();
  assert.equal(isHealthConnected(), false);
  assert.equal(getLastHealthSync(), null);
  assert.equal(await syncHealth(NOW, fake.source), null);
  assert.equal(getAllSportActivities().length, 2);

  assert.equal(forgetHealthData(), 1);
  assert.deepEqual(getAllSportActivities().map((a) => a.name), ['Yoga']);
  assert.equal(getHealthDay(toDateString(NOW)), null);
});

test('sauvegarde : les activités importées sont conservées sans se dupliquer à la resynchronisation', async () => {
  const sessions = [session('run', 1, 7, 45, 56)];
  await connected({ sessions, kcalFor: { run: 300 } });
  const raw = JSON.stringify(createBackup());

  freshDatabase();
  const parsed = parseBackup(raw);
  assert.ok(parsed.success);
  if (!parsed.success) return;
  restoreBackup(parsed.data);
  const [restored] = getAllSportActivities();
  assert.deepEqual([restored.source, restored.externalId, restored.calories], ['health_connect', 'run', 300]);

  const again = await connected({ sessions, kcalFor: { run: 300 } });
  assert.equal(again.first?.imported, 0, 'déjà importée : pas de doublon après restauration');
  assert.equal(getAllSportActivities().length, 1);
});

test('une ancienne sauvegarde (activités sans origine) se restaure comme saisies à la main', () => {
  addSportActivity('2026-10-05', 'Football', 90);
  const old = JSON.parse(JSON.stringify(createBackup()));
  for (const activity of old.sportActivities) {
    delete activity.source;
    delete activity.externalId;
    delete activity.calories;
  }
  const parsed = parseBackup(JSON.stringify(old));
  assert.ok(parsed.success);
  if (!parsed.success) return;
  restoreBackup(parsed.data);
  const [activity] = getAllSportActivities();
  assert.deepEqual([activity.source, activity.externalId, activity.calories], [null, null, null]);
});

test('migration : une base d\'avant Health Connect garde ses activités', () => {
  db.execSync('DROP TABLE sport_activities');
  db.execSync('CREATE TABLE sport_activities (id INTEGER PRIMARY KEY AUTOINCREMENT, date TEXT NOT NULL, name TEXT NOT NULL, duration_minutes INTEGER)');
  db.runSync("INSERT INTO sport_activities (date, name, duration_minutes) VALUES ('2026-09-01', 'Vélo', 40)");
  initSportSchema();
  initSportSchema();
  const [activity] = getAllSportActivities();
  assert.deepEqual([activity.name, activity.source, activity.externalId], ['Vélo', null, null]);
  assert.throws(() => {
    db.runSync("INSERT INTO sport_activities (date, name, external_id) VALUES ('2026-09-02', 'A', 'x')");
    db.runSync("INSERT INTO sport_activities (date, name, external_id) VALUES ('2026-09-02', 'B', 'x')");
  }, 'un identifiant externe ne peut pas être importé deux fois');
});

test('sommeil : nuits importées à la synchronisation, permission absente sans conséquence, effacées avec les données', async () => {
  const wake = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate(), 7, 0);
  const sleep: RawSleep[] = [
    { id: 'n1', startTime: new Date(wake.getTime() - 480 * 60_000).toISOString(), endTime: wake.toISOString(), stages: [] },
  ];
  await connected({ sleep });
  const night = getLatestSleep(toDateString(NOW));
  assert.ok(night);
  assert.equal(night.asleepMinutes, 480);
  assert.equal(getLatestSleep(toDateString(addDays(NOW, 1))), null);

  forgetHealthData();
  assert.equal(getLatestSleep('2000-01-01'), null);

  // Une lecture du sommeil qui échoue (permission manquante) n'empêche ni la synchronisation ni les pas.
  const failing = fakeSource({ access: true });
  failing.source.readSleep = async () => {
    throw new Error('permission');
  };
  const result = await syncHealth(NOW, failing.source);
  assert.ok(result);
  assert.ok(getHealthDay(toDateString(NOW)));
});
