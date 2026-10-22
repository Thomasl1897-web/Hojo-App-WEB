import { db } from '@/lib/database';
import { getTodayDateString, getWeekdayLabel } from '@/lib/date';
import { getSetting, setSetting, SPORT_REMINDER_TIME_KEY } from '@/lib/settings-db';
import { isAuxiliaryExercise } from '@/lib/sport-stats';
import type { Weekday } from '@/lib/nutrition-schema';
import type { Exercise, SportPlan } from '@/lib/sport-schema';

export type SportMode = 'fixe' | 'continu';

export type SportPlanMeta = {
  name: string;
  mode: SportMode;
  preferredTime: string;
};

export type SportSessionRow = {
  sessionName: string;
  isRestDay: boolean;
  exercises: Exercise[];
  /** Jour de semaine (mode "fixe" uniquement). */
  weekday: Weekday | null;
  /** Rang dans le programme (ordre de l'enchaînement en mode continu). */
  position: number;
  /** Mode continu : séance facultative, hors de l'enchaînement. */
  isOptional: boolean;
};

export function initSportSchema() {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS sport_plan (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      name TEXT NOT NULL,
      mode TEXT NOT NULL,
      preferred_time TEXT NOT NULL,
      imported_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sport_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      position INTEGER NOT NULL,
      weekday TEXT,
      session_name TEXT NOT NULL,
      is_rest_day INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sport_exercises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      position INTEGER NOT NULL,
      name TEXT NOT NULL,
      sets INTEGER NOT NULL,
      reps TEXT NOT NULL,
      rest_seconds INTEGER NOT NULL,
      note TEXT
    );

    CREATE TABLE IF NOT EXISTS sport_progress (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      current_index INTEGER NOT NULL,
      last_completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS sport_exercise_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      exercise_name TEXT NOT NULL,
      set_number INTEGER NOT NULL,
      weight REAL NOT NULL,
      logged_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sport_session_completions (
      date TEXT PRIMARY KEY,
      session_name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sport_activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      name TEXT NOT NULL,
      duration_minutes INTEGER
    );

    CREATE TABLE IF NOT EXISTS sport_session_progress (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      date TEXT NOT NULL,
      session_name TEXT NOT NULL,
      exercise_index INTEGER NOT NULL,
      current_set INTEGER NOT NULL
    );
  `);

  // Répétitions ajoutées après coup : colonne ajoutée sans vider l'historique existant (les anciennes
  // lignes gardent NULL = répétitions inconnues).
  const exerciseColumns = db.getAllSync<{ name: string }>('PRAGMA table_info(sport_exercises)');
  if (!exerciseColumns.some((column) => column.name === 'exercise_id')) {
    db.execSync('ALTER TABLE sport_exercises ADD COLUMN exercise_id TEXT');
  }
  // Supersets, tempo, RIR et alternative (ajoutés après coup, facultatifs).
  for (const name of ['superset_group', 'tempo', 'rir', 'alternative']) {
    if (!exerciseColumns.some((column) => column.name === name)) {
      db.execSync(`ALTER TABLE sport_exercises ADD COLUMN ${name} TEXT`);
    }
  }
  const sessionColumns = db.getAllSync<{ name: string }>('PRAGMA table_info(sport_sessions)');
  if (!sessionColumns.some((column) => column.name === 'is_optional')) {
    db.execSync('ALTER TABLE sport_sessions ADD COLUMN is_optional INTEGER NOT NULL DEFAULT 0');
  }
  // Activités importées de Health Connect : origine, identifiant de l'enregistrement (pour ne jamais
  // importer deux fois la même) et calories actives. Anciennes lignes : saisies à la main, donc NULL.
  const activityColumns = db.getAllSync<{ name: string }>('PRAGMA table_info(sport_activities)');
  for (const [name, type] of [['source', 'TEXT'], ['external_id', 'TEXT'], ['calories', 'INTEGER']] as const) {
    if (!activityColumns.some((column) => column.name === name)) {
      db.execSync(`ALTER TABLE sport_activities ADD COLUMN ${name} ${type}`);
    }
  }
  db.execSync(
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_sport_activities_external ON sport_activities(external_id) WHERE external_id IS NOT NULL',
  );
  const logColumns = db.getAllSync<{ name: string }>('PRAGMA table_info(sport_exercise_logs)');
  if (!logColumns.some((column) => column.name === 'reps')) {
    db.execSync('ALTER TABLE sport_exercise_logs ADD COLUMN reps INTEGER');
  }
}

export function importSportPlan(plan: SportPlan) {
  db.withTransactionSync(() => {
    db.runSync('DELETE FROM sport_exercises');
    db.runSync('DELETE FROM sport_sessions');
    db.runSync('DELETE FROM sport_progress');
    db.runSync('DELETE FROM sport_plan');

    db.runSync(
      'INSERT INTO sport_plan (id, name, mode, preferred_time, imported_at) VALUES (1, ?, ?, ?, ?)',
      plan.name,
      plan.mode,
      plan.preferredTime,
      new Date().toISOString(),
    );

    const insertSession = (
      position: number,
      weekday: Weekday | null,
      session: { sessionName: string; isRestDay: boolean; exercises: Exercise[]; optional?: boolean },
    ) => {
      const sessionId = db.runSync(
        'INSERT INTO sport_sessions (position, weekday, session_name, is_rest_day, is_optional) VALUES (?, ?, ?, ?, ?)',
        position,
        weekday,
        session.sessionName,
        session.isRestDay ? 1 : 0,
        session.optional ? 1 : 0,
      ).lastInsertRowId;

      session.exercises.forEach((exercise, exPosition) => {
        db.runSync(
          `INSERT INTO sport_exercises
            (session_id, position, name, sets, reps, rest_seconds, note, exercise_id, superset_group, tempo, rir, alternative)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          sessionId,
          exPosition,
          exercise.name,
          exercise.sets,
          exercise.reps,
          exercise.restSeconds,
          exercise.note ?? null,
          exercise.exerciseId ?? null,
          exercise.superset ?? null,
          exercise.tempo ?? null,
          exercise.rir ?? null,
          exercise.alternative ?? null,
        );
      });
    };

    if (plan.mode === 'fixe') {
      plan.days.forEach((day, position) => insertSession(position, day.weekday, day));
    } else {
      plan.sequence.forEach((session, position) => insertSession(position, null, session));
    }

    if (plan.mode === 'continu') {
      db.runSync('INSERT INTO sport_progress (id, current_index, last_completed_at) VALUES (1, 0, NULL)');
    }
  });
}

export function getActiveSportPlanMeta(): SportPlanMeta | null {
  const row = db.getFirstSync<{ name: string; mode: string; preferred_time: string }>(
    'SELECT name, mode, preferred_time FROM sport_plan WHERE id = 1',
  );
  if (!row) return null;
  // L'heure choisie dans les Paramètres prime sur celle du plan importé.
  const preferredTime = getSetting(SPORT_REMINDER_TIME_KEY) ?? row.preferred_time;
  return { name: row.name, mode: row.mode as SportMode, preferredTime };
}

type SessionDbRow = {
  id: number;
  position: number;
  weekday: string | null;
  session_name: string;
  is_rest_day: number;
  is_optional: number;
};

const SESSION_COLUMNS = 'id, position, weekday, session_name, is_rest_day, is_optional';
type ExerciseDbRow = {
  name: string;
  sets: number;
  reps: string;
  rest_seconds: number;
  note: string | null;
  exercise_id: string | null;
  superset_group: string | null;
  tempo: string | null;
  rir: string | null;
  alternative: string | null;
};

function loadExercises(sessionId: number): Exercise[] {
  const rows = db.getAllSync<ExerciseDbRow>(
    'SELECT name, sets, reps, rest_seconds, note, exercise_id, superset_group, tempo, rir, alternative FROM sport_exercises WHERE session_id = ? ORDER BY position ASC',
    sessionId,
  );
  return rows.map((r) => ({
    name: r.name,
    sets: r.sets,
    reps: r.reps,
    restSeconds: r.rest_seconds,
    note: r.note ?? undefined,
    exerciseId: r.exercise_id ?? undefined,
    superset: r.superset_group ?? undefined,
    tempo: r.tempo ?? undefined,
    rir: r.rir ?? undefined,
    alternative: r.alternative ?? undefined,
  }));
}

function mapSessionRow(row: SessionDbRow): SportSessionRow {
  return {
    sessionName: row.session_name,
    isRestDay: row.is_rest_day === 1,
    position: row.position,
    isOptional: row.is_optional === 1,
    exercises: loadExercises(row.id),
    weekday: (row.weekday as Weekday | null) ?? null,
  };
}

/** Programme actif reconstruit tel qu'il est en base (point de départ de l'éditeur), ou null. */
export function getSportPlanForEdit(): SportPlan | null {
  const meta = getActiveSportPlanMeta();
  if (!meta) return null;
  const rows = db.getAllSync<SessionDbRow>(
    `SELECT ${SESSION_COLUMNS} FROM sport_sessions ORDER BY position ASC`,
  );
  const sessions = rows.map(mapSessionRow);
  const base = { type: 'sport' as const, name: meta.name, preferredTime: meta.preferredTime };
  if (meta.mode === 'fixe') {
    return {
      ...base,
      mode: 'fixe',
      days: sessions.map((s) => ({
        sessionName: s.sessionName,
        isRestDay: s.isRestDay,
        exercises: s.exercises,
        weekday: s.weekday as Weekday,
      })),
    };
  }
  return {
    ...base,
    mode: 'continu',
    sequence: sessions.map((s) => ({
      sessionName: s.sessionName,
      isRestDay: s.isRestDay,
      exercises: s.exercises,
      ...(s.isOptional ? { optional: true } : {}),
    })),
  };
}

/**
 * Remplace le programme par une version modifiée à la main. Contrairement à un import, on garde la position
 * du mode continu (ramenée dans la nouvelle liste) et l'heure de rappel choisie dans les Réglages suit
 * celle de l'éditeur ; l'historique des charges (par nom d'exercice) n'est jamais touché.
 */
export function saveEditedSportPlan(plan: SportPlan) {
  // `importSportPlan` ouvre sa propre transaction (pas d'imbrication possible) : on lit avant, on corrige après.
  const previousIndex = db.getFirstSync<{ current_index: number }>(
    'SELECT current_index FROM sport_progress WHERE id = 1',
  )?.current_index;
  importSportPlan(plan);
  if (plan.mode === 'continu' && previousIndex !== undefined) {
    db.runSync(
      'UPDATE sport_progress SET current_index = ? WHERE id = 1',
      Math.min(previousIndex, Math.max(0, plan.sequence.filter((session) => !session.optional).length - 1)),
    );
  }
  if (getSetting(SPORT_REMINDER_TIME_KEY) !== null) setSetting(SPORT_REMINDER_TIME_KEY, plan.preferredTime);
}

/** Séance du jour (mode "fixe") — retrouvée par le jour de semaine réel d'aujourd'hui. */
function getTodayFixedSession(): SportSessionRow | null {
  const today = getWeekdayLabel();
  const row = db.getFirstSync<SessionDbRow>(
    `SELECT ${SESSION_COLUMNS} FROM sport_sessions WHERE weekday = ?`,
    today,
  );
  return row ? mapSessionRow(row) : null;
}

/** Prochaine séance recommandée (mode "continu") — selon la progression, pas le calendrier. */
function getNextContinuousSession(): SportSessionRow | null {
  const progress = db.getFirstSync<{ current_index: number }>('SELECT current_index FROM sport_progress WHERE id = 1');
  const rotation = db.getAllSync<SessionDbRow>(
    `SELECT ${SESSION_COLUMNS} FROM sport_sessions WHERE is_optional = 0 ORDER BY position ASC`,
  );
  if (!progress || rotation.length === 0) return null;

  const index = ((progress.current_index % rotation.length) + rotation.length) % rotation.length;
  return mapSessionRow(rotation[index]);
}

/**
 * Séance à afficher/démarrer aujourd'hui, quel que soit le mode du plan actif.
 * Retourne aussi le mode pour que l'écran sache comment l'annoncer.
 */
export function getCurrentSession(): { mode: SportMode; session: SportSessionRow } | null {
  const meta = getActiveSportPlanMeta();
  if (!meta) return null;

  const session = meta.mode === 'fixe' ? getTodayFixedSession() : getNextContinuousSession();
  if (!session) return null;
  return { mode: meta.mode, session };
}

/**
 * Marque la séance courante comme faite. Deux effets distincts :
 * - dans les DEUX modes, enregistre la séance du jour comme faite (permet à l'onglet Sport
 *   de le montrer au lieu de reproposer indéfiniment "Démarrer la séance") ;
 * - en mode "continu" uniquement, fait avancer la progression vers la séance suivante de
 *   l'enchaînement — indépendamment du jour réel. En mode "fixe", la séance du lendemain est
 *   déjà déterminée par le calendrier, il n'y a pas de curseur à avancer.
 */
export function completeCurrentSession() {
  const meta = getActiveSportPlanMeta();
  if (!meta) return;

  clearSessionProgress();

  const current = getCurrentSession();
  if (current) {
    db.runSync(
      'INSERT OR REPLACE INTO sport_session_completions (date, session_name) VALUES (?, ?)',
      getTodayDateString(),
      current.session.sessionName,
    );
  }

  if (meta.mode !== 'continu') return;

  const count = db.getFirstSync<{ count: number }>('SELECT COUNT(*) as count FROM sport_sessions WHERE is_optional = 0')?.count ?? 0;
  if (count === 0) return;

  db.runSync(
    'UPDATE sport_progress SET current_index = (current_index + 1) % ?, last_completed_at = ? WHERE id = 1',
    count,
    getTodayDateString(),
  );
}

/** Séances facultatives du programme (mode continu), dans l'ordre du programme. */
export function getOptionalSessions(): SportSessionRow[] {
  return db
    .getAllSync<SessionDbRow>(`SELECT ${SESSION_COLUMNS} FROM sport_sessions WHERE is_optional = 1 ORDER BY position ASC`)
    .map(mapSessionRow);
}

/** Séance à un rang donné du programme (pour lancer une séance facultative). */
export function getSessionAtPosition(position: number): SportSessionRow | null {
  const row = db.getFirstSync<SessionDbRow>(`SELECT ${SESSION_COLUMNS} FROM sport_sessions WHERE position = ?`, position);
  return row ? mapSessionRow(row) : null;
}

/**
 * Fin d'une séance facultative : elle compte comme une séance faite ce jour-là (série de semaines, statistiques)
 * sans faire avancer l'enchaînement, et sans remplacer une séance de l'enchaînement déjà faite le même jour.
 */
export function completeOptionalSession(sessionName: string) {
  clearSessionProgress();
  db.runSync(
    'INSERT OR IGNORE INTO sport_session_completions (date, session_name) VALUES (?, ?)',
    getTodayDateString(),
    sessionName,
  );
}

/** Nom de la séance terminée aujourd'hui, ou null si aucune ne l'a été. */
export function getTodayCompletedSessionName(): string | null {
  const row = db.getFirstSync<{ session_name: string }>(
    'SELECT session_name FROM sport_session_completions WHERE date = ?',
    getTodayDateString(),
  );
  return row?.session_name ?? null;
}

export type WeightLogEntry = {
  date: string;
  setNumber: number;
  weight: number;
  /** Répétitions faites, null si elles n'ont pas été saisies (anciennes données). */
  reps: number | null;
};

export type WeightHistoryPoint = {
  date: string;
  maxWeight: number;
};

/**
 * Enregistre une série : le poids utilisé (0 pour un exercice au poids du corps) et les répétitions
 * faites (facultatives). Indexé par NOM d'exercice (pas par séance) :
 * si le même exercice revient dans plusieurs séances du plan, l'historique reste continu.
 * Cette table n'est jamais vidée par un réimport de plan ni un changement de schéma
 * (contrairement aux autres tables sport_*) : c'est la seule donnée qu'on tient à préserver
 * dans la durée, voir CLAUDE.md.
 */
export function logSetWeight(exerciseName: string, setNumber: number, weight: number, reps: number | null = null) {
  db.runSync(
    'INSERT INTO sport_exercise_logs (exercise_name, set_number, weight, reps, logged_at) VALUES (?, ?, ?, ?, ?)',
    exerciseName,
    setNumber,
    weight,
    reps,
    getTodayDateString(),
  );
}

/** Poids utilisés la dernière fois que cet exercice a été fait, avant aujourd'hui. */
export function getLastSessionWeights(exerciseName: string): WeightLogEntry[] {
  const today = getTodayDateString();
  const lastDateRow = db.getFirstSync<{ logged_at: string }>(
    'SELECT logged_at FROM sport_exercise_logs WHERE exercise_name = ? AND logged_at < ? ORDER BY logged_at DESC LIMIT 1',
    exerciseName,
    today,
  );
  if (!lastDateRow) return [];

  // Une série refaite le même jour : la dernière saisie fait foi (comme pour les graphiques).
  const rows = db.getAllSync<{ set_number: number; weight: number; reps: number | null }>(
    'SELECT set_number, weight, reps FROM sport_exercise_logs WHERE exercise_name = ? AND logged_at = ? ORDER BY id ASC',
    exerciseName,
    lastDateRow.logged_at,
  );
  const latest = new Map(rows.map((r) => [r.set_number, r]));
  return [...latest.values()]
    .sort((a, b) => a.set_number - b.set_number)
    .map((r) => ({ date: lastDateRow.logged_at, setNumber: r.set_number, weight: r.weight, reps: r.reps }));
}

/** Historique de progression (poids max par séance), les plus récentes en dernier. */
export function getWeightHistory(exerciseName: string, limitDates = 6): WeightHistoryPoint[] {
  const rows = db.getAllSync<{ logged_at: string; max_weight: number }>(
    'SELECT logged_at, MAX(weight) as max_weight FROM sport_exercise_logs WHERE exercise_name = ? GROUP BY logged_at ORDER BY logged_at DESC LIMIT ?',
    exerciseName,
    limitDates,
  );
  return rows.map((r) => ({ date: r.logged_at, maxWeight: r.max_weight })).reverse();
}

export type SportActivity = {
  id: number;
  date: string;
  name: string;
  durationMinutes: number | null;
  /** "health_connect" pour une activité importée, null pour une activité saisie à la main. */
  source: string | null;
  /** Identifiant de l'enregistrement d'origine (activités importées). */
  externalId: string | null;
  /** Calories actives de l'activité, quand la source les donne. */
  calories: number | null;
};

type ActivityRow = {
  id: number;
  date: string;
  name: string;
  duration_minutes: number | null;
  source: string | null;
  external_id: string | null;
  calories: number | null;
};

const ACTIVITY_COLUMNS = 'id, date, name, duration_minutes, source, external_id, calories';

function mapActivity(row: ActivityRow): SportActivity {
  return {
    id: row.id,
    date: row.date,
    name: row.name,
    durationMinutes: row.duration_minutes,
    source: row.source,
    externalId: row.external_id,
    calories: row.calories,
  };
}

/**
 * Activité physique saisie à la main (course, vélo...), en dehors du programme importé. Comme
 * l'historique des séances, table EXCLUE de la réinitialisation de database.ts.
 */
export function addSportActivity(date: string, name: string, durationMinutes: number | null) {
  db.runSync('INSERT INTO sport_activities (date, name, duration_minutes) VALUES (?, ?, ?)', date, name, durationMinutes);
}

/** Une activité saisie à la main, ou null si elle n'existe plus (supprimée entre-temps). */
export function getSportActivity(id: number): SportActivity | null {
  const row = db.getFirstSync<ActivityRow>(`SELECT ${ACTIVITY_COLUMNS} FROM sport_activities WHERE id = ?`, id);
  return row ? mapActivity(row) : null;
}

/** Corrige le nom et la durée d'une activité ; sa date ne change pas. */
export function updateSportActivity(id: number, name: string, durationMinutes: number | null) {
  db.runSync('UPDATE sport_activities SET name = ?, duration_minutes = ? WHERE id = ?', name, durationMinutes, id);
}

/** Toutes les activités saisies à la main, de la plus récente à la plus ancienne. */
export function getAllSportActivities(): SportActivity[] {
  return db
    .getAllSync<ActivityRow>(`SELECT ${ACTIVITY_COLUMNS} FROM sport_activities ORDER BY date DESC, id DESC`)
    .map(mapActivity);
}

/** Toutes les séances du programme terminées (une par jour), de la plus récente à la plus ancienne. */
export function getCompletionHistory(): { date: string; sessionName: string }[] {
  return db
    .getAllSync<{ date: string; session_name: string }>('SELECT date, session_name FROM sport_session_completions ORDER BY date DESC')
    .map((row) => ({ date: row.date, sessionName: row.session_name }));
}

export function deleteSportActivity(id: number) {
  db.runSync('DELETE FROM sport_activities WHERE id = ?', id);
}

/**
 * Date de CHAQUE séance du programme terminée et de chaque activité saisie à la main, de la plus
 * ancienne à la plus récente (une date peut apparaître deux fois : deux séances le même jour).
 * C'est ce qui alimente la série de semaines et l'histogramme : une autre activité physique
 * compte autant qu'une séance du programme.
 */
export function getAllActivityDates(): string[] {
  return db
    .getAllSync<{ date: string }>(
      'SELECT date FROM sport_session_completions UNION ALL SELECT date FROM sport_activities ORDER BY date ASC',
    )
    .map((row) => row.date);
}

export type LoggedExercise = { name: string; lastDate: string; sessions: number };

/** Exercices pour lesquels au moins une charge a été saisie, les plus récemment faits d'abord. */
export function getLoggedExercises(): LoggedExercise[] {
  return db
    .getAllSync<{ name: string; last_date: string; sessions: number }>(
      `SELECT exercise_name AS name, MAX(logged_at) AS last_date, COUNT(DISTINCT logged_at) AS sessions
       FROM sport_exercise_logs GROUP BY exercise_name ORDER BY last_date DESC, name ASC`,
    )
    .map((row) => ({ name: row.name, lastDate: row.last_date, sessions: row.sessions }))
    // L'échauffement et les étirements n'ont pas de progression de charge à suivre.
    .filter((exercise) => !isAuxiliaryExercise(exercise.name));
}

/** Toutes les charges saisies pour un exercice, dans l'ordre d'enregistrement. */
export function getExerciseLogRows(
  exerciseName: string,
): { date: string; setNumber: number; weight: number; reps: number | null }[] {
  return db
    .getAllSync<{ date: string; set_number: number; weight: number; reps: number | null }>(
      'SELECT logged_at AS date, set_number, weight, reps FROM sport_exercise_logs WHERE exercise_name = ? ORDER BY logged_at ASC, id ASC',
      exerciseName,
    )
    .map((row) => ({ date: row.date, setNumber: row.set_number, weight: row.weight, reps: row.reps }));
}

/** Toutes les séances non-repos du plan "fixe" (pour programmer les rappels hebdomadaires). */
export function getFixedTrainingWeekdays(): Weekday[] {
  const rows = db.getAllSync<{ weekday: string }>(
    'SELECT weekday FROM sport_sessions WHERE is_rest_day = 0 AND weekday IS NOT NULL',
  );
  return rows.map((r) => r.weekday as Weekday);
}

export type SessionProgress = {
  exerciseIndex: number;
  currentSet: number;
};

/**
 * Position atteinte dans la séance en cours, pour pouvoir la reprendre après une pause ou
 * une fermeture de l'app. Ignorée si elle date d'un autre jour ou concerne une autre séance
 * (le plan a pu changer entre-temps) : on repart alors de zéro plutôt que de reprendre une
 * position qui n'a plus de sens.
 */
export function getSessionProgress(sessionName: string): SessionProgress | null {
  const row = db.getFirstSync<{ date: string; session_name: string; exercise_index: number; current_set: number }>(
    'SELECT date, session_name, exercise_index, current_set FROM sport_session_progress WHERE id = 1',
  );
  if (!row || row.date !== getTodayDateString() || row.session_name !== sessionName) return null;
  return { exerciseIndex: row.exercise_index, currentSet: row.current_set };
}

export function saveSessionProgress(sessionName: string, progress: SessionProgress) {
  db.runSync(
    'INSERT OR REPLACE INTO sport_session_progress (id, date, session_name, exercise_index, current_set) VALUES (1, ?, ?, ?, ?)',
    getTodayDateString(),
    sessionName,
    progress.exerciseIndex,
    progress.currentSet,
  );
}

export function clearSessionProgress() {
  db.runSync('DELETE FROM sport_session_progress WHERE id = 1');
}

/**
 * Exercices (hors échauffement et étirements) de TOUTES les séances du programme, avec leur nombre de
 * séries : de quoi calculer la charge musculaire prévue d'une semaine (mode fixe) ou d'un cycle
 * complet (mode continu).
 */
export function getProgramExercises(): { name: string; sets: number; exerciseId: string | null }[] {
  return db
    .getAllSync<{ name: string; sets: number; exercise_id: string | null }>(
      `SELECT e.name, e.sets, e.exercise_id
       FROM sport_exercises e JOIN sport_sessions s ON s.id = e.session_id
       WHERE s.is_rest_day = 0 ORDER BY s.position ASC, e.position ASC`,
    )
    .filter((row) => !isAuxiliaryExercise(row.name))
    .map((row) => ({ name: row.name, sets: row.sets, exerciseId: row.exercise_id }));
}

/** Nom d'exercice → identifiant du répertoire, pour les exercices du programme qui en ont un. */
export function getProgramExerciseIds(): Map<string, string> {
  const rows = db.getAllSync<{ name: string; exercise_id: string }>(
    'SELECT name, exercise_id FROM sport_exercises WHERE exercise_id IS NOT NULL',
  );
  return new Map(rows.map((row) => [row.name, row.exercise_id]));
}

/**
 * Séries réellement faites (une par jour et par numéro de série, une séance refaite le même jour ne
 * compte pas deux fois) depuis `sinceDate` (AAAA-MM-JJ, inclus), par exercice.
 */
export function getLoggedSetCounts(sinceDate: string): { name: string; sets: number }[] {
  return db
    .getAllSync<{ name: string; sets: number }>(
      `SELECT exercise_name AS name, COUNT(*) AS sets FROM (
         SELECT DISTINCT exercise_name, logged_at, set_number FROM sport_exercise_logs WHERE logged_at >= ?
       ) GROUP BY exercise_name`,
      sinceDate,
    )
    .filter((row) => !isAuxiliaryExercise(row.name))
    .map((row) => ({ name: row.name, sets: row.sets }));
}

export const HEALTH_CONNECT_SOURCE = 'health_connect';

/**
 * Enregistre une activité importée de Health Connect. Sans effet si cet enregistrement a déjà été
 * importé (identifiant unique) : on peut resynchroniser autant qu'on veut. Retourne vrai si elle est nouvelle.
 */
export function addImportedActivity(activity: {
  externalId: string;
  date: string;
  name: string;
  durationMinutes: number | null;
  calories: number | null;
}): boolean {
  const result = db.runSync(
    'INSERT OR IGNORE INTO sport_activities (date, name, duration_minutes, source, external_id, calories) VALUES (?, ?, ?, ?, ?, ?)',
    activity.date,
    activity.name,
    activity.durationMinutes,
    HEALTH_CONNECT_SOURCE,
    activity.externalId,
    activity.calories,
  );
  return result.changes > 0;
}

/** Identifiants déjà importés (pour ne pas refaire le travail de filtrage à chaque synchronisation). */
export function getImportedExternalIds(): Set<string> {
  const rows = db.getAllSync<{ external_id: string }>('SELECT external_id FROM sport_activities WHERE external_id IS NOT NULL');
  return new Set(rows.map((row) => row.external_id));
}

/** Supprime toutes les activités importées (les activités saisies à la main ne sont pas touchées). */
export function deleteImportedActivities(): number {
  return db.runSync('DELETE FROM sport_activities WHERE source = ?', HEALTH_CONNECT_SOURCE).changes;
}

/** Une séance du programme a-t-elle été terminée ce jour-là ? */
export function hasCompletedProgramSession(date: string): boolean {
  return db.getFirstSync('SELECT 1 FROM sport_session_completions WHERE date = ?', date) !== null;
}
