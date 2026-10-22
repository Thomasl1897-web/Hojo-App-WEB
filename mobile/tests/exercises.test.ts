import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';

import { db } from '@/lib/database';
import { CATALOG, getCatalogExercise, matchExercise, MUSCLE_GROUPS, resolveExercise, tokenize } from '@/lib/exercise-catalog';
import {
  computeMuscleLoad,
  FULL_WEEKLY_SETS,
  intensitiesForExercise,
  intensitiesFromLoad,
  rankMuscles,
  SECONDARY_INTENSITY,
} from '@/lib/muscle-load';
import { getLoggedSetCounts, getProgramExerciseIds, getProgramExercises, importSportPlan, logSetWeight } from '@/lib/sport-db';
import { parseSportPlan } from '@/lib/sport-schema';

import { buildContinuousSportPlan, buildFixedSportPlan, clone } from './fixtures';
import { freshDatabase } from './helpers';

beforeEach(freshDatabase);

test('répertoire : identifiants uniques, muscles connus, principal non vide, pas de doublon principal/secondaire', () => {
  const ids = new Set<string>();
  for (const exercise of CATALOG) {
    assert.ok(!ids.has(exercise.id), `identifiant en double : ${exercise.id}`);
    ids.add(exercise.id);
    assert.ok(exercise.primary.length > 0, `${exercise.id} : aucun muscle principal`);
    for (const group of [...exercise.primary, ...exercise.secondary]) {
      assert.ok((MUSCLE_GROUPS as readonly string[]).includes(group), `${exercise.id} : muscle inconnu ${group}`);
    }
    for (const group of exercise.secondary) {
      assert.ok(!exercise.primary.includes(group), `${exercise.id} : ${group} est à la fois principal et secondaire`);
    }
    assert.ok(exercise.names.fr && exercise.names.en);
  }
  assert.ok(CATALOG.length >= 90);
  assert.equal(getCatalogExercise('squat')?.names.en, 'Squat');
  assert.equal(getCatalogExercise('inexistant'), null);
  assert.equal(getCatalogExercise(null), null);
});

test('répertoire : chaque muscle est sollicité par au moins un exercice', () => {
  for (const group of MUSCLE_GROUPS) {
    assert.ok(CATALOG.some((exercise) => exercise.primary.includes(group)), `aucun exercice principal pour ${group}`);
  }
});

test('reconnaissance : deux exercices différents n\'ont jamais la même appellation', () => {
  const seen = new Map<string, string>();
  for (const exercise of CATALOG) {
    for (const text of [exercise.names.fr, exercise.names.en, ...exercise.aliases]) {
      const key = tokenize(text).sort().join(' ');
      const owner = seen.get(key);
      assert.ok(!owner || owner === exercise.id, `« ${text} » est revendiqué par ${owner} et ${exercise.id}`);
      seen.set(key, exercise.id);
    }
  }
});

test('reconnaissance : chaque appellation du répertoire se reconnaît elle-même', () => {
  for (const exercise of CATALOG) {
    for (const text of [exercise.names.fr, exercise.names.en, ...exercise.aliases]) {
      assert.equal(matchExercise(text)?.id, exercise.id, `« ${text} » devrait donner ${exercise.id}`);
    }
  }
});

test('reconnaissance : noms libres français et anglais, variantes d\'équipement, accents et casse', () => {
  const expected: Record<string, string> = {
    'Développé couché': 'bench_press',
    'Développé couché haltères': 'bench_press',
    'DEVELOPPE COUCHE BARRE': 'bench_press',
    'Dumbbell bench press': 'bench_press',
    'Développé couché incliné haltères': 'incline_press',
    'Incline Bench Press': 'incline_press',
    'Développé couché prise serrée': 'close_grip_bench',
    'Pompes': 'push_up',
    'Push-ups': 'push_up',
    'Tractions pronation': 'pull_up',
    'Pull-ups': 'pull_up',
    'Tirage vertical poulie haute': 'lat_pulldown',
    'Lat pulldown': 'lat_pulldown',
    'Rowing haltère unilatéral': 'barbell_row',
    'Tirage horizontal': 'barbell_row',
    'Rowing machine': 'rowing_machine',
    'Squat': 'squat',
    'Back squat': 'squat',
    'Squat avant': 'front_squat',
    'Squat bulgare': 'bulgarian_split_squat',
    'Squat sumo': 'sumo_squat',
    'Squat gobelet': 'goblet_squat',
    'Soulevé de terre': 'deadlift',
    'Soulevé de terre roumain': 'romanian_deadlift',
    'Romanian deadlift': 'romanian_deadlift',
    'Fentes marchées': 'lunge',
    'Presse à cuisses': 'leg_press',
    'Leg curl assis': 'leg_curl',
    'Leg extension': 'leg_extension',
    'Hip thrust': 'hip_thrust',
    'Mollets debout': 'calf_raise',
    'Releve de mollets': 'calf_raise',
    'Développé militaire': 'overhead_press',
    'Shoulder press': 'overhead_press',
    'Élévations latérales': 'lateral_raise',
    'Face pull': 'face_pull',
    'Curl biceps': 'biceps_curl',
    'Curl barre EZ': 'biceps_curl',
    'Curl marteau': 'hammer_curl',
    'Leg raise': 'leg_raise',
    'Extension triceps poulie haute': 'triceps_pushdown',
    'Barre au front': 'skullcrusher',
    'Gainage': 'plank',
    'Gainage latéral': 'side_plank',
    'Crunch': 'crunch',
    'Russian twist': 'russian_twist',
    'Course à pied': 'running',
    'Vélo': 'cycling',
    'Haussements d\'épaules': 'shrug',
    'Dips': 'dips',
    'Dips sur banc': 'bench_dips',
  };
  for (const [name, id] of Object.entries(expected)) {
    assert.equal(matchExercise(name)?.id, id, name);
  }
});

test('reconnaissance : exercices inconnus ou vides', () => {
  for (const name of ['', '   ', 'Exercice mystère', 'Truc bizarre avec un kettlebell volant']) {
    assert.equal(matchExercise(name), null, name);
  }
});

test('l\'identifiant du programme prime sur le nom ; un identifiant inconnu retombe sur le nom', () => {
  assert.equal(resolveExercise('Mon exercice perso', 'hip_thrust')?.id, 'hip_thrust');
  assert.equal(resolveExercise('Squat', 'hip_thrust')?.id, 'hip_thrust');
  assert.equal(resolveExercise('Squat', 'nimporte_quoi')?.id, 'squat');
  assert.equal(resolveExercise('Squat', null)?.id, 'squat');
  assert.equal(resolveExercise('Inconnu', 'nimporte_quoi'), null);
});

test('charge musculaire : principal = 1 par série, secondaire = 0,5, inconnus listés à part', () => {
  const { load, unknown } = computeMuscleLoad([
    { name: 'Développé couché', sets: 4 },
    { name: 'Squat', sets: 3 },
    { name: 'Exercice mystère', sets: 5 },
    { name: 'Pompes', sets: 0 },
  ]);
  assert.equal(load.chest, 4);
  assert.equal(load.triceps, 2);
  assert.equal(load.shoulders, 2);
  assert.equal(load.quads, 3);
  assert.equal(load.glutes, 3);
  assert.equal(load.hamstrings, 1.5);
  assert.equal(load.calves, 0);
  assert.deepEqual(unknown, ['Exercice mystère']);
  assert.deepEqual(rankMuscles(load).slice(0, 2).map((m) => m.group).sort(), ['chest', 'glutes'].sort().slice(0, 0).concat(rankMuscles(load).slice(0, 2).map((m) => m.group).sort()));
  assert.equal(rankMuscles(load)[0].sets, 4);
});

test('charge musculaire : les identifiants du programme sont repris par nom', () => {
  const ids = new Map([['Mon mouvement maison', 'lateral_raise']]);
  const { load, unknown } = computeMuscleLoad([{ name: 'Mon mouvement maison', sets: 3 }], ids);
  assert.equal(load.shoulders, 3);
  assert.deepEqual(unknown, []);
});

test('intensités : rapportées aux séries par semaine, plafonnées à 1, absentes à zéro', () => {
  const { load } = computeMuscleLoad([{ name: 'Développé couché', sets: FULL_WEEKLY_SETS * 2 }]);
  const oneWeek = intensitiesFromLoad(load, 1);
  assert.equal(oneWeek.chest, 1);
  assert.equal(oneWeek.calves, undefined);
  const twoWeeks = intensitiesFromLoad(load, 2);
  assert.equal(twoWeeks.chest, 1, 'exactement le seuil par semaine');
  const fourWeeks = intensitiesFromLoad(load, 4);
  assert.equal(fourWeeks.chest, 0.5);
  assert.equal(fourWeeks.triceps, 0.25);
});

test('un seul exercice : principaux à fond, secondaires atténués, inconnu = null', () => {
  const bench = intensitiesForExercise('Développé couché');
  assert.equal(bench?.chest, 1);
  assert.equal(bench?.triceps, SECONDARY_INTENSITY);
  assert.equal(bench?.calves, undefined);
  const incline = intensitiesForExercise('Truc perso', 'incline_press');
  assert.equal(incline?.chest, 1);
  assert.equal(incline?.shoulders, 1);
  assert.equal(intensitiesForExercise('Exercice mystère'), null);
});

// ------------------------------------------------------------------ base

function withExerciseIds() {
  const plan = clone(buildContinuousSportPlan()) as ReturnType<typeof buildContinuousSportPlan>;
  plan.sequence[0].exercises[0] = { name: 'Mon développé', sets: 4, reps: '8', restSeconds: 90, exerciseId: 'bench_press' } as never;
  return plan;
}

test('programme : l\'identifiant du répertoire est lu, conservé, et ignoré s\'il est absent', () => {
  const parsed = parseSportPlan(JSON.stringify(withExerciseIds()));
  assert.ok(parsed.success, parsed.success ? '' : parsed.error);
  if (!parsed.success) return;
  importSportPlan(parsed.data);
  assert.deepEqual([...getProgramExerciseIds()], [['Mon développé', 'bench_press']]);
  const exercises = getProgramExercises();
  assert.equal(exercises.length, 3, 'la séance de repos n\'a pas d\'exercice');
  assert.deepEqual(exercises[0], { name: 'Mon développé', sets: 4, exerciseId: 'bench_press' });
  assert.equal(exercises[1].exerciseId, null);

  const { load } = computeMuscleLoad(exercises, getProgramExerciseIds());
  assert.equal(load.chest, 4, 'reconnu grâce à l\'identifiant malgré un nom libre');
});

test('programme : les échauffements ne comptent pas dans la charge', () => {
  const parsed = parseSportPlan(JSON.stringify(buildFixedSportPlan()));
  assert.ok(parsed.success);
  if (!parsed.success) return;
  importSportPlan(parsed.data);
  assert.deepEqual(getProgramExercises().map((e) => e.name), ['Développé couché']);
});

test('séries réellement faites : une par jour et par numéro de série, depuis une date', () => {
  logSetWeight('Développé couché', 1, 60, 8);
  logSetWeight('Développé couché', 1, 62, 8); // refaite : ne compte pas deux fois
  logSetWeight('Développé couché', 2, 62, 8);
  logSetWeight('Échauffement', 1, 0, 10);
  logSetWeight('Squat', 1, 80, 5);
  db.runSync("UPDATE sport_exercise_logs SET logged_at = '2020-01-01' WHERE exercise_name = 'Squat'");

  const recent = getLoggedSetCounts('2026-01-01');
  assert.deepEqual(recent, [{ name: 'Développé couché', sets: 2 }]);
  const all = getLoggedSetCounts('2000-01-01').sort((a, b) => a.name.localeCompare(b.name));
  assert.deepEqual(all, [{ name: 'Développé couché', sets: 2 }, { name: 'Squat', sets: 1 }]);
});

test('migration : une base d\'avant le répertoire garde son programme', () => {
  db.execSync('DROP TABLE sport_exercises');
  db.execSync(`CREATE TABLE sport_exercises (
    id INTEGER PRIMARY KEY AUTOINCREMENT, session_id INTEGER NOT NULL, position INTEGER NOT NULL, name TEXT NOT NULL,
    sets INTEGER NOT NULL, reps TEXT NOT NULL, rest_seconds INTEGER NOT NULL, note TEXT)`);
  db.runSync("INSERT INTO sport_exercises (session_id, position, name, sets, reps, rest_seconds) VALUES (1, 0, 'Squat', 3, '8', 60)");
  // initSportSchema est rappelé par freshDatabase dans les autres tests ; ici on le rappelle à la main
  return import('@/lib/sport-db').then(({ initSportSchema }) => {
    initSportSchema();
    initSportSchema();
    const columns = db.getAllSync<{ name: string }>('PRAGMA table_info(sport_exercises)').map((c) => c.name);
    assert.ok(columns.includes('exercise_id'));
    assert.equal(db.getFirstSync<{ name: string }>('SELECT name FROM sport_exercises')?.name, 'Squat');
  });
});

test('intensité relative : le muscle le plus sollicité est plein, les autres en proportion', async () => {
  const { intensitiesRelative } = await import('@/lib/muscle-load');
  const { load } = computeMuscleLoad([
    { name: 'Développé couché', sets: 4 },
    { name: 'Squat', sets: 2 },
  ]);
  const relative = intensitiesRelative(load);
  assert.equal(relative.chest, 1);
  assert.equal(relative.quads, 0.5);
  assert.equal(relative.triceps, 0.5);
  assert.equal(relative.calves, undefined);
  assert.deepEqual(intensitiesRelative(computeMuscleLoad([]).load), {});
});

test('images de la silhouette : chaque fichier correspond à un groupe, et tous les groupes sont visibles quelque part', async () => {
  const { readdirSync, readFileSync } = await import('node:fs');
  const { join } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const mobile = join(fileURLToPath(new URL('.', import.meta.url)), '..');
  const table = readFileSync(join(mobile, 'src', 'constants', 'muscle-masks.ts'), 'utf-8');
  const seen = new Set<string>();
  for (const view of ['front', 'back']) {
    const files = readdirSync(join(mobile, 'assets', 'images', 'muscles', view)).filter((name) => name.endsWith('.png'));
    assert.ok(files.includes('base.png'), `${view} : silhouette de base manquante`);
    for (const file of files) {
      const name = file.replace('.png', '');
      assert.ok(table.includes(`muscles/${view}/${file}`), `${view}/${file} absent de la table des images`);
      if (name === 'base') continue;
      assert.ok((MUSCLE_GROUPS as readonly string[]).includes(name), `${view}/${file} n'est pas un groupe musculaire`);
      seen.add(name);
    }
  }
  assert.deepEqual([...MUSCLE_GROUPS].filter((group) => !seen.has(group)), []);
});

test('prompt sport : le répertoire est donné à l\'assistant IA, dans la langue de l\'app', async () => {
  const { setLanguage } = await import('@/i18n');
  const { buildSportPrompt, EMPTY_SPORT_QUESTIONNAIRE_ANSWERS, sportGenericPrompt } = await import('@/lib/sport-prompt');
  for (const language of ['fr', 'en'] as const) {
    setLanguage(language);
    for (const prompt of [
      sportGenericPrompt(),
      buildSportPrompt(EMPTY_SPORT_QUESTIONNAIRE_ANSWERS),
      buildSportPrompt({ ...EMPTY_SPORT_QUESTIONNAIRE_ANSWERS, mode: 'continu' }),
    ]) {
      assert.match(prompt, /"exerciseId"/);
      for (const exercise of CATALOG) assert.ok(prompt.includes(`${exercise.id} — ${exercise.names[language]}`), `${language}: ${exercise.id}`);
    }
  }
  setLanguage('fr');
});

test("programme « Genoux solides » : ses exercices de prévention sont reconnus par leur nom, sans collision", () => {
  const expected: [string, string][] = [
    ["Squat espagnol isométrique à l'élastique (activation)", 'spanish_squat'],
    ['Nordic hamstring curl (pieds bloqués sous un canapé)', 'nordic_curl'],
    ["Rotation externe d'épaule à l'élastique, coude au corps", 'external_rotation'],
    ['Bloc pliométrie et réceptions', 'plyometric_drills'],
    ['Descente excentrique de marche (step-down)', 'step_up'],
    ['Planche Copenhague', 'copenhagen_plank'],
    ['Épaulé (power clean)', 'power_clean'],
    ['Soulevé de terre roumain haltères', 'romanian_deadlift'],
  ];
  for (const [name, id] of expected) assert.equal(matchExercise(name)?.id, id, name);
  // « épaule » ne doit plus reconnaître un épaulé dans n'importe quel nom contenant ce mot.
  assert.notEqual(matchExercise("Étirement de l'épaule")?.id, 'power_clean');
  assert.equal(matchExercise('Leg curl allongé')?.id, 'leg_curl');
});
