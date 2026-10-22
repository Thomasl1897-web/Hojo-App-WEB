import { MUSCLE_GROUPS, resolveExercise, type MuscleGroup } from '@/lib/exercise-catalog';

/** Séries par semaine et par muscle à partir desquelles la zone est « pleine » (fourchette courante : 10 à 20). */
export const FULL_WEEKLY_SETS = 12;

/** Une série sur un muscle secondaire compte pour la moitié d'une série sur un muscle principal. */
export const SECONDARY_WEIGHT = 0.5;

/** Intensité affichée pour un muscle sollicité en appoint dans la vue « un exercice ». */
export const SECONDARY_INTENSITY = 0.45;

export type MuscleIntensities = Partial<Record<MuscleGroup, number>>;

export type ExerciseSets = { name: string; sets: number; exerciseId?: string | null };

export type MuscleLoad = {
  /** Séries pondérées par muscle (principal = 1, secondaire = 0,5). */
  load: Record<MuscleGroup, number>;
  /** Noms d'exercices que le répertoire ne reconnaît pas : ils ne comptent pas dans la heatmap. */
  unknown: string[];
};

/**
 * Charge de chaque muscle pour un ensemble d'exercices. Les noms reconnus passent par le
 * répertoire ; `idsByName` (nom → identifiant du répertoire) permet de reprendre ceux que le
 * programme a lui-même associés, ce qui est plus fiable que la reconnaissance du nom.
 */
export function computeMuscleLoad(entries: ExerciseSets[], idsByName: Map<string, string> = new Map()): MuscleLoad {
  const load = Object.fromEntries(MUSCLE_GROUPS.map((group) => [group, 0])) as Record<MuscleGroup, number>;
  const unknown = new Set<string>();

  for (const entry of entries) {
    if (entry.sets <= 0) continue;
    const exercise = resolveExercise(entry.name, entry.exerciseId ?? idsByName.get(entry.name));
    if (!exercise) {
      unknown.add(entry.name);
      continue;
    }
    for (const group of exercise.primary) load[group] += entry.sets;
    for (const group of exercise.secondary) load[group] += entry.sets * SECONDARY_WEIGHT;
  }
  return { load, unknown: [...unknown] };
}

/**
 * Intensité de 0 à 1 de chaque muscle sur une période de `weeks` semaines : le nombre de séries par
 * semaine rapporté au seuil « zone pleine ». Les muscles non sollicités sont absents.
 */
export function intensitiesFromLoad(load: Record<MuscleGroup, number>, weeks: number): MuscleIntensities {
  const result: MuscleIntensities = {};
  for (const group of MUSCLE_GROUPS) {
    if (load[group] <= 0) continue;
    result[group] = Math.min(1, load[group] / Math.max(weeks, 1) / FULL_WEEKLY_SETS);
  }
  return result;
}

/**
 * Intensité relative : le muscle le plus sollicité est « plein », les autres en proportion. Pour une séance
 * ou un programme, où comparer au seuil hebdomadaire n'aurait pas de sens (une seule séance ne suffit pas
 * à remplir la semaine).
 */
export function intensitiesRelative(load: Record<MuscleGroup, number>): MuscleIntensities {
  const max = Math.max(0, ...MUSCLE_GROUPS.map((group) => load[group]));
  const result: MuscleIntensities = {};
  if (max <= 0) return result;
  for (const group of MUSCLE_GROUPS) {
    if (load[group] > 0) result[group] = load[group] / max;
  }
  return result;
}

/** Muscles d'un seul exercice : principaux à fond, secondaires atténués. */
export function intensitiesForExercise(name: string, exerciseId?: string | null): MuscleIntensities | null {
  const exercise = resolveExercise(name, exerciseId);
  if (!exercise) return null;
  const result: MuscleIntensities = {};
  for (const group of exercise.secondary) result[group] = SECONDARY_INTENSITY;
  for (const group of exercise.primary) result[group] = 1;
  return result;
}

/** Muscles classés du plus au moins sollicité (pour la légende sous la silhouette). */
export function rankMuscles(load: Record<MuscleGroup, number>): { group: MuscleGroup; sets: number }[] {
  return MUSCLE_GROUPS.filter((group) => load[group] > 0)
    .map((group) => ({ group, sets: load[group] }))
    .sort((a, b) => b.sets - a.sets);
}
