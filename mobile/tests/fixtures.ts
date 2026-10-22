import type { NutritionPlan } from '@/lib/nutrition-schema';

type Food = NutritionPlan['foods'][number];

const FOODS: Food[] = [
  { id: 'avoine', name: "Flocons d'avoine", category: 'feculent', kcal100: 375, protein100: 13, carbs100: 60, fat100: 7, fiber100: 10, soldBy: 'weight' },
  { id: 'lait', name: 'Lait demi-écrémé', category: 'produit_laitier', kcal100: 46, protein100: 3.3, carbs100: 4.8, fat100: 1.6, fiber100: 0, soldBy: 'weight' },
  { id: 'poulet', name: 'Blanc de poulet', category: 'proteine', kcal100: 165, protein100: 31, carbs100: 0, fat100: 3.6, fiber100: 0, soldBy: 'weight' },
  { id: 'riz', name: 'Riz basmati cru', category: 'feculent', kcal100: 350, protein100: 7.5, carbs100: 77, fat100: 0.6, fiber100: 1.3, soldBy: 'weight' },
  { id: 'brocoli', name: 'Brocoli', category: 'legume', kcal100: 34, protein100: 2.8, carbs100: 7, fat100: 0.4, fiber100: 2.6, soldBy: 'weight' },
  { id: 'huile', name: "Huile d'olive", category: 'matiere_grasse', kcal100: 884, protein100: 0, carbs100: 0, fat100: 100, fiber100: 0, soldBy: 'weight' },
];

/**
 * Plan nutrition complet et cohérent sur 7 jours : un porridge chaque matin (single) et un plat
 * de poulet-riz-brocoli cuisiné le jour 1 en 7 portions (batch). Macros, totaux journaliers et
 * liste de courses sont calculés pour correspondre exactement aux invariants de l'app.
 */
export function buildNutritionPlan(): NutritionPlan {
  const porridge = { calories: 559, protein: 26.2, carbs: 79.2, fat: 13.4, fiber: 10 };
  const portion = { calories: 819.4, protein: 73.7, carbs: 87.5, fat: 18.4, fiber: 5.2 };
  const dayTotals = {
    calories: porridge.calories + portion.calories,
    protein: porridge.protein + portion.protein,
    carbs: porridge.carbs + portion.carbs,
    fat: porridge.fat + portion.fat,
    fiber: porridge.fiber + portion.fiber,
  };

  return {
    type: 'nutrition',
    name: 'Plan de test',
    cycleLengthDays: 7,
    meta: { baseDayKcal: 1378.4 },
    foods: FOODS.map((food) => ({ ...food })),
    singles: [
      {
        id: 'porridge',
        name: 'Porridge avoine-lait',
        ingredients: [
          { foodId: 'avoine', grams: 100 },
          { foodId: 'lait', grams: 400 },
        ],
        steps: ["Verse l'avoine et le lait dans une casserole.", 'Chauffe 5 minutes en remuant.'],
        ...porridge,
      },
    ],
    batches: [
      {
        id: 'poulet_riz',
        name: 'Poulet, riz et brocoli',
        portions: 7,
        cookDay: 1,
        ingredients: [
          { foodId: 'poulet', grams: 1400 },
          { foodId: 'riz', grams: 700 },
          { foodId: 'brocoli', grams: 1050 },
          { foodId: 'huile', grams: 70 },
        ],
        ...portion,
      },
    ],
    days: Array.from({ length: 7 }, (_, index) => ({
      day: index + 1,
      totals: { ...dayTotals },
      meals: [
        { name: 'Petit-déjeuner', time: '08:00', ref: 'porridge' },
        { name: 'Déjeuner', time: '12:30', ref: 'poulet_riz', portionIndex: index + 1 },
      ],
    })),
    courses: [
      {
        week: 1,
        items: [
          { foodId: 'avoine', grams: 700, isPantry: true, needsFreezing: false },
          { foodId: 'lait', grams: 2800, isPantry: false, needsFreezing: false },
          { foodId: 'poulet', grams: 1400, isPantry: false, needsFreezing: false },
          { foodId: 'riz', grams: 700, isPantry: true, needsFreezing: false },
          { foodId: 'brocoli', grams: 1050, isPantry: false, needsFreezing: false },
          { foodId: 'huile', grams: 70, isPantry: true, needsFreezing: false },
        ],
      },
    ],
  } as NutritionPlan;
}

export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Programme sport en séances fixes : une séance de force le lundi, du repos les autres jours. */
export function buildFixedSportPlan() {
  const weekdays = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
  return {
    type: 'sport',
    mode: 'fixe',
    name: 'Programme fixe de test',
    preferredTime: '18:30',
    days: weekdays.map((weekday) =>
      weekday === 'lundi'
        ? {
            weekday,
            sessionName: 'Push',
            isRestDay: false,
            exercises: [
              { name: 'Échauffement', sets: 1, reps: '5 min', restSeconds: 0 },
              { name: 'Développé couché', sets: 3, reps: '8-10', restSeconds: 90 },
            ],
          }
        : { weekday, sessionName: 'Repos', isRestDay: true, exercises: [] },
    ),
  };
}

/** Programme continu : Push → Pull → Legs → Repos, sans jour attitré. */
export function buildContinuousSportPlan() {
  const lift = (name: string) => ({
    sessionName: name,
    isRestDay: false,
    exercises: [{ name: `${name} lourd`, sets: 3, reps: '8', restSeconds: 90 }],
  });
  return {
    type: 'sport',
    mode: 'continu',
    name: 'Programme continu de test',
    preferredTime: '18:00',
    sequence: [lift('Push'), lift('Pull'), lift('Legs'), { sessionName: 'Repos', isRestDay: true, exercises: [] }],
  };
}
