import { z } from 'zod';

import { t } from '@/i18n';
import { db } from '@/lib/database';
import { reloadHapticsPreference } from '@/lib/haptics';
import { applyLanguagePreference } from '@/lib/language';
import { getActivePlanMeta, importNutritionPlan, setCycleStartDate } from '@/lib/nutrition-db';
import { parseNutritionPlan } from '@/lib/nutrition-schema';
import { applyThemePreference, getSetting, getThemePreference, setSetting } from '@/lib/settings-db';
import { importSportPlan } from '@/lib/sport-db';
import { parseSportPlan } from '@/lib/sport-schema';
import { WASTE_BIN_DEFS } from '@/lib/waste';

export const BACKUP_APP_ID = 'assistant-personnel';
export const BACKUP_VERSION = 1;

/** Clé (dans app_settings) de la date du dernier export : un détail de l'app, pas à sauvegarder. */
const LAST_EXPORT_KEY = 'last_backup_export_at';

export type PlanKind = 'nutrition' | 'sport';

/**
 * Texte d'origine du dernier plan importé (nutrition / sport). Un plan importé n'existe en base
 * que sous forme éclatée en tables ; le garder tel quel permet de le remettre dans une
 * sauvegarde puis de le réimporter par le chemin normal (mêmes validations). Table exclue de la
 * réinitialisation de database.ts.
 */
export function initBackupSchema() {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS plan_sources (
      kind TEXT PRIMARY KEY,
      json TEXT NOT NULL
    );
  `);
}

export function savePlanSource(kind: PlanKind, raw: string) {
  db.runSync('INSERT OR REPLACE INTO plan_sources (kind, json) VALUES (?, ?)', kind, raw.trim());
}

export function getPlanSource(kind: PlanKind): string | null {
  return db.getFirstSync<{ json: string }>('SELECT json FROM plan_sources WHERE kind = ?', kind)?.json ?? null;
}

export function getLastExportAt(): string | null {
  return getSetting(LAST_EXPORT_KEY);
}

export function markExported(date: Date) {
  setSetting(LAST_EXPORT_KEY, date.toISOString());
}

const backupSchema = z.object({
  app: z.literal(BACKUP_APP_ID),
  version: z.number().int().min(1),
  createdAt: z.string(),
  settings: z.array(z.object({ key: z.string(), value: z.string() })),
  slotTimes: z.array(z.object({ slotName: z.string(), time: z.string() })),
  shoppingItems: z.array(z.object({ name: z.string(), quantity: z.string().nullable(), checked: z.boolean() })),
  wasteBins: z.array(
    z.object({
      id: z.number().int(),
      weekday: z.string().nullable(),
      everyOtherWeek: z.boolean(),
      anchorDate: z.string().nullable(),
    }),
  ),
  sportLogs: z.array(
    z.object({
      exerciseName: z.string(),
      setNumber: z.number().int(),
      weight: z.number(),
      // Absent des sauvegardes faites avant la saisie des répétitions : inconnu, pas de refus.
      reps: z.number().int().nullable().default(null),
      loggedAt: z.string(),
    }),
  ),
  sportCompletions: z.array(z.object({ date: z.string(), sessionName: z.string() })),
  // Absent des sauvegardes faites avant l'ajout des activités manuelles : défaut vide, pas de refus.
  sportActivities: z
    .array(
      z.object({
        date: z.string(),
        name: z.string(),
        durationMinutes: z.number().int().nullable(),
        // Activités importées de Health Connect : absents des sauvegardes plus anciennes (saisies à la main).
        source: z.string().nullable().default(null),
        externalId: z.string().nullable().default(null),
        calories: z.number().int().nullable().default(null),
      }),
    )
    .default([]),
  sportProgress: z.object({ currentIndex: z.number().int(), lastCompletedAt: z.string().nullable() }).nullable(),
  nutritionCycleStart: z.string().nullable(),
  plans: z.object({ nutrition: z.string().nullable(), sport: z.string().nullable() }),
});

export type BackupFile = z.infer<typeof backupSchema>;

export function createBackup(now: Date = new Date()): BackupFile {
  return {
    app: BACKUP_APP_ID,
    version: BACKUP_VERSION,
    createdAt: now.toISOString(),
    settings: db
      .getAllSync<{ key: string; value: string }>('SELECT key, value FROM app_settings WHERE key != ? ORDER BY key ASC', LAST_EXPORT_KEY)
      .map((row) => ({ key: row.key, value: row.value })),
    slotTimes: db
      .getAllSync<{ slot_name: string; time: string }>('SELECT slot_name, time FROM nutrition_slot_times')
      .map((row) => ({ slotName: row.slot_name, time: row.time })),
    shoppingItems: db
      .getAllSync<{ name: string; quantity: string | null; checked: number }>(
        'SELECT name, quantity, checked FROM shopping_custom_items ORDER BY id ASC',
      )
      .map((row) => ({ name: row.name, quantity: row.quantity, checked: row.checked === 1 })),
    wasteBins: db
      .getAllSync<{ id: number; weekday: string | null; every_other_week: number; anchor_date: string | null }>(
        'SELECT id, weekday, every_other_week, anchor_date FROM waste_bins ORDER BY id ASC',
      )
      .map((row) => ({
        id: row.id,
        weekday: row.weekday,
        everyOtherWeek: row.every_other_week === 1,
        anchorDate: row.anchor_date,
      })),
    sportLogs: db
      .getAllSync<{ exercise_name: string; set_number: number; weight: number; reps: number | null; logged_at: string }>(
        'SELECT exercise_name, set_number, weight, reps, logged_at FROM sport_exercise_logs ORDER BY id ASC',
      )
      .map((row) => ({
        exerciseName: row.exercise_name,
        setNumber: row.set_number,
        weight: row.weight,
        reps: row.reps,
        loggedAt: row.logged_at,
      })),
    sportCompletions: db
      .getAllSync<{ date: string; session_name: string }>('SELECT date, session_name FROM sport_session_completions ORDER BY date ASC')
      .map((row) => ({ date: row.date, sessionName: row.session_name })),
    sportActivities: db
      .getAllSync<{
        date: string;
        name: string;
        duration_minutes: number | null;
        source: string | null;
        external_id: string | null;
        calories: number | null;
      }>('SELECT date, name, duration_minutes, source, external_id, calories FROM sport_activities ORDER BY id ASC')
      .map((row) => ({
        date: row.date,
        name: row.name,
        durationMinutes: row.duration_minutes,
        source: row.source,
        externalId: row.external_id,
        calories: row.calories,
      })),
    sportProgress: (() => {
      const row = db.getFirstSync<{ current_index: number; last_completed_at: string | null }>(
        'SELECT current_index, last_completed_at FROM sport_progress WHERE id = 1',
      );
      return row ? { currentIndex: row.current_index, lastCompletedAt: row.last_completed_at } : null;
    })(),
    // Date d'ancrage EFFECTIVE du cycle (réglage de l'utilisateur ou date d'import) : un
    // réimport du plan la remettrait à "aujourd'hui" et ferait perdre la position dans le cycle.
    nutritionCycleStart: getActivePlanMeta()?.cycleStartDate ?? null,
    plans: { nutrition: getPlanSource('nutrition'), sport: getPlanSource('sport') },
  };
}

export type BackupSummary = {
  weightEntries: number;
  sessionsDone: number;
  activities: number;
  shoppingItems: number;
  settings: number;
  hasNutritionPlan: boolean;
  hasSportPlan: boolean;
};

export function summarizeBackup(backup: BackupFile): BackupSummary {
  return {
    weightEntries: backup.sportLogs.length,
    sessionsDone: backup.sportCompletions.length,
    activities: backup.sportActivities.length,
    shoppingItems: backup.shoppingItems.length,
    settings: backup.settings.length + backup.slotTimes.length + backup.wasteBins.filter((bin) => bin.weekday).length,
    hasNutritionPlan: backup.plans.nutrition !== null,
    hasSportPlan: backup.plans.sport !== null,
  };
}

export type ParseBackupResult = { success: true; data: BackupFile } | { success: false; error: string };

export function parseBackup(raw: string): ParseBackupResult {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { success: false, error: t("Ce fichier n'est pas une sauvegarde valide (JSON illisible).") };
  }

  const parsed = backupSchema.safeParse(json);
  if (!parsed.success) {
    const looksLikeBackup = typeof json === 'object' && json !== null && (json as { app?: unknown }).app === BACKUP_APP_ID;
    return {
      success: false,
      error: looksLikeBackup
        ? t('Cette sauvegarde est incomplète ou abîmée : elle ne peut pas être restaurée.')
        : t("Ce fichier n'est pas une sauvegarde de Hojo."),
    };
  }
  if (parsed.data.version > BACKUP_VERSION) {
    return {
      success: false,
      error: t("Cette sauvegarde vient d'une version plus récente de l'app : mets l'app à jour avant de la restaurer."),
    };
  }
  return { success: true, data: parsed.data };
}

export type RestoreResult = { warnings: string[] };

/**
 * Remplace les données de l'utilisateur par celles de la sauvegarde, puis réimporte les plans
 * qu'elle contient. Tout ce qui est écrit directement en base se fait dans UNE transaction : un
 * échec en cours de route n'en laisse pas la moitié. Un plan absent de la sauvegarde laisse le
 * plan actuel intact (ce n'est pas une suppression).
 *
 * Non sauvegardés, volontairement : les repas cochés et les articles de courses du plan cochés
 * (leurs identifiants sont recréés à chaque import de plan, ils ne seraient plus reliés à rien).
 */
export function restoreBackup(backup: BackupFile): RestoreResult {
  const warnings: string[] = [];

  db.withTransactionSync(() => {
    db.runSync('DELETE FROM app_settings');
    for (const { key, value } of backup.settings) {
      db.runSync('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)', key, value);
    }

    db.runSync('DELETE FROM nutrition_slot_times');
    for (const { slotName, time } of backup.slotTimes) {
      db.runSync('INSERT OR REPLACE INTO nutrition_slot_times (slot_name, time) VALUES (?, ?)', slotName, time);
    }

    db.runSync('DELETE FROM shopping_custom_items');
    for (const item of backup.shoppingItems) {
      db.runSync('INSERT INTO shopping_custom_items (name, quantity, checked) VALUES (?, ?, ?)', item.name, item.quantity, item.checked ? 1 : 0);
    }

    // Les types de poubelles sont fixes : on remet tout à zéro puis on applique ceux connus,
    // sans créer de ligne pour un identifiant inconnu (sauvegarde d'une autre version).
    db.runSync('UPDATE waste_bins SET weekday = NULL, every_other_week = 0, anchor_date = NULL');
    const knownIds = new Set(WASTE_BIN_DEFS.map((def) => def.id));
    for (const bin of backup.wasteBins) {
      if (!knownIds.has(bin.id)) continue;
      db.runSync(
        'UPDATE waste_bins SET weekday = ?, every_other_week = ?, anchor_date = ? WHERE id = ?',
        bin.weekday,
        bin.everyOtherWeek ? 1 : 0,
        bin.anchorDate,
        bin.id,
      );
    }

    db.runSync('DELETE FROM sport_exercise_logs');
    for (const log of backup.sportLogs) {
      db.runSync(
        'INSERT INTO sport_exercise_logs (exercise_name, set_number, weight, reps, logged_at) VALUES (?, ?, ?, ?, ?)',
        log.exerciseName,
        log.setNumber,
        log.weight,
        log.reps,
        log.loggedAt,
      );
    }

    db.runSync('DELETE FROM sport_session_completions');
    for (const completion of backup.sportCompletions) {
      db.runSync('INSERT OR REPLACE INTO sport_session_completions (date, session_name) VALUES (?, ?)', completion.date, completion.sessionName);
    }
    db.runSync('DELETE FROM sport_activities');
    for (const activity of backup.sportActivities) {
      db.runSync(
        'INSERT INTO sport_activities (date, name, duration_minutes, source, external_id, calories) VALUES (?, ?, ?, ?, ?, ?)',
        activity.date,
        activity.name,
        activity.durationMinutes,
        activity.source,
        activity.externalId,
        activity.calories,
      );
    }
    // Une séance en cours d'un autre appareil / d'un autre jour n'a plus de sens.
    db.runSync('DELETE FROM sport_session_progress');

    db.runSync('DELETE FROM plan_sources');
    for (const kind of ['nutrition', 'sport'] as const) {
      const source = backup.plans[kind];
      if (source !== null) db.runSync('INSERT INTO plan_sources (kind, json) VALUES (?, ?)', kind, source);
    }
  });

  // Les plans passent par les importeurs normaux (qui ont leur propre transaction).
  if (backup.plans.nutrition !== null) {
    const result = parseNutritionPlan(backup.plans.nutrition);
    if (result.success) {
      importNutritionPlan(result.data);
      if (backup.nutritionCycleStart) setCycleStartDate(backup.nutritionCycleStart);
    } else {
      warnings.push(t("Le plan nutrition de la sauvegarde n'a pas pu être relu ({error}). Réimporte-le depuis son fichier.", { error: result.error }));
    }
  }

  if (backup.plans.sport !== null) {
    const result = parseSportPlan(backup.plans.sport);
    if (result.success) {
      importSportPlan(result.data);
      // L'import remet la progression du mode continu à zéro : on rétablit la position sauvegardée.
      if (backup.sportProgress && result.data.mode === 'continu') {
        db.runSync(
          'UPDATE sport_progress SET current_index = ?, last_completed_at = ? WHERE id = 1',
          backup.sportProgress.currentIndex,
          backup.sportProgress.lastCompletedAt,
        );
      }
    } else {
      warnings.push(t("Le programme sport de la sauvegarde n'a pas pu être relu ({error}). Réimporte-le depuis son fichier.", { error: result.error }));
    }
  }

  // Le thème restauré doit s'appliquer tout de suite, sans attendre le prochain lancement.
  applyThemePreference(getThemePreference());
  applyLanguagePreference();
  reloadHapticsPreference();
  return { warnings };
}
