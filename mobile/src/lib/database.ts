import * as SQLite from 'expo-sqlite';

/** Connexion SQLite partagée entre tous les domaines (nutrition, sport, maison...). */
export const db = SQLite.openDatabaseSync('assistant-personnel.db');

/**
 * Version du schéma local, tous domaines confondus. À incrémenter à chaque changement de
 * structure (n'importe quel domaine) : la base est alors recréée à vide plutôt que migrée —
 * pas de garantie de préservation des données à ce stade du projet (voir CLAUDE.md).
 */
const SCHEMA_VERSION = 7;

// Ne PAS inclure ici les données que l'utilisateur construit ou choisit lui-même :
// "sport_exercise_logs", "sport_session_completions", "sport_activities",
// "sport_session_progress" (historique et
// séance en cours), "app_settings" et "nutrition_slot_times" (réglages), "shopping_custom_items"
// (articles ajoutés à la main), "health_daily" (totaux importés de Health Connect), "waste_bins" (calendrier des poubelles), "plan_sources" (texte
// d'origine des plans, pour la sauvegarde). On les préserve entre
// les réimports de plan et les changements de schéma, contrairement au reste (qui n'est qu'une
// copie locale d'un plan réimportable depuis son JSON source).
const ALL_TABLES = [
  'nutrition_course_checks',
  'nutrition_meal_completions',
  'nutrition_course_items',
  'nutrition_meals',
  'nutrition_days',
  'nutrition_recipes',
  'nutrition_foods',
  'nutrition_plan',
  'sport_progress',
  'sport_exercises',
  'sport_sessions',
  'sport_days',
  'sport_plan',
];

export function initDatabase(initSchemas: (() => void)[]) {
  db.execSync('PRAGMA journal_mode = WAL;');

  const row = db.getFirstSync<{ user_version: number }>('PRAGMA user_version');
  if ((row?.user_version ?? 0) !== SCHEMA_VERSION) {
    db.execSync(ALL_TABLES.map((t) => `DROP TABLE IF EXISTS ${t};`).join('\n'));
  }

  for (const init of initSchemas) init();

  db.execSync(`PRAGMA user_version = ${SCHEMA_VERSION};`);
}
