import { msg, t } from '@/i18n';
import { addDays, toDateString } from '@/lib/date';
import { nativeHealthSource, type HealthSource, type HealthStatus, type RawSession } from '@/lib/health-connect';
import { clearHealthDays, upsertHealthDays, upsertSleepNights, type HealthDay } from '@/lib/health-db';
import { summarizeSleep } from '@/lib/sleep';
import { deleteSetting, getSetting, setSetting } from '@/lib/settings-db';
import { addImportedActivity, deleteImportedActivities, getImportedExternalIds, hasCompletedProgramSession } from '@/lib/sport-db';

const CONNECTED_KEY = 'health_connected';
const LAST_SYNC_KEY = 'health_last_sync';

/** Jours d'activités relus à chaque synchronisation (Health Connect donne 30 jours avant l'autorisation). */
export const SESSION_WINDOW_DAYS = 30;
/** Jours de pas et de calories relus à chaque synchronisation. */
export const DAILY_WINDOW_DAYS = 14;
/** Une activité plus courte n'est pas importée : un trajet ou un geste capté par une montre n'est pas une séance. */
export const MIN_SESSION_MINUTES = 5;
/** Jours de sommeil relus à chaque synchronisation. */
export const SLEEP_WINDOW_DAYS = 14;
/** Délai minimal entre deux synchronisations automatiques. */
export const AUTO_SYNC_INTERVAL_MINUTES = 20;

// Codes des types d'exercice de Health Connect (les mêmes que `ExerciseType` de react-native-health-connect,
// vérifiés par un test) rangés dans les activités que l'app connaît.
const RUNNING = [56, 57];
const WALKING = [79, 37];
const CYCLING = [8, 9];
const SWIMMING = [73, 74];
export const STRENGTH = [70, 81, 13];
const YOGA = [83, 71, 48];
const TEAM_SPORTS = [5, 64, 28, 29, 55, 78, 35, 4, 38, 80, 14, 52];

const CATEGORY_NAMES: { codes: number[]; name: string }[] = [
  { codes: RUNNING, name: msg('Course à pied') },
  { codes: WALKING, name: msg('Marche') },
  { codes: CYCLING, name: msg('Vélo') },
  { codes: SWIMMING, name: msg('Natation') },
  { codes: STRENGTH, name: msg('Musculation') },
  { codes: YOGA, name: msg('Yoga / étirements') },
  { codes: TEAM_SPORTS, name: msg('Sport collectif') },
];

const MAX_TITLE_LENGTH = 60;

/** Nom d'une activité importée : celui de sa catégorie, sinon son titre (montre), sinon « Autre activité ». */
export function importedActivityName(exerciseType: number, title?: string): string {
  const category = CATEGORY_NAMES.find((candidate) => candidate.codes.includes(exerciseType));
  if (category) return t(category.name);
  const cleanTitle = title?.replace(/\s+/g, ' ').trim().slice(0, MAX_TITLE_LENGTH);
  return cleanTitle ? cleanTitle : t('Autre activité');
}

export type ImportedSession = {
  externalId: string;
  /** Jour local du début de l'activité (AAAA-MM-JJ). */
  date: string;
  name: string;
  durationMinutes: number;
  exerciseType: number;
  /** Début et fin d'origine (ISO), pour retrouver les calories de l'activité. */
  startTime: string;
  endTime: string;
};

/** Activités importables : assez longues, avec des dates lisibles. */
export function toImportedSessions(sessions: RawSession[]): ImportedSession[] {
  const result: ImportedSession[] = [];
  for (const session of sessions) {
    const start = new Date(session.startTime);
    const end = new Date(session.endTime);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) continue;
    const durationMinutes = Math.round((end.getTime() - start.getTime()) / 60_000);
    if (durationMinutes < MIN_SESSION_MINUTES) continue;
    result.push({
      externalId: session.id,
      date: toDateString(start),
      name: importedActivityName(session.exerciseType, session.title),
      durationMinutes,
      exerciseType: session.exerciseType,
      startTime: session.startTime,
      endTime: session.endTime,
    });
  }
  return result;
}

export function isHealthConnected(): boolean {
  return getSetting(CONNECTED_KEY) === '1';
}

export function getLastHealthSync(): Date | null {
  const stored = getSetting(LAST_SYNC_KEY);
  const date = stored ? new Date(stored) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

export type SyncResult = { imported: number; skipped: number; days: number };

/**
 * Relit Health Connect et met à jour l'app : nouvelles activités (sans doublon, une séance de
 * musculation du jour où une séance du programme a déjà été faite est considérée comme la même et
 * ignorée) et totaux quotidiens de pas et de calories actives. Sans effet (null) si Health Connect
 * n'est pas connecté. Les erreurs de lecture remontent à l'appelant.
 */
export async function syncHealth(now: Date = new Date(), source: HealthSource = nativeHealthSource): Promise<SyncResult | null> {
  if (!isHealthConnected()) return null;

  const sessions = toImportedSessions(await source.readSessions(addDays(now, -SESSION_WINDOW_DAYS), now));
  const known = getImportedExternalIds();
  let imported = 0;
  let skipped = 0;
  for (const session of sessions) {
    if (known.has(session.externalId)) continue;
    // La même séance de muscu, faite avec l'app et enregistrée par la montre : on ne la compte pas deux fois.
    if (STRENGTH.includes(session.exerciseType) && hasCompletedProgramSession(session.date)) {
      skipped++;
      continue;
    }
    const added = addImportedActivity({
      externalId: session.externalId,
      date: session.date,
      name: session.name,
      durationMinutes: session.durationMinutes,
      calories: await caloriesFor(session, source),
    });
    if (added) imported++;
  }

  const days: HealthDay[] = [];
  for (let back = 0; back < DAILY_WINDOW_DAYS; back++) {
    const dayStart = addDays(new Date(now.getFullYear(), now.getMonth(), now.getDate()), -back);
    const dayEnd = back === 0 ? now : addDays(dayStart, 1);
    const totals = await source.dayTotals(dayStart, dayEnd);
    days.push({ date: toDateString(dayStart), steps: totals.steps, activeKcal: totals.activeKcal });
  }
  upsertHealthDays(days);

  // Le sommeil est facultatif (permission à part, absente chez ceux qui s'étaient connectés avant) : une erreur
  // ici ne doit jamais faire échouer le reste de la synchronisation.
  try {
    upsertSleepNights(summarizeSleep(await source.readSleep(addDays(now, -SLEEP_WINDOW_DAYS), now)));
  } catch {
    // pas de sommeil cette fois
  }

  setSetting(LAST_SYNC_KEY, now.toISOString());
  return { imported, skipped, days: days.length };
}

async function caloriesFor(session: ImportedSession, source: HealthSource): Promise<number | null> {
  const kcal = await source.activeKcalBetween(session.startTime, session.endTime);
  return kcal !== null && kcal > 0 ? kcal : null;
}

/** Synchronise si connecté et si la dernière synchronisation date de plus de `AUTO_SYNC_INTERVAL_MINUTES`. */
export async function syncHealthIfDue(now: Date = new Date(), source: HealthSource = nativeHealthSource): Promise<SyncResult | null> {
  if (!isHealthConnected()) return null;
  const last = getLastHealthSync();
  if (last && now.getTime() - last.getTime() < AUTO_SYNC_INTERVAL_MINUTES * 60_000) return null;
  try {
    return await syncHealth(now, source);
  } catch {
    return null; // pas de réseau à attendre ici : on réessaiera à la prochaine ouverture
  }
}

export type ConnectResult =
  | { success: true; sync: SyncResult | null }
  | { success: false; reason: 'status' | 'denied'; status: HealthStatus };

/** Demande l'accès à Health Connect puis lance une première synchronisation. */
export async function connectHealth(source: HealthSource = nativeHealthSource, now: Date = new Date()): Promise<ConnectResult> {
  const status = await source.status();
  if (status !== 'ready') return { success: false, reason: 'status', status };
  const granted = (await source.hasAccess()) || (await source.requestAccess());
  if (!granted) return { success: false, reason: 'denied', status };
  setSetting(CONNECTED_KEY, '1');
  let sync: SyncResult | null = null;
  try {
    sync = await syncHealth(now, source);
  } catch {
    sync = null;
  }
  return { success: true, sync };
}

/** Arrête la synchronisation (les données déjà importées restent ; l'accès se retire dans Health Connect). */
export function disconnectHealth() {
  setSetting(CONNECTED_KEY, '0');
  deleteSetting(LAST_SYNC_KEY);
}

/** Efface ce qui a été importé : activités et totaux quotidiens. Les activités saisies à la main restent. */
export function forgetHealthData(): number {
  clearHealthDays();
  return deleteImportedActivities();
}
