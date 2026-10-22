import { db } from '@/lib/database';
import { getSetting, setSetting } from '@/lib/settings-db';
import { DEFAULT_WASTE_REMINDER_TIME, WASTE_BIN_DEFS, type WasteBinConfig } from '@/lib/waste';

const REMINDER_TIME_KEY = 'waste_reminder_time';

/**
 * Calendrier des poubelles, saisi à la main par l'utilisateur (jours de ramassage de sa
 * commune) : comme les autres réglages, il est EXCLU de la réinitialisation de database.ts.
 * Les trois lignes sont créées d'office, sans jour : tant qu'aucun jour n'est choisi, aucun
 * rappel n'existe pour ce type.
 */
export function initWasteSchema() {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS waste_bins (
      id INTEGER PRIMARY KEY,
      weekday TEXT,
      every_other_week INTEGER NOT NULL DEFAULT 0,
      anchor_date TEXT
    );
  `);
  for (const def of WASTE_BIN_DEFS) {
    db.runSync('INSERT OR IGNORE INTO waste_bins (id, weekday, every_other_week, anchor_date) VALUES (?, NULL, 0, NULL)', def.id);
  }
}

export function getWasteBins(): WasteBinConfig[] {
  return db
    .getAllSync<{ id: number; weekday: string | null; every_other_week: number; anchor_date: string | null }>(
      'SELECT id, weekday, every_other_week, anchor_date FROM waste_bins ORDER BY id ASC',
    )
    .map((row) => ({
      id: row.id,
      weekday: row.weekday,
      everyOtherWeek: row.every_other_week === 1,
      anchorDate: row.anchor_date,
    }));
}

export function setWasteBin(bin: WasteBinConfig) {
  db.runSync(
    'UPDATE waste_bins SET weekday = ?, every_other_week = ?, anchor_date = ? WHERE id = ?',
    bin.weekday,
    bin.everyOtherWeek ? 1 : 0,
    bin.anchorDate,
    bin.id,
  );
}

/** Vrai si au moins un type de poubelle a un jour de ramassage (donc des rappels à programmer). */
export function hasWasteSchedule(): boolean {
  return getWasteBins().some((bin) => bin.weekday !== null);
}

export function getWasteReminderTime(): string {
  return getSetting(REMINDER_TIME_KEY) ?? DEFAULT_WASTE_REMINDER_TIME;
}

export function setWasteReminderTime(time: string) {
  setSetting(REMINDER_TIME_KEY, time);
}
