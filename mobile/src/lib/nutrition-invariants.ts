import { t } from '@/i18n';
import type { Batch, Food, NutritionPlan, Single } from '@/lib/nutrition-schema';

export type Severity = 'error' | 'warning';

export type Violation = {
  severity: Severity;
  message: string;
};

/**
 * Bornes de plausibilité par catégorie d'aliment, en grammes PAR LIGNE D'INGRÉDIENT
 * (une occurrence dans une recette). Ce sont des seuils heuristiques de bon sens — pas
 * une référence nutritionnelle absolue — pour attraper les erreurs grossières d'un LLM
 * (ex : 3g de riz, ou 800g de beurre).
 */
const CATEGORY_BOUNDS_G: Partial<Record<Food['category'], { min: number; max: number }>> = {
  feculent: { min: 30, max: 300 },
  // min bas à dessein : cette catégorie couvre aussi les poudres (whey : 15-30g par prise),
  // pas seulement viande/poisson/oeufs
  proteine: { min: 10, max: 400 },
  legume: { min: 20, max: 500 },
  fruit: { min: 20, max: 300 },
  produit_laitier: { min: 15, max: 500 },
  matiere_grasse: { min: 2, max: 30 },
  liant_structurel: { min: 10, max: 80 },
};

/** En dessous de ce seuil, une quantité n'est pas mesurable de façon fiable à la maison. */
const MIN_MEASURABLE_G = 2;

/** Tolérance relative pour "macros recette = ingrédients × table des aliments". */
const RECIPE_MACROS_TOLERANCE = 0.03;

/** Tolérance pour "somme des repas d'un jour = totals du jour" (contrôle interne, pas de la science). */
const DAY_TOTALS_TOLERANCE = 0.01;

/** Tolérance pour "meta.base_day_kcal cohérent avec la moyenne réelle" (déclenche un avertissement). */
const BASE_DAY_KCAL_WARNING_TOLERANCE = 0.1;

const MACRO_FIELDS = ['calories', 'protein', 'carbs', 'fat', 'fiber'] as const;
type MacroField = (typeof MACRO_FIELDS)[number];
type Macros = Record<MacroField, number>;

function zeroMacros(): Macros {
  return { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };
}

function addMacros(a: Macros, b: Macros): Macros {
  return {
    calories: a.calories + b.calories,
    protein: a.protein + b.protein,
    carbs: a.carbs + b.carbs,
    fat: a.fat + b.fat,
    fiber: a.fiber + b.fiber,
  };
}

function scaleMacros(m: Macros, factor: number): Macros {
  return {
    calories: m.calories * factor,
    protein: m.protein * factor,
    carbs: m.carbs * factor,
    fat: m.fat * factor,
    fiber: m.fiber * factor,
  };
}

function macrosDivergeBeyondTolerance(a: Macros, b: Macros, tolerance: number): MacroField | null {
  for (const field of MACRO_FIELDS) {
    const declared = a[field];
    const computed = b[field];
    const allowed = Math.max(1, declared * tolerance);
    if (Math.abs(declared - computed) > allowed) return field;
  }
  return null;
}

function foodsById(plan: NutritionPlan): Map<string, Food> {
  return new Map(plan.foods.map((f) => [f.id, f]));
}

function recipesById(plan: NutritionPlan): Map<string, { recipe: Batch | Single; isBatch: boolean }> {
  const map = new Map<string, { recipe: Batch | Single; isBatch: boolean }>();
  for (const b of plan.batches) map.set(b.id, { recipe: b, isBatch: true });
  for (const s of plan.singles) map.set(s.id, { recipe: s, isBatch: false });
  return map;
}

/** Macros calculées d'une recette à partir de SES ingrédients (pour toute la recette). */
function computeRecipeMacrosFromIngredients(recipe: Batch | Single, foods: Map<string, Food>): Macros | null {
  let total = zeroMacros();
  for (const line of recipe.ingredients) {
    const food = foods.get(line.foodId);
    if (!food) return null; // signalé séparément par checkIngredientsExistInFoods
    const factor = line.grams / 100;
    total = addMacros(total, {
      calories: food.kcal100 * factor,
      protein: food.protein100 * factor,
      carbs: food.carbs100 * factor,
      fat: food.fat100 * factor,
      fiber: food.fiber100 * factor,
    });
  }
  return total;
}

// ---------------------------------------------------------------------------
// Arithmétique
// ---------------------------------------------------------------------------

function checkIngredientsExistInFoods(plan: NutritionPlan): Violation[] {
  const foods = foodsById(plan);
  const violations: Violation[] = [];
  const allRecipes: (Batch | Single)[] = [...plan.batches, ...plan.singles];
  for (const recipe of allRecipes) {
    for (const line of recipe.ingredients) {
      if (!foods.has(line.foodId)) {
        violations.push({
          severity: 'error',
          message: t('La recette "{recipe}" utilise l\'ingrédient "{food}" qui n\'existe pas dans "foods".', { recipe: recipe.name, food: line.foodId }),
        });
      }
    }
  }
  return violations;
}

function checkRecipeMacrosMatchIngredients(plan: NutritionPlan): Violation[] {
  const foods = foodsById(plan);
  const violations: Violation[] = [];
  const allRecipes: { recipe: Batch | Single; portions: number }[] = [
    ...plan.batches.map((b) => ({ recipe: b as Batch | Single, portions: b.portions })),
    ...plan.singles.map((s) => ({ recipe: s as Batch | Single, portions: 1 })),
  ];

  for (const { recipe, portions } of allRecipes) {
    const totalComputed = computeRecipeMacrosFromIngredients(recipe, foods);
    if (!totalComputed) continue; // ingrédient manquant déjà signalé ailleurs

    const perPortionComputed = scaleMacros(totalComputed, 1 / portions);
    const declared: Macros = {
      calories: recipe.calories,
      protein: recipe.protein,
      carbs: recipe.carbs,
      fat: recipe.fat,
      fiber: recipe.fiber,
    };

    const divergentField = macrosDivergeBeyondTolerance(declared, perPortionComputed, RECIPE_MACROS_TOLERANCE);
    if (divergentField) {
      violations.push({
        severity: 'error',
        message: t(
          'Recette "{recipe}" : le champ "{field}" déclaré ({declared}) s\'écarte de plus de {tolerance}% de la valeur calculée depuis les ingrédients ({computed} par portion).',
          {
            recipe: recipe.name,
            field: divergentField,
            declared: declared[divergentField].toFixed(1),
            tolerance: RECIPE_MACROS_TOLERANCE * 100,
            computed: perPortionComputed[divergentField].toFixed(1),
          },
        ),
      });
    }
  }
  return violations;
}

function checkRefsExistAndPortionsValid(plan: NutritionPlan): Violation[] {
  const recipes = recipesById(plan);
  const violations: Violation[] = [];

  for (const day of plan.days) {
    for (const meal of day.meals) {
      if (meal.ref === undefined) continue; // créneau hors-cycle, rien à vérifier

      const entry = recipes.get(meal.ref);
      if (!entry) {
        violations.push({
          severity: 'error',
          message: t('Jour {day}, repas "{meal}" : la référence "{ref}" n\'existe dans aucune recette (batches/singles).', { day: day.day, meal: meal.name, ref: meal.ref }),
        });
        continue;
      }

      if (entry.isBatch && meal.portionIndex === undefined) {
        violations.push({
          severity: 'error',
          message: t('Jour {day}, repas "{meal}" : référence un plat cuisiné en série ("{ref}") sans préciser "portionIndex".', { day: day.day, meal: meal.name, ref: meal.ref }),
        });
      }
      if (!entry.isBatch && meal.portionIndex !== undefined) {
        violations.push({
          severity: 'error',
          message: t('Jour {day}, repas "{meal}" : "portionIndex" n\'a de sens que pour un plat cuisiné en série, or "{ref}" est un plat simple.', { day: day.day, meal: meal.name, ref: meal.ref }),
        });
      }
    }
  }
  return violations;
}

/** Macros d'un repas référencé (pour la somme journalière) : macros par portion de la recette. */
function mealMacros(meal: { ref?: string }, recipes: Map<string, { recipe: Batch | Single }>): Macros | null {
  if (meal.ref === undefined) return null;
  const entry = recipes.get(meal.ref);
  if (!entry) return null;
  return {
    calories: entry.recipe.calories,
    protein: entry.recipe.protein,
    carbs: entry.recipe.carbs,
    fat: entry.recipe.fat,
    fiber: entry.recipe.fiber,
  };
}

function checkDayTotalsMatchMealSum(plan: NutritionPlan): Violation[] {
  const recipes = recipesById(plan);
  const violations: Violation[] = [];

  for (const day of plan.days) {
    const hasOffCycleMeal = day.meals.some((m) => m.ref === undefined);
    let sum = zeroMacros();
    for (const meal of day.meals) {
      const macros = mealMacros(meal, recipes);
      if (macros) sum = addMacros(sum, macros);
    }

    if (hasOffCycleMeal) {
      // Un repas hors-cycle (resto, repas libre) n'a pas d'ingrédients : on vérifie
      // seulement que les repas connus ne dépassent pas déjà le total déclaré.
      for (const field of MACRO_FIELDS) {
        if (sum[field] > day.totals[field] + Math.max(1, day.totals[field] * DAY_TOTALS_TOLERANCE)) {
          violations.push({
            severity: 'error',
            message: t('Jour {day} : la somme des repas connus dépasse déjà "{field}" du total déclaré, alors qu\'un repas hors-cycle doit encore s\'ajouter.', { day: day.day, field }),
          });
        }
      }
      continue;
    }

    const divergentField = macrosDivergeBeyondTolerance(day.totals, sum, DAY_TOTALS_TOLERANCE);
    if (divergentField) {
      violations.push({
        severity: 'error',
        message: t('Jour {day} : "{field}" déclaré dans "totals" ({declared}) ne correspond pas à la somme des repas ({sum}).', {
          day: day.day,
          field: divergentField,
          declared: day.totals[divergentField].toFixed(1),
          sum: sum[divergentField].toFixed(1),
        }),
      });
    }
  }
  return violations;
}

function checkBaseDayKcalCoherent(plan: NutritionPlan): Violation[] {
  const avg = plan.days.reduce((s, d) => s + d.totals.calories, 0) / plan.days.length;
  const declared = plan.meta.baseDayKcal;
  const relDiff = Math.abs(declared - avg) / Math.max(1, declared);
  if (relDiff > BASE_DAY_KCAL_WARNING_TOLERANCE) {
    return [
      {
        severity: 'warning',
        message: t('meta.baseDayKcal ({declared}) s\'écarte de plus de {tolerance}% de la moyenne réelle des jours ({average} kcal).', {
          declared,
          tolerance: BASE_DAY_KCAL_WARNING_TOLERANCE * 100,
          average: avg.toFixed(0),
        }),
      },
    ];
  }
  return [];
}

// ---------------------------------------------------------------------------
// Plats cuisinés en série
// ---------------------------------------------------------------------------

function checkBatchPortions(plan: NutritionPlan): Violation[] {
  const violations: Violation[] = [];

  for (const batch of plan.batches) {
    const usages = plan.days.flatMap((day) =>
      day.meals
        .filter((m) => m.ref === batch.id)
        .map((m) => ({ day: day.day, portionIndex: m.portionIndex })),
    );

    const indices = usages.map((u) => u.portionIndex).filter((n): n is number => n !== undefined);
    const expected = Array.from({ length: batch.portions }, (_, i) => i + 1);
    const seen = new Set(indices);
    const missing = expected.filter((n) => !seen.has(n));
    const extra = indices.filter((n) => n < 1 || n > batch.portions);
    const duplicates = indices.filter((n, i) => indices.indexOf(n) !== i);

    if (missing.length) {
      violations.push({
        severity: 'error',
        message: t('"{name}" : portion(s) {portions} jamais mangée(s) sur les {total} déclarées.', { name: batch.name, portions: missing.join(', '), total: batch.portions }),
      });
    }
    if (extra.length) {
      violations.push({
        severity: 'error',
        message: t('"{name}" : portion(s) {portions} hors de la plage 1..{total}.', { name: batch.name, portions: [...new Set(extra)].join(', '), total: batch.portions }),
      });
    }
    if (duplicates.length) {
      violations.push({
        severity: 'error',
        message: t('"{name}" : portion(s) {portions} mangée(s) plusieurs fois.', { name: batch.name, portions: [...new Set(duplicates)].join(', ') }),
      });
    }
    if (usages.length !== batch.portions) {
      violations.push({
        severity: 'error',
        message: t('"{name}" : déclare {total} portions mais est mangé {count} fois au total.', { name: batch.name, total: batch.portions, count: usages.length }),
      });
    }

    const portion1 = usages.find((u) => u.portionIndex === 1);
    if (portion1 && portion1.day !== batch.cookDay) {
      violations.push({
        severity: 'error',
        message: t('"{name}" : la portion 1 est mangée le jour {day}, mais cookDay={cookDay} (elle doit être mangée le jour de cuisson).', { name: batch.name, day: portion1.day, cookDay: batch.cookDay }),
      });
    }

    if (batch.cookDay > plan.cycleLengthDays || batch.cookDay < 1) {
      violations.push({
        severity: 'error',
        message: t('"{name}" : cookDay={cookDay} n\'est pas un jour du cycle (1..{length}).', { name: batch.name, cookDay: batch.cookDay, length: plan.cycleLengthDays }),
      });
    }
  }

  return violations;
}

// ---------------------------------------------------------------------------
// Courses
// ---------------------------------------------------------------------------

/** Grammes réellement achetés pour un aliment, sur tout le cycle (somme de toutes les semaines). */
function purchasedGrams(plan: NutritionPlan, foodId: string, foods: Map<string, Food>): number {
  const food = foods.get(foodId);
  let total = 0;
  for (const week of plan.courses) {
    for (const item of week.items) {
      if (item.foodId !== foodId) continue;
      if (item.grams !== undefined) total += item.grams;
      else if (item.units !== undefined && food?.unitSizeG) total += item.units * food.unitSizeG;
    }
  }
  return total;
}

/** Grammes nécessaires pour un aliment : chaque recette RÉFÉRENCÉE au moins une fois compte une fois. */
function neededGrams(plan: NutritionPlan): Map<string, number> {
  const recipes = recipesById(plan);
  const needs = new Map<string, number>();
  const batchesAlreadyCounted = new Set<string>();

  const addIngredients = (line: { foodId: string; grams: number }) => {
    needs.set(line.foodId, (needs.get(line.foodId) ?? 0) + line.grams);
  };

  for (const day of plan.days) {
    for (const meal of day.meals) {
      if (meal.ref === undefined) continue;
      const entry = recipes.get(meal.ref);
      if (!entry) continue; // déjà signalé par checkRefsExistAndPortionsValid

      if (entry.isBatch) {
        // Un batch est cuisiné UNE FOIS pour toutes ses portions : ses ingrédients ne
        // comptent qu'une seule fois, quel que soit le nombre de repas qui le référencent.
        if (batchesAlreadyCounted.has(meal.ref)) continue;
        batchesAlreadyCounted.add(meal.ref);
      }
      // Un "single" est recuisiné à chaque fois qu'il est mangé : ses ingrédients comptent
      // une fois PAR référence.
      for (const line of entry.recipe.ingredients) addIngredients(line);
    }
  }
  return needs;
}

function checkShoppingListCompleteness(plan: NutritionPlan): Violation[] {
  const foods = foodsById(plan);
  const needs = neededGrams(plan);
  const violations: Violation[] = [];

  for (const [foodId, needed] of needs) {
    const food = foods.get(foodId);
    const purchased = purchasedGrams(plan, foodId, foods);

    if (food?.soldBy === 'unit' && food.unitSizeG) {
      // Doit couvrir le besoin, arrondi au nombre d'unités supérieur — pas plus.
      const minPurchase = needed;
      const maxPurchase = needed + food.unitSizeG;
      if (purchased < minPurchase - 0.01 || purchased > maxPurchase + 0.01) {
        violations.push({
          severity: 'error',
          message: t('Courses : "{food}" — besoin de {needed}g, acheté {purchased}g (attendu entre {min}g et {max}g en arrondissant à l\'unité).', { food: food.name, needed, purchased, min: minPurchase, max: maxPurchase }),
        });
      }
    } else {
      const tolerance = Math.max(2, needed * 0.02);
      if (Math.abs(purchased - needed) > tolerance) {
        violations.push({
          severity: 'error',
          message: t('Courses : "{food}" — besoin de {needed}g, acheté {purchased}g.', { food: food?.name ?? foodId, needed, purchased }),
        });
      }
    }
  }

  // Rien acheté qui ne serait pas nécessaire (achat "fantôme").
  for (const week of plan.courses) {
    for (const item of week.items) {
      if (!needs.has(item.foodId)) {
        const food = foods.get(item.foodId);
        violations.push({
          severity: 'error',
          message: t('Courses (semaine {week}) : "{food}" est acheté mais n\'est utilisé dans aucune recette du plan.', { week: week.week, food: food?.name ?? item.foodId }),
        });
      }
    }
  }

  return violations;
}

function checkUnitItemsAreWholeNumbers(plan: NutritionPlan): Violation[] {
  const foods = foodsById(plan);
  const violations: Violation[] = [];
  for (const week of plan.courses) {
    for (const item of week.items) {
      const food = foods.get(item.foodId);
      if (!food) continue;
      if (food.soldBy === 'unit' && item.units === undefined) {
        violations.push({
          severity: 'error',
          message: t('Courses (semaine {week}) : "{food}" se vend à l\'unité mais l\'article est exprimé en grammes.', { week: week.week, food: food.name }),
        });
      }
      if (food.soldBy === 'weight' && item.grams === undefined) {
        violations.push({
          severity: 'error',
          message: t('Courses (semaine {week}) : "{food}" se vend au poids mais l\'article est exprimé en unités.', { week: week.week, food: food.name }),
        });
      }
    }
  }
  return violations;
}

function checkPantryItemsNotDuplicated(plan: NutritionPlan): Violation[] {
  const foods = foodsById(plan);
  const weeksByFood = new Map<string, Set<number>>();
  for (const week of plan.courses) {
    for (const item of week.items) {
      if (!item.isPantry) continue;
      const set = weeksByFood.get(item.foodId) ?? new Set<number>();
      set.add(week.week);
      weeksByFood.set(item.foodId, set);
    }
  }

  const violations: Violation[] = [];
  for (const [foodId, weeks] of weeksByFood) {
    if (weeks.size > 1) {
      const food = foods.get(foodId);
      violations.push({
        severity: 'error',
        message: t('Courses : "{food}" (garde-manger) apparaît dans {count} semaines différentes ({weeks}) — un article de garde-manger ne s\'achète qu\'une fois.', { food: food?.name ?? foodId, count: weeks.size, weeks: [...weeks].join(', ') }),
      });
    }
  }
  return violations;
}

// ---------------------------------------------------------------------------
// Plausibilité physique
// ---------------------------------------------------------------------------

function checkPhysicalPlausibility(plan: NutritionPlan): Violation[] {
  const foods = foodsById(plan);
  const violations: Violation[] = [];
  // Les bornes s'appliquent à UNE PORTION : un batch en déclare le total pour toutes ses
  // portions cuisinées ensemble (ex: 1750g de poulet pour 7 portions = 250g/portion, tout
  // à fait raisonnable), donc on divise par "portions" avant de comparer.
  const recipesWithPortionCount: { recipe: Batch | Single; portions: number }[] = [
    ...plan.batches.map((b) => ({ recipe: b as Batch | Single, portions: b.portions })),
    ...plan.singles.map((s) => ({ recipe: s as Batch | Single, portions: 1 })),
  ];

  for (const { recipe, portions } of recipesWithPortionCount) {
    for (const line of recipe.ingredients) {
      const food = foods.get(line.foodId);
      if (!food) continue;

      const perPortionGrams = line.grams / portions;

      if (food.category !== 'epice_ou_bouillon' && perPortionGrams < MIN_MEASURABLE_G) {
        violations.push({
          severity: 'error',
          message: t('Recette "{recipe}" : {grams}g/portion de "{food}" est sous le seuil mesurable ({min}g).', { recipe: recipe.name, grams: perPortionGrams.toFixed(1), food: food.name, min: MIN_MEASURABLE_G }),
        });
      }

      const bounds = CATEGORY_BOUNDS_G[food.category];
      if (bounds && (perPortionGrams < bounds.min || perPortionGrams > bounds.max)) {
        violations.push({
          severity: 'error',
          message: t('Recette "{recipe}" : {grams}g/portion de "{food}" ({category}) hors de la fourchette plausible {min}-{max}g.', { recipe: recipe.name, grams: perPortionGrams.toFixed(1), food: food.name, category: food.category, min: bounds.min, max: bounds.max }),
        });
      }
    }
  }
  return violations;
}

// ---------------------------------------------------------------------------
// Point d'entrée
// ---------------------------------------------------------------------------

const ALL_CHECKS: ((plan: NutritionPlan) => Violation[])[] = [
  checkIngredientsExistInFoods,
  checkRecipeMacrosMatchIngredients,
  checkRefsExistAndPortionsValid,
  checkDayTotalsMatchMealSum,
  checkBaseDayKcalCoherent,
  checkBatchPortions,
  checkShoppingListCompleteness,
  checkUnitItemsAreWholeNumbers,
  checkPantryItemsNotDuplicated,
  checkPhysicalPlausibility,
];

export function verifyPlanInvariants(plan: NutritionPlan): Violation[] {
  return ALL_CHECKS.flatMap((check) => check(plan));
}
