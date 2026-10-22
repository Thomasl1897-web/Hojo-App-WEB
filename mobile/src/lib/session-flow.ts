import type { Exercise } from '@/lib/sport-schema';

/**
 * Déroulé d'une séance en direct : quelle série vient ensuite, et quel repos prendre avant.
 *
 * Exercice simple : toutes ses séries, puis l'exercice suivant.
 * Superset (exercices CONSÉCUTIFS de même `superset`) : on alterne. Série 1 du premier, série 1 du second,
 * repos, série 2 du premier… Un exercice du groupe qui a moins de séries est sauté quand il n'en a plus.
 */

export type Position = { exerciseIndex: number; currentSet: number };

type FlowExercise = Pick<Exercise, 'sets' | 'restSeconds' | 'superset'>;

/** Premier et dernier index du superset qui contient `index` (l'exercice seul s'il n'en fait pas partie). */
export function supersetBounds(exercises: FlowExercise[], index: number): { start: number; end: number } {
  const group = exercises[index]?.superset;
  if (group === undefined) return { start: index, end: index };
  let start = index;
  while (start > 0 && exercises[start - 1].superset === group) start--;
  let end = index;
  while (end < exercises.length - 1 && exercises[end + 1].superset === group) end++;
  return { start, end };
}

/** Position qui suit la série `currentSet` de l'exercice `exerciseIndex`, ou null si la séance est finie. */
export function nextPosition(exercises: FlowExercise[], exerciseIndex: number, currentSet: number): Position | null {
  if (!exercises[exerciseIndex]) return null;
  const { start, end } = supersetBounds(exercises, exerciseIndex);

  // Même tour de superset : l'exercice suivant du groupe qui a encore cette série.
  for (let i = exerciseIndex + 1; i <= end; i++) {
    if (exercises[i].sets >= currentSet) return { exerciseIndex: i, currentSet };
  }
  // Tour suivant : le premier exercice du groupe qui a la série d'après.
  for (let i = start; i <= end; i++) {
    if (exercises[i].sets >= currentSet + 1) return { exerciseIndex: i, currentSet: currentSet + 1 };
  }
  return end + 1 < exercises.length ? { exerciseIndex: end + 1, currentSet: 1 } : null;
}

/**
 * Repos à prendre après cette série. Dans un superset, on enchaîne sans repos tant que le tour n'est pas fini ;
 * en fin de tour, le repos est le plus long indiqué dans le groupe (en général porté par le dernier exercice).
 */
export function restAfter(exercises: FlowExercise[], exerciseIndex: number, currentSet: number): number {
  const exercise = exercises[exerciseIndex];
  if (!exercise) return 0;
  const { start, end } = supersetBounds(exercises, exerciseIndex);
  if (start === end) return exercise.restSeconds;
  const next = nextPosition(exercises, exerciseIndex, currentSet);
  const sameRound = next !== null && next.currentSet === currentSet && next.exerciseIndex <= end;
  if (sameRound) return 0;
  return Math.max(...exercises.slice(start, end + 1).map((candidate) => candidate.restSeconds));
}

/** Rang dans le superset (1-based) et taille du groupe, ou null pour un exercice seul. */
export function supersetInfo(exercises: FlowExercise[], index: number): { label: string; rank: number; size: number } | null {
  const group = exercises[index]?.superset;
  if (group === undefined) return null;
  const { start, end } = supersetBounds(exercises, index);
  if (start === end) return null;
  return { label: group, rank: index - start + 1, size: end - start + 1 };
}
