import { db } from '@/lib/database';
import type { SleepNight } from '@/lib/sleep';

/**
 * Totaux quotidiens importés de Health Connect (pas, calories actives). Table EXCLUE de la
 * réinitialisation de database.ts, comme les autres données de l'utilisateur ; elle n'est pas dans la
 * sauvegarde car la prochaine synchronisation la reconstruit.
 */
export function initHealthSchema() {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS health_daily (
      date TEXT PRIMARY KEY,
      steps INTEGER NOT NULL,
      active_kcal INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS health_sleep (
      date TEXT PRIMARY KEY,
      asleep_minutes INTEGER NOT NULL,
      deep_minutes INTEGER NOT NULL,
      rem_minutes INTEGER NOT NULL,
      light_minutes INTEGER NOT NULL,
      awake_minutes INTEGER NOT NULL,
      in_bed_minutes INTEGER NOT NULL,
      has_stages INTEGER NOT NULL,
      score INTEGER NOT NULL
    );
  `);
}

export type HealthDay = { date: string; steps: number; activeKcal: number };

export function upsertHealthDays(days: HealthDay[]) {
  db.withTransactionSync(() => {
    for (const day of days) {
      db.runSync(
        'INSERT OR REPLACE INTO health_daily (date, steps, active_kcal) VALUES (?, ?, ?)',
        day.date,
        Math.max(0, Math.round(day.steps)),
        Math.max(0, Math.round(day.activeKcal)),
      );
    }
  });
}

export function getHealthDay(date: string): HealthDay | null {
  const row = db.getFirstSync<{ date: string; steps: number; active_kcal: number }>(
    'SELECT date, steps, active_kcal FROM health_daily WHERE date = ?',
    date,
  );
  return row ? { date: row.date, steps: row.steps, activeKcal: row.active_kcal } : null;
}

export function clearHealthDays() {
  db.runSync('DELETE FROM health_daily');
  db.runSync('DELETE FROM health_sleep');
}

export function upsertSleepNights(nights: SleepNight[]) {
  db.withTransactionSync(() => {
    for (const night of nights) {
      db.runSync(
        `INSERT OR REPLACE INTO health_sleep
          (date, asleep_minutes, deep_minutes, rem_minutes, light_minutes, awake_minutes, in_bed_minutes, has_stages, score)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        night.date,
        night.asleepMinutes,
        night.deepMinutes,
        night.remMinutes,
        night.lightMinutes,
        night.awakeMinutes,
        night.inBedMinutes,
        night.hasStages ? 1 : 0,
        night.score,
      );
    }
  });
}

type SleepRow = {
  date: string;
  asleep_minutes: number;
  deep_minutes: number;
  rem_minutes: number;
  light_minutes: number;
  awake_minutes: number;
  in_bed_minutes: number;
  has_stages: number;
  score: number;
};

/** Nuit la plus récente dont le jour de réveil est `sinceDate` ou plus tard (null s'il n'y en a pas). */
export function getLatestSleep(sinceDate: string): SleepNight | null {
  const row = db.getFirstSync<SleepRow>('SELECT * FROM health_sleep WHERE date >= ? ORDER BY date DESC LIMIT 1', sinceDate);
  if (!row) return null;
  return {
    date: row.date,
    asleepMinutes: row.asleep_minutes,
    deepMinutes: row.deep_minutes,
    remMinutes: row.rem_minutes,
    lightMinutes: row.light_minutes,
    awakeMinutes: row.awake_minutes,
    inBedMinutes: row.in_bed_minutes,
    hasStages: row.has_stages === 1,
    score: row.score,
  };
}
