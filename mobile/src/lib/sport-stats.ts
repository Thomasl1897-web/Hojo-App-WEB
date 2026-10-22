import { decimalSeparator, getLanguage } from '@/i18n';
import { addDays, parseDateString, toDateString } from '@/lib/date';

export type WeekCount = { weekStart: string; count: number };

/** Lundi (minuit local) de la semaine contenant `date`. */
export function mondayOf(date: Date): Date {
  const daysSinceMonday = (date.getDay() + 6) % 7;
  return addDays(new Date(date.getFullYear(), date.getMonth(), date.getDate()), -daysSinceMonday);
}

/**
 * Nombre de séances par semaine (semaines du lundi au dimanche) sur les `weeks` dernières
 * semaines, la plus ancienne d'abord ; la dernière est la semaine en cours.
 */
export function weeklyCounts(dates: string[], weeks: number, today: Date): WeekCount[] {
  const currentMonday = mondayOf(today);
  const buckets: WeekCount[] = [];
  for (let index = weeks - 1; index >= 0; index--) {
    buckets.push({ weekStart: toDateString(addDays(currentMonday, -7 * index)), count: 0 });
  }
  const byWeek = new Map(buckets.map((bucket) => [bucket.weekStart, bucket]));
  for (const date of dates) {
    const bucket = byWeek.get(toDateString(mondayOf(parseDateString(date))));
    if (bucket) bucket.count++;
  }
  return buckets;
}

/**
 * Nombre de semaines consécutives avec au moins une séance. La semaine en cours ne casse pas la
 * série tant qu'elle n'est pas terminée : si elle est encore vide, on compte à partir de la
 * précédente.
 */
export function currentStreakWeeks(dates: string[], today: Date): number {
  const trainedWeeks = new Set(dates.map((date) => toDateString(mondayOf(parseDateString(date)))));
  const currentMonday = mondayOf(today);

  let cursor = trainedWeeks.has(toDateString(currentMonday)) ? currentMonday : addDays(currentMonday, -7);
  let streak = 0;
  while (trainedWeeks.has(toDateString(cursor))) {
    streak++;
    cursor = addDays(cursor, -7);
  }
  return streak;
}

/** Plus longue série de semaines consécutives avec au moins une séance, sur tout l'historique. */
export function bestStreakWeeks(dates: string[]): number {
  const weeks = [...new Set(dates.map((date) => toDateString(mondayOf(parseDateString(date)))))].sort();
  let best = 0;
  let run = 0;
  let previous: string | null = null;
  for (const week of weeks) {
    const isNext = previous !== null && toDateString(addDays(parseDateString(previous), 7)) === week;
    run = isNext ? run + 1 : 1;
    best = Math.max(best, run);
    previous = week;
  }
  return best;
}

/** Nombre de séances de la semaine en cours (du lundi à aujourd'hui). */
export function sessionsThisWeek(dates: string[], today: Date): number {
  const currentMonday = toDateString(mondayOf(today));
  return dates.filter((date) => toDateString(mondayOf(parseDateString(date))) === currentMonday).length;
}

export type LogRow = { date: string; setNumber: number; weight: number; reps?: number | null };

export type ExercisePoint = {
  date: string;
  maxWeight: number;
  avgWeight: number;
  sets: number;
  /** Total des répétitions du jour, null si aucune série n'a de répétitions saisies (anciennes données). */
  reps: number | null;
  /**
   * Volume du jour : somme de charge × répétitions de chaque série (en kg). Une série au poids du
   * corps (charge 0) compte ses répétitions telles quelles. Null sans répétitions saisies.
   */
  volume: number | null;
};

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Une ligne par jour d'entraînement. Si une séance a été refaite le même jour, la DERNIÈRE
 * charge saisie pour chaque série fait foi (les lignes arrivent dans l'ordre d'enregistrement) :
 * sinon les séries seraient comptées en double.
 */
export function buildExerciseSeries(rows: LogRow[]): ExercisePoint[] {
  const latest = new Map<string, { date: string; weight: number; reps: number | null }>();
  for (const row of rows) {
    latest.set(`${row.date}|${row.setNumber}`, { date: row.date, weight: row.weight, reps: row.reps ?? null });
  }

  const byDate = new Map<string, { weight: number; reps: number | null }[]>();
  for (const { date, weight, reps } of latest.values()) {
    const sets = byDate.get(date) ?? [];
    sets.push({ weight, reps });
    byDate.set(date, sets);
  }

  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, sets]) => {
      const weights = sets.map((set) => set.weight);
      const withReps = sets.filter((set): set is { weight: number; reps: number } => set.reps !== null);
      return {
        date,
        maxWeight: Math.max(...weights),
        avgWeight: round1(weights.reduce((sum, weight) => sum + weight, 0) / weights.length),
        sets: sets.length,
        reps: withReps.length > 0 ? withReps.reduce((sum, set) => sum + set.reps, 0) : null,
        volume:
          withReps.length > 0
            ? Math.round(withReps.reduce((sum, set) => sum + (set.weight > 0 ? set.weight : 1) * set.reps, 0))
            : null,
      };
    });
}

export type Metric = 'max' | 'avg' | 'sets' | 'volume' | 'reps';

/** Valeur d'un point pour une mesure, null si elle n'existe pas ce jour-là (répétitions non saisies). */
export function metricValue(point: ExercisePoint, metric: Metric): number | null {
  if (metric === 'max') return point.maxWeight;
  if (metric === 'avg') return point.avgWeight;
  if (metric === 'volume') return point.volume;
  if (metric === 'reps') return point.reps;
  return point.sets;
}

/** Vrai si toutes les séries enregistrées sont au poids du corps (aucune charge) : on suit alors les répétitions. */
export function isBodyweightSeries(points: ExercisePoint[]): boolean {
  return points.length > 0 && points.every((point) => point.maxWeight === 0) && points.some((point) => point.reps !== null);
}

/** Points des `days` derniers jours (null = tout l'historique). */
export function filterByRange(points: ExercisePoint[], days: number | null, today: Date): ExercisePoint[] {
  if (days === null) return points;
  const start = toDateString(addDays(today, -(days - 1)));
  return points.filter((point) => point.date >= start);
}

/** "42,5 kg" / "42.5 kg", "40 kg" (séparateur de la langue, pas de décimale inutile). */
export function formatWeight(value: number): string {
  const rounded = round1(value);
  return `${String(rounded).replace('.', decimalSeparator())} kg`;
}

/** "42,5" / "40" — pour les axes, sans unité. */
export function formatNumber(value: number): string {
  return String(round1(value)).replace('.', decimalSeparator());
}

/** "14/10" (français) ou "10/14" (anglais) depuis "2026-10-14". */
export function formatShortDate(isoDate: string): string {
  const [, month, day] = isoDate.split('-');
  return getLanguage() === 'en' ? `${month}/${day}` : `${day}/${month}`;
}

const AXIS_STEPS = [0.5, 1, 2, 2.5, 5, 10, 20, 25, 30, 40, 50, 60, 75, 100, 200, 500];
const INTEGER_AXIS_STEPS = [1, 2, 5, 10, 20, 50, 100, 200, 500];

/**
 * Bornes "rondes" pour l'axe vertical d'une courbe : trois graduations (bas, milieu, haut)
 * espacées d'un pas lisible, au lieu de valeurs comme 46,3 issues d'une simple marge. Le bas est
 * toujours un multiple d'un demi-pas, donc les trois graduations restent lisibles (35 / 45 / 55).
 * Il ne descend jamais sous 0, et une courbe plate est centrée au lieu de coller au bord.
 * `integer` : pour des comptes (nombre de séries), toutes les graduations sont des entiers.
 */
export function niceAxis(min: number, max: number, options: { integer?: boolean } = {}): { min: number; max: number } {
  const flat = min === max;
  const pad = flat ? 1 : (max - min) * 0.1;
  const low = Math.max(0, min - pad);
  const high = max + pad;

  const steps = options.integer ? INTEGER_AXIS_STEPS : AXIS_STEPS;
  for (const step of steps) {
    const unit = options.integer ? 1 : step / 2;
    const niceMin = Math.floor(low / unit) * unit;
    const niceMax = niceMin + 2 * step;
    if (niceMax >= high) return { min: niceMin, max: niceMax };
  }
  return { min: low, max: high };
}

/**
 * Exercices "d'accompagnement" dont on ne suit pas la charge : échauffement, retour au calme,
 * étirements. Reconnus à leur NOM (sans tenir compte des accents ni de la casse) : "Échauffement
 * articulaire", "warm-up", "Étirements des ischios"... Ils n'ont rien à faire dans les graphiques
 * de progression, et l'écran de séance ne demande pas de poids pour eux.
 */
export function isAuxiliaryExercise(name: string): boolean {
  const normalized = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  return /(^|[^a-z])(echauffement|warm[\s-]?up|retour au calme|cool[\s-]?down|etirements?|stretching)([^a-z]|$)/.test(normalized);
}
