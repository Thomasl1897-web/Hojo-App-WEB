import { z } from 'zod';

import { t } from '@/i18n';
import { validateCycleDayCoverage } from '@/lib/cycle-utils';

/**
 * Jours calendaires réels — utilisés pour des préférences ponctuelles (jour des courses,
 * jours "repas libre"...), PAS pour la structure du plan lui-même (voir CycleLength).
 */
export const WEEKDAYS = [
  'lundi',
  'mardi',
  'mercredi',
  'jeudi',
  'vendredi',
  'samedi',
  'dimanche',
] as const;

export type Weekday = (typeof WEEKDAYS)[number];

export const CYCLE_LENGTHS = [7, 14] as const;
export type CycleLength = (typeof CYCLE_LENGTHS)[number];

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

// ---------------------------------------------------------------------------
// Aliments (base nutritionnelle) — chaque ingrédient cité dans une recette doit
// exister ici. Cinq valeurs numériques par aliment (kcal, protéines, glucides,
// lipides, fibres, pour 100g), plus des métadonnées d'achat.
// ---------------------------------------------------------------------------

export const FOOD_CATEGORIES = [
  'feculent',
  'proteine',
  'legume',
  'fruit',
  'produit_laitier',
  'matiere_grasse',
  'liant_structurel',
  'epice_ou_bouillon',
  'autre',
] as const;

export type FoodCategory = (typeof FOOD_CATEGORIES)[number];

export const foodSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  category: z.enum(FOOD_CATEGORIES),
  kcal100: z.number().nonnegative(),
  protein100: z.number().nonnegative(),
  carbs100: z.number().nonnegative(),
  fat100: z.number().nonnegative(),
  fiber100: z.number().nonnegative(),
  soldBy: z.enum(['weight', 'unit']),
  /** Grammes par unité (ex: 1 œuf ≈ 58g). Obligatoire si soldBy = "unit". */
  unitSizeG: z.number().positive().optional(),
});

export type Food = z.infer<typeof foodSchema>;

// ---------------------------------------------------------------------------
// Recettes — un plat unique ("singles", cuisiné et mangé le jour même) ou cuisiné
// en série ("batches", plusieurs portions consommées sur plusieurs jours).
// ---------------------------------------------------------------------------

export const ingredientLineSchema = z.object({
  foodId: z.string().min(1),
  grams: z.number().positive(),
});

export type IngredientLine = z.infer<typeof ingredientLineSchema>;

/** Macros DÉCLARÉES pour UNE portion (comparées aux ingrédients réels avec tolérance). */
const recipeMacrosSchema = z.object({
  calories: z.number().nonnegative(),
  protein: z.number().nonnegative(),
  carbs: z.number().nonnegative(),
  fat: z.number().nonnegative(),
  fiber: z.number().nonnegative(),
});

const recipeCoreSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  /** Ingrédients pour LA RECETTE ENTIÈRE (toutes les portions cuisinées ensemble). */
  ingredients: z.array(ingredientLineSchema).min(1),
  /** Étapes de préparation, dans l'ordre (facultatif : un plan plus ancien n'en a pas). */
  steps: z.array(z.string().min(1)).optional(),
}).merge(recipeMacrosSchema);

export const singleSchema = recipeCoreSchema;
export type Single = z.infer<typeof singleSchema>;

export const batchSchema = recipeCoreSchema.extend({
  /** Nombre de portions produites par cette cuisson (>= 2, sinon c'est un "single"). */
  portions: z.number().int().min(2),
  /** Jour du cycle où le plat est cuisiné (portion 1 mangée ce jour-là). */
  cookDay: z.number().int().min(1),
});
export type Batch = z.infer<typeof batchSchema>;

// ---------------------------------------------------------------------------
// Jours du plan
// ---------------------------------------------------------------------------

const dayTotalsSchema = z.object({
  calories: z.number().nonnegative(),
  protein: z.number().nonnegative(),
  carbs: z.number().nonnegative(),
  fat: z.number().nonnegative(),
  fiber: z.number().nonnegative(),
});

export type DayTotals = z.infer<typeof dayTotalsSchema>;

export const dayMealSchema = z.object({
  /** Libellé du créneau (ex: "Petit-déjeuner", "Collation 2"), PAS le nom du plat. */
  name: z.string().min(1),
  time: z.string().regex(timeRegex, { error: () => t('Heure attendue au format HH:MM') }),
  /**
   * Référence vers une recette (id dans "batches" ou "singles"). Absente pour un
   * créneau hors-cycle (repas au restaurant, repas libre, repas de secours) : dans
   * ce cas "freeNote" décrit le créneau, et aucun ingrédient n'est comptabilisé.
   */
  ref: z.string().min(1).optional(),
  /** Numéro de portion consommée (obligatoire si "ref" pointe vers un batch). */
  portionIndex: z.number().int().min(1).optional(),
  freeNote: z.string().optional(),
});

export type DayMeal = z.infer<typeof dayMealSchema>;

export const dayPlanSchema = z.object({
  /** Numéro du jour DANS LE CYCLE (1..cycleLengthDays), jamais un jour de semaine. */
  day: z.number().int().min(1),
  totals: dayTotalsSchema,
  meals: z.array(dayMealSchema).min(1),
});

export type DayPlan = z.infer<typeof dayPlanSchema>;

// ---------------------------------------------------------------------------
// Courses (liste de courses, groupée par semaine du cycle)
// ---------------------------------------------------------------------------

export const courseItemSchema = z.object({
  foodId: z.string().min(1),
  /** L'un des deux selon food.soldBy : grammes (vente au poids) ou unités entières. */
  grams: z.number().positive().optional(),
  units: z.number().int().positive().optional(),
  isPantry: z.boolean(),
  needsFreezing: z.boolean(),
});

export type CourseItem = z.infer<typeof courseItemSchema>;

export const courseWeekSchema = z.object({
  week: z.number().int().min(1),
  items: z.array(courseItemSchema),
});

export type CourseWeek = z.infer<typeof courseWeekSchema>;

// ---------------------------------------------------------------------------
// Plan complet
// ---------------------------------------------------------------------------

export const nutritionMetaSchema = z.object({
  /** Apport calorique quotidien de référence annoncé par le plan. */
  baseDayKcal: z.number().positive(),
});

export const nutritionPlanSchema = z.object({
  type: z.literal('nutrition'),
  name: z.string().min(1),
  cycleLengthDays: z.union([z.literal(7), z.literal(14)]),
  meta: nutritionMetaSchema,
  foods: z.array(foodSchema).min(1),
  batches: z.array(batchSchema).default([]),
  singles: z.array(singleSchema).default([]),
  days: z.array(dayPlanSchema).min(1),
  courses: z.array(courseWeekSchema).default([]),
});

export type NutritionPlan = z.infer<typeof nutritionPlanSchema>;

export const ABSOLUTE_MIN_DAILY_CALORIES = 1200;

/**
 * Les assistants IA encadrent souvent leur réponse dans un bloc de code markdown
 * et/ou ajoutent une phrase avant/après. On isole le JSON avant de le parser.
 */
function extractJson(raw: string): string {
  let text = raw.trim();

  const fence = text.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/i);
  if (fence) {
    text = fence[1].trim();
  }

  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end > start) {
    text = text.slice(start, end + 1);
  }

  return text;
}

export type ParseResult =
  | { success: true; data: NutritionPlan; warnings: string[] }
  | { success: false; error: string };

export function parseNutritionPlan(raw: string): ParseResult {
  let json: unknown;
  try {
    json = JSON.parse(extractJson(raw));
  } catch {
    return {
      success: false,
      error:
        t(
          "Le contenu n'est pas un JSON valide. Si l'assistant IA a tronqué sa réponse, redemande-lui le plan complet sous forme de fichier .json.",
        ),
    };
  }

  const result = nutritionPlanSchema.safeParse(json);
  if (!result.success) {
    const firstIssue = result.error.issues[0];
    const path = firstIssue.path.join('.');
    return {
      success: false,
      error: path ? t('Erreur sur "{path}" : {message}', { path, message: firstIssue.message }) : firstIssue.message,
    };
  }

  const plan = result.data;

  const coverageError = validateCycleDayCoverage(plan.days, plan.cycleLengthDays);
  if (coverageError) {
    return { success: false, error: coverageError };
  }

  // Garde-fou de sécurité : on refuse un plan manifestement sous-calorique plutôt que de
  // laisser l'utilisateur le suivre au quotidien avec des rappels.
  const underfed = plan.days.find((day) => day.totals.calories < ABSOLUTE_MIN_DAILY_CALORIES);
  if (underfed) {
    return {
      success: false,
      error:
        t(
          'Plan refusé pour raison de sécurité : le jour {day} n\'apporte que {calories} kcal, sous le seuil minimal de {min} kcal/jour. Régénère un plan en demandant des apports adaptés, et parles-en à un médecin ou un diététicien avant de suivre un régime aussi restrictif.',
          { day: underfed.day, calories: underfed.totals.calories, min: ABSOLUTE_MIN_DAILY_CALORIES },
        ),
    };
  }

  return { success: true, data: plan, warnings: [] };
}
