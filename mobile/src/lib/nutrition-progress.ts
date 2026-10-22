import type { Macros, MealRow } from '@/lib/nutrition-db';

const ZERO: Macros = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };

/**
 * Macros des repas cochés. Les repas libres (restaurant, sortie) n'ont pas de macros dans le
 * plan : ils ne comptent pas, plutôt que d'être estimés à l'aveugle.
 */
export function sumConsumedMacros(meals: MealRow[], completedIds: Set<number>): Macros {
  const total = { ...ZERO };
  for (const meal of meals) {
    if (!completedIds.has(meal.id) || !meal.macros) continue;
    total.calories += meal.macros.calories;
    total.protein += meal.macros.protein;
    total.carbs += meal.macros.carbs;
    total.fat += meal.macros.fat;
    total.fiber += meal.macros.fiber;
  }
  return total;
}

/** Rapport consommé / prévu (0 si rien n'est prévu). Peut dépasser 1 : le jour est "dépassé". */
export function progressRatio(consumed: number, planned: number): number {
  return planned > 0 ? consumed / planned : 0;
}
