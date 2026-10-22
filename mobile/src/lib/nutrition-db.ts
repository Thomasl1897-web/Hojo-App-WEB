import { db } from '@/lib/database';
import { dateStringDaysAgo, daysSinceWeekday, getTodayDateString } from '@/lib/date';
import type { CycleLength, Food, IngredientLine, NutritionPlan } from '@/lib/nutrition-schema';
import type { ShoppingItem } from '@/lib/nutrition-courses';
import { deleteSetting, getSetting, setSetting } from '@/lib/settings-db';

const CYCLE_START_KEY = 'nutrition_cycle_start_date';

export type Macros = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
};

export type DisplayIngredient = {
  name: string;
  quantity: string;
};

export type MealRow = {
  id: number;
  cycleDay: number;
  /** Libellé du créneau (ex: "Petit-déjeuner"), pas le nom du plat. */
  slotName: string;
  time: string;
  /** Nom du plat (résolu depuis la recette), ou texte libre pour un repas hors-cycle. */
  dishName: string;
  isOffCycle: boolean;
  macros: Macros | null;
  ingredients: DisplayIngredient[];
  /** Étapes de préparation de la recette (vide si le plan n'en contient pas). */
  steps: string[];
};

export type PlanMeta = {
  name: string;
  cycleLengthDays: CycleLength;
  cycleStartDate: string;
  baseDayKcal: number;
};

export type DayTotals = Macros;

export function initNutritionSchema() {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS nutrition_plan (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      name TEXT NOT NULL,
      cycle_length_days INTEGER NOT NULL,
      cycle_start_date TEXT NOT NULL,
      base_day_kcal REAL NOT NULL,
      imported_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS nutrition_foods (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      kcal100 REAL NOT NULL,
      protein100 REAL NOT NULL,
      carbs100 REAL NOT NULL,
      fat100 REAL NOT NULL,
      fiber100 REAL NOT NULL,
      sold_by TEXT NOT NULL,
      unit_size_g REAL
    );

    CREATE TABLE IF NOT EXISTS nutrition_recipes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      is_batch INTEGER NOT NULL,
      portions INTEGER NOT NULL,
      cook_day INTEGER,
      calories REAL NOT NULL,
      protein REAL NOT NULL,
      carbs REAL NOT NULL,
      fat REAL NOT NULL,
      fiber REAL NOT NULL,
      ingredients TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS nutrition_days (
      cycle_day INTEGER PRIMARY KEY,
      calories REAL NOT NULL,
      protein REAL NOT NULL,
      carbs REAL NOT NULL,
      fat REAL NOT NULL,
      fiber REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS nutrition_meals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cycle_day INTEGER NOT NULL,
      slot_name TEXT NOT NULL,
      time TEXT NOT NULL,
      ref TEXT,
      portion_index INTEGER,
      free_note TEXT
    );

    CREATE TABLE IF NOT EXISTS nutrition_course_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      week INTEGER NOT NULL,
      food_id TEXT NOT NULL,
      grams REAL,
      units INTEGER,
      is_pantry INTEGER NOT NULL,
      needs_freezing INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS nutrition_meal_completions (
      meal_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      PRIMARY KEY (meal_id, date)
    );

    CREATE TABLE IF NOT EXISTS nutrition_course_checks (
      item_id INTEGER PRIMARY KEY
    );

    CREATE TABLE IF NOT EXISTS nutrition_slot_times (
      slot_name TEXT PRIMARY KEY,
      time TEXT NOT NULL
    );
  `);

  // Colonne ajoutée après coup (étapes de recette) : ajoutée sans vider la base existante.
  const recipeColumns = db.getAllSync<{ name: string }>('PRAGMA table_info(nutrition_recipes)');
  if (!recipeColumns.some((column) => column.name === 'steps')) {
    db.execSync('ALTER TABLE nutrition_recipes ADD COLUMN steps TEXT');
  }
}

export function importNutritionPlan(plan: NutritionPlan) {
  db.withTransactionSync(() => {
    db.runSync('DELETE FROM nutrition_meal_completions');
    db.runSync('DELETE FROM nutrition_course_checks');
    db.runSync('DELETE FROM nutrition_course_items');
    db.runSync('DELETE FROM nutrition_meals');
    db.runSync('DELETE FROM nutrition_days');
    db.runSync('DELETE FROM nutrition_recipes');
    db.runSync('DELETE FROM nutrition_foods');
    db.runSync('DELETE FROM nutrition_plan');

    db.runSync(
      'INSERT INTO nutrition_plan (id, name, cycle_length_days, cycle_start_date, base_day_kcal, imported_at) VALUES (1, ?, ?, ?, ?, ?)',
      plan.name,
      plan.cycleLengthDays,
      getTodayDateString(),
      plan.meta.baseDayKcal,
      new Date().toISOString(),
    );

    for (const food of plan.foods) {
      db.runSync(
        'INSERT INTO nutrition_foods (id, name, category, kcal100, protein100, carbs100, fat100, fiber100, sold_by, unit_size_g) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        food.id,
        food.name,
        food.category,
        food.kcal100,
        food.protein100,
        food.carbs100,
        food.fat100,
        food.fiber100,
        food.soldBy,
        food.unitSizeG ?? null,
      );
    }

    for (const batch of plan.batches) {
      db.runSync(
        'INSERT INTO nutrition_recipes (id, name, is_batch, portions, cook_day, calories, protein, carbs, fat, fiber, ingredients, steps) VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        batch.id,
        batch.name,
        batch.portions,
        batch.cookDay,
        batch.calories,
        batch.protein,
        batch.carbs,
        batch.fat,
        batch.fiber,
        JSON.stringify(batch.ingredients),
        JSON.stringify(batch.steps ?? []),
      );
    }

    for (const single of plan.singles) {
      db.runSync(
        'INSERT INTO nutrition_recipes (id, name, is_batch, portions, cook_day, calories, protein, carbs, fat, fiber, ingredients, steps) VALUES (?, ?, 0, 1, NULL, ?, ?, ?, ?, ?, ?, ?)',
        single.id,
        single.name,
        single.calories,
        single.protein,
        single.carbs,
        single.fat,
        single.fiber,
        JSON.stringify(single.ingredients),
        JSON.stringify(single.steps ?? []),
      );
    }

    for (const day of plan.days) {
      db.runSync(
        'INSERT INTO nutrition_days (cycle_day, calories, protein, carbs, fat, fiber) VALUES (?, ?, ?, ?, ?, ?)',
        day.day,
        day.totals.calories,
        day.totals.protein,
        day.totals.carbs,
        day.totals.fat,
        day.totals.fiber,
      );

      for (const meal of day.meals) {
        db.runSync(
          'INSERT INTO nutrition_meals (cycle_day, slot_name, time, ref, portion_index, free_note) VALUES (?, ?, ?, ?, ?, ?)',
          day.day,
          meal.name,
          meal.time,
          meal.ref ?? null,
          meal.portionIndex ?? null,
          meal.freeNote ?? null,
        );
      }
    }

    for (const week of plan.courses) {
      for (const item of week.items) {
        db.runSync(
          'INSERT INTO nutrition_course_items (week, food_id, grams, units, is_pantry, needs_freezing) VALUES (?, ?, ?, ?, ?, ?)',
          week.week,
          item.foodId,
          item.grams ?? null,
          item.units ?? null,
          item.isPantry ? 1 : 0,
          item.needsFreezing ? 1 : 0,
        );
      }
    }
  });
}

export function getActivePlanMeta(): PlanMeta | null {
  const row = db.getFirstSync<{
    name: string;
    cycle_length_days: number;
    cycle_start_date: string;
    base_day_kcal: number;
  }>('SELECT name, cycle_length_days, cycle_start_date, base_day_kcal FROM nutrition_plan WHERE id = 1');
  if (!row) return null;
  return {
    name: row.name,
    cycleLengthDays: row.cycle_length_days as CycleLength,
    // La date choisie dans les Paramètres prime sur la date d'import.
    cycleStartDate: getSetting(CYCLE_START_KEY) ?? row.cycle_start_date,
    baseDayKcal: row.base_day_kcal,
  };
}

type RecipeRow = {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  ingredients: string;
  steps: string | null;
};

function getFoodsMap(): Map<string, Food> {
  const rows = db.getAllSync<{
    id: string;
    name: string;
    category: string;
    kcal100: number;
    protein100: number;
    carbs100: number;
    fat100: number;
    fiber100: number;
    sold_by: string;
    unit_size_g: number | null;
  }>('SELECT * FROM nutrition_foods');
  return new Map(
    rows.map((r) => [
      r.id,
      {
        id: r.id,
        name: r.name,
        category: r.category as Food['category'],
        kcal100: r.kcal100,
        protein100: r.protein100,
        carbs100: r.carbs100,
        fat100: r.fat100,
        fiber100: r.fiber100,
        soldBy: r.sold_by as Food['soldBy'],
        unitSizeG: r.unit_size_g ?? undefined,
      },
    ]),
  );
}

function resolveIngredients(ingredientsJson: string, foods: Map<string, Food>): DisplayIngredient[] {
  const lines = JSON.parse(ingredientsJson) as IngredientLine[];
  return lines.map((line) => {
    const food = foods.get(line.foodId);
    return { name: food?.name ?? line.foodId, quantity: `${line.grams}g` };
  });
}

type MealDbRow = {
  id: number;
  cycle_day: number;
  slot_name: string;
  time: string;
  ref: string | null;
  free_note: string | null;
};

function mapMealRow(
  row: MealDbRow,
  recipes: Map<string, RecipeRow>,
  foods: Map<string, Food>,
  slotTimes: Map<string, string>,
): MealRow {
  const time = slotTimes.get(row.slot_name) ?? row.time;
  if (row.ref === null) {
    return {
      id: row.id,
      cycleDay: row.cycle_day,
      slotName: row.slot_name,
      time,
      dishName: row.free_note ?? 'Repas libre',
      isOffCycle: true,
      macros: null,
      ingredients: [],
      steps: [],
    };
  }

  const recipe = recipes.get(row.ref);
  if (!recipe) {
    return {
      id: row.id,
      cycleDay: row.cycle_day,
      slotName: row.slot_name,
      time,
      dishName: '(recette introuvable)',
      isOffCycle: false,
      macros: null,
      ingredients: [],
      steps: [],
    };
  }

  return {
    id: row.id,
    cycleDay: row.cycle_day,
    slotName: row.slot_name,
    time,
    dishName: recipe.name,
    isOffCycle: false,
    macros: {
      calories: recipe.calories,
      protein: recipe.protein,
      carbs: recipe.carbs,
      fat: recipe.fat,
      fiber: recipe.fiber,
    },
    ingredients: resolveIngredients(recipe.ingredients, foods),
    steps: recipe.steps ? (JSON.parse(recipe.steps) as string[]) : [],
  };
}

function getRecipesMap(): Map<string, RecipeRow> {
  const rows = db.getAllSync<RecipeRow>(
    'SELECT id, name, calories, protein, carbs, fat, fiber, ingredients, steps FROM nutrition_recipes',
  );
  return new Map(rows.map((r) => [r.id, r]));
}

export function getMealsForCycleDay(cycleDay: number): MealRow[] {
  const rows = db.getAllSync<MealDbRow>(
    'SELECT id, cycle_day, slot_name, time, ref, free_note FROM nutrition_meals WHERE cycle_day = ? ORDER BY time ASC',
    cycleDay,
  );
  const recipes = getRecipesMap();
  const foods = getFoodsMap();
  const slotTimes = getSlotTimeOverrides();
  // Trié après coup : une heure personnalisée peut changer l'ordre des repas du jour.
  return rows.map((r) => mapMealRow(r, recipes, foods, slotTimes)).sort((a, b) => a.time.localeCompare(b.time));
}

/** Tous les repas du cycle, tous jours confondus (utile pour reprogrammer les rappels). */
export function getAllMeals(): MealRow[] {
  const rows = db.getAllSync<MealDbRow>(
    'SELECT id, cycle_day, slot_name, time, ref, free_note FROM nutrition_meals ORDER BY cycle_day ASC, time ASC',
  );
  const recipes = getRecipesMap();
  const foods = getFoodsMap();
  const slotTimes = getSlotTimeOverrides();
  return rows.map((r) => mapMealRow(r, recipes, foods, slotTimes));
}

export function getDayTotals(cycleDay: number): DayTotals | null {
  const row = db.getFirstSync<{ calories: number; protein: number; carbs: number; fat: number; fiber: number }>(
    'SELECT calories, protein, carbs, fat, fiber FROM nutrition_days WHERE cycle_day = ?',
    cycleDay,
  );
  if (!row) return null;
  return row;
}

export function getCompletedMealIdsForDate(date: string): Set<number> {
  const rows = db.getAllSync<{ meal_id: number }>(
    'SELECT meal_id FROM nutrition_meal_completions WHERE date = ?',
    date,
  );
  return new Set(rows.map((row) => row.meal_id));
}

export function setMealCompletion(mealId: number, date: string, completed: boolean) {
  if (completed) {
    db.runSync(
      'INSERT OR IGNORE INTO nutrition_meal_completions (meal_id, date) VALUES (?, ?)',
      mealId,
      date,
    );
  } else {
    db.runSync('DELETE FROM nutrition_meal_completions WHERE meal_id = ? AND date = ?', mealId, date);
  }
}

/**
 * Heures personnalisées par NOM de créneau (ex : "Petit-déjeuner"), appliquées par-dessus
 * n'importe quel plan. Stockées à part des repas importés : un réimport de plan efface les
 * repas mais pas ces réglages. Table exclue de la réinitialisation de database.ts.
 */
export function getSlotTimeOverrides(): Map<string, string> {
  const rows = db.getAllSync<{ slot_name: string; time: string }>('SELECT slot_name, time FROM nutrition_slot_times');
  return new Map(rows.map((r) => [r.slot_name, r.time]));
}

export function setSlotTime(slotName: string, time: string) {
  db.runSync('INSERT OR REPLACE INTO nutrition_slot_times (slot_name, time) VALUES (?, ?)', slotName, time);
}

export function clearSlotTimes() {
  db.runSync('DELETE FROM nutrition_slot_times');
}

export type MealSlot = {
  slotName: string;
  /** Heure actuellement appliquée (personnalisée si elle existe, sinon celle du plan). */
  time: string;
  /** Vrai si le plan donne des heures différentes à ce créneau selon les jours. */
  variesByDay: boolean;
};

/** Créneaux distincts du plan actif (une ligne par nom), triés par heure. */
export function getMealSlots(): MealSlot[] {
  const rows = db.getAllSync<{ slot_name: string; min_time: string; max_time: string }>(
    'SELECT slot_name, MIN(time) AS min_time, MAX(time) AS max_time FROM nutrition_meals GROUP BY slot_name',
  );
  const overrides = getSlotTimeOverrides();
  return rows
    .map((r) => ({
      slotName: r.slot_name,
      time: overrides.get(r.slot_name) ?? r.min_time,
      variesByDay: !overrides.has(r.slot_name) && r.min_time !== r.max_time,
    }))
    .sort((a, b) => a.time.localeCompare(b.time));
}

/**
 * Définit sur quel jour de la SEMAINE commence le cycle (ex : "samedi", le jour des courses).
 * L'ancrage est le dernier `startWeekday` passé ou d'aujourd'hui ; pour un cycle de 14 jours,
 * `cycleWeek` (1 ou 2) dit si la semaine en cours est la première ou la seconde du cycle.
 * Par défaut le jour 1 est le jour d'import, ce qui décalait les jours de courses / de batch
 * cooking prévus par le plan. Stocké à part du plan : survit à un réimport.
 */
export function setCycleStart(startWeekday: string, cycleWeek: number) {
  const daysBack = daysSinceWeekday(startWeekday) + (cycleWeek - 1) * 7;
  setSetting(CYCLE_START_KEY, dateStringDaysAgo(daysBack));
}

/** Revient au comportement par défaut : le jour 1 est le jour d'import du plan. */
export function resetCycleStart() {
  deleteSetting(CYCLE_START_KEY);
}

/** Semaines pour lesquelles le plan fournit une liste de courses (1, 2...). */
export function getCourseWeeks(): number[] {
  return db
    .getAllSync<{ week: number }>('SELECT DISTINCT week FROM nutrition_course_items ORDER BY week ASC')
    .map((row) => row.week);
}

export function getShoppingItems(week: number): ShoppingItem[] {
  const rows = db.getAllSync<{
    id: number;
    food_id: string;
    name: string | null;
    category: string | null;
    grams: number | null;
    units: number | null;
    is_pantry: number;
    needs_freezing: number;
    checked: number;
  }>(
    `SELECT i.id, i.food_id, f.name, f.category, i.grams, i.units, i.is_pantry, i.needs_freezing,
            CASE WHEN c.item_id IS NULL THEN 0 ELSE 1 END AS checked
     FROM nutrition_course_items i
     LEFT JOIN nutrition_foods f ON f.id = i.food_id
     LEFT JOIN nutrition_course_checks c ON c.item_id = i.id
     WHERE i.week = ?`,
    week,
  );
  return rows.map((row) => ({
    id: row.id,
    foodId: row.food_id,
    // Un aliment introuvable ne doit pas faire disparaître la ligne : on affiche son identifiant.
    name: row.name ?? row.food_id,
    category: (row.category ?? 'autre') as ShoppingItem['category'],
    grams: row.grams,
    units: row.units,
    isPantry: row.is_pantry === 1,
    needsFreezing: row.needs_freezing === 1,
    checked: row.checked === 1,
  }));
}

export function setShoppingItemChecked(itemId: number, checked: boolean) {
  if (checked) {
    db.runSync('INSERT OR IGNORE INTO nutrition_course_checks (item_id) VALUES (?)', itemId);
  } else {
    db.runSync('DELETE FROM nutrition_course_checks WHERE item_id = ?', itemId);
  }
}

/** Décoche tous les articles d'une semaine (pour refaire les mêmes courses au cycle suivant). */
export function clearShoppingChecks(week: number) {
  db.runSync(
    'DELETE FROM nutrition_course_checks WHERE item_id IN (SELECT id FROM nutrition_course_items WHERE week = ?)',
    week,
  );
}

/** Fixe directement la date d'ancrage du cycle (restauration d'une sauvegarde). */
export function setCycleStartDate(dateString: string) {
  setSetting(CYCLE_START_KEY, dateString);
}
