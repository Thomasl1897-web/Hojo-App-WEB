import { getLanguage, msg } from '@/i18n';

/**
 * Les groupes musculaires de la silhouette (voir `scripts/make-muscle-masks.py`). Un exercice du
 * répertoire dit quels groupes il sollicite en priorité ("primary") et en appoint ("secondary").
 */
export const MUSCLE_GROUPS = [
  'chest',
  'shoulders',
  'biceps',
  'triceps',
  'forearms',
  'abs',
  'obliques',
  'traps',
  'lats',
  'lowerBack',
  'glutes',
  'quads',
  'hamstrings',
  'adductors',
  'calves',
] as const;

export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

/** Libellés (textes français à traduire avec `t`). */
export const MUSCLE_LABELS: Record<MuscleGroup, string> = {
  chest: msg('Pectoraux'),
  shoulders: msg('Épaules'),
  biceps: msg('Biceps'),
  triceps: msg('Triceps'),
  forearms: msg('Avant-bras'),
  abs: msg('Abdominaux'),
  obliques: msg('Obliques'),
  traps: msg('Trapèzes'),
  lats: msg('Dos'),
  lowerBack: msg('Lombaires'),
  glutes: msg('Fessiers'),
  quads: msg('Quadriceps'),
  hamstrings: msg('Ischio-jambiers'),
  adductors: msg('Adducteurs'),
  calves: msg('Mollets'),
};

export type CatalogExercise = {
  /** Identifiant stable (celui que demande le prompt à l'assistant IA). */
  id: string;
  /** Nom français et anglais, affichés dans les listes et donnés à l'assistant IA. */
  names: { fr: string; en: string };
  primary: MuscleGroup[];
  secondary: MuscleGroup[];
  /** Autres façons courantes de le nommer (en plus des deux noms), pour la reconnaissance. */
  aliases: string[];
};

type Entry = [id: string, fr: string, en: string, primary: MuscleGroup[], secondary: MuscleGroup[], aliases?: string[]];

// Pour chaque exercice : id, nom FR, nom EN, muscles principaux, muscles secondaires, autres appellations.
// Les variantes d'équipement (barre, haltères, machine, poulie) partagent les mêmes muscles : elles
// n'ont pas d'entrée à part, la reconnaissance les rattache à l'exercice de base.
const ENTRIES: Entry[] = [
  // --- Pectoraux
  ['bench_press', 'Développé couché', 'Bench press', ['chest'], ['shoulders', 'triceps'], ['chest press', 'developpe pectoraux', 'machine pectoraux']],
  ['incline_press', 'Développé incliné', 'Incline press', ['chest', 'shoulders'], ['triceps'], ['developpe couche incline', 'incline bench press']],
  ['decline_press', 'Développé décliné', 'Decline press', ['chest'], ['triceps', 'shoulders'], ['developpe couche decline', 'decline bench press']],
  ['close_grip_bench', 'Développé couché prise serrée', 'Close-grip bench press', ['triceps'], ['chest', 'shoulders'], ['developpe prise serree', 'close grip bench']],
  ['chest_fly', 'Écarté', 'Chest fly', ['chest'], ['shoulders'], ['ecartes couches', 'ecartes halteres', 'pec fly', 'pec deck', 'butterfly', 'dumbbell fly', 'ecarte poulie']],
  ['cable_crossover', 'Poulie vis-à-vis', 'Cable crossover', ['chest'], ['shoulders'], ['vis a vis', 'cable fly', 'crossover']],
  ['push_up', 'Pompes', 'Push-up', ['chest'], ['triceps', 'shoulders', 'abs'], ['pompe', 'push up', 'pushup', 'pompes diamant', 'diamond push up']],
  ['dips', 'Dips', 'Dips', ['chest', 'triceps'], ['shoulders'], ['dip', 'dips parallettes']],
  ['bench_dips', 'Dips sur banc', 'Bench dips', ['triceps'], ['chest', 'shoulders'], ['dips banc']],
  ['pullover', 'Pull-over', 'Pullover', ['lats', 'chest'], ['triceps'], ['pull over', 'pullover halteres']],

  // --- Épaules
  ['overhead_press', 'Développé militaire', 'Overhead press', ['shoulders'], ['triceps', 'traps'], ['developpe epaules', 'developpe assis', 'shoulder press', 'military press', 'arnold press', 'developpe haltere epaules', 'press epaules']],
  ['lateral_raise', 'Élévations latérales', 'Lateral raise', ['shoulders'], [], ['elevation laterale', 'side raise', 'lateral raises', 'elevation laterale poulie']],
  ['front_raise', 'Élévations frontales', 'Front raise', ['shoulders'], ['chest'], ['elevation frontale', 'front raises']],
  ['rear_delt_fly', 'Oiseau', 'Rear delt fly', ['shoulders'], ['traps', 'lats'], ['oiseau halteres', 'reverse fly', 'ecarte inverse', 'elevations buste penche', 'rear fly']],
  ['face_pull', 'Face pull', 'Face pull', ['shoulders', 'traps'], ['lats'], ['tirage visage', 'facepull']],
  ['upright_row', 'Tirage menton', 'Upright row', ['shoulders', 'traps'], ['biceps'], ['rowing menton', 'tirage vertical menton']],
  ['shrug', "Haussements d'épaules", 'Shrug', ['traps'], ['forearms'], ['haussement epaules', 'shrugs', 'haussements']],

  // --- Biceps / avant-bras
  ['biceps_curl', 'Curl biceps', 'Biceps curl', ['biceps'], ['forearms'], ['curl', 'curl barre', 'curl halteres', 'curl barre ez', 'bicep curl', 'barbell curl', 'dumbbell curl', 'curl poulie', 'curl incline', 'curl concentre', 'concentration curl']],
  ['hammer_curl', 'Curl marteau', 'Hammer curl', ['biceps', 'forearms'], [], ['marteau', 'hammer curls']],
  ['preacher_curl', 'Curl pupitre', 'Preacher curl', ['biceps'], [], ['pupitre', 'curl larry scott']],
  ['wrist_curl', 'Curl des poignets', 'Wrist curl', ['forearms'], [], ['curl poignets', 'flexion poignets', 'extension poignets', 'reverse wrist curl', 'pronation supination', 'flexion extension poignet']],

  // --- Triceps
  ['triceps_pushdown', 'Extension triceps à la poulie', 'Triceps pushdown', ['triceps'], [], ['pushdown', 'extension triceps poulie haute', 'triceps corde', 'triceps rope', 'pushdown corde']],
  ['skullcrusher', 'Barre au front', 'Skullcrusher', ['triceps'], [], ['skull crusher', 'extension couchee triceps', 'barre front', 'extension triceps allonge']],
  ['overhead_triceps', 'Extension triceps au-dessus de la tête', 'Overhead triceps extension', ['triceps'], [], ['french press', 'extension triceps nuque', 'extension triceps tete', 'extension triceps haltere']],
  ['triceps_kickback', 'Kickback triceps', 'Triceps kickback', ['triceps'], [], ['kickback haltere', 'extension triceps penche']],

  // --- Dos
  ['pull_up', 'Tractions', 'Pull-up', ['lats'], ['biceps', 'forearms', 'traps'], ['traction', 'pull up', 'pullup', 'chin up', 'chinup', 'tractions pronation', 'tractions supination', 'tractions lestees']],
  ['lat_pulldown', 'Tirage vertical', 'Lat pulldown', ['lats'], ['biceps', 'forearms'], ['tirage poitrine', 'tirage nuque', 'pulldown', 'tirage haut', 'tirage vertical poulie']],
  ['barbell_row', 'Rowing barre', 'Barbell row', ['lats', 'traps'], ['biceps', 'lowerBack', 'forearms', 'shoulders'], ['rowing', 'rowing penche', 'rowing haltere', 'rowing unilateral', 'dumbbell row', 'bent over row', 'tirage horizontal', 'tirage assis', 'seated row', 'cable row', 'tirage poulie basse', 't bar row', 'rowing t bar', 'rowing machine dos', 'tirage buste penche']],
  ['deadlift', 'Soulevé de terre', 'Deadlift', ['hamstrings', 'glutes', 'lowerBack'], ['traps', 'forearms', 'quads', 'lats'], ['souleve terre', 'souleve de terre barre', 'trap bar deadlift']],
  ['romanian_deadlift', 'Soulevé de terre roumain', 'Romanian deadlift', ['hamstrings', 'glutes'], ['lowerBack', 'forearms'], ['souleve de terre jambes tendues', 'rdl', 'jambes tendues', 'stiff leg deadlift', 'souleve terre roumain', 'souleve de terre roumain halteres']],
  ['good_morning', 'Good morning', 'Good morning', ['hamstrings', 'lowerBack'], ['glutes'], ['goodmorning']],
  ['back_extension', 'Extension lombaire', 'Back extension', ['lowerBack'], ['glutes', 'hamstrings'], ['hyperextension', 'hyper extension', 'lombaires banc romain', 'extensions lombaires', 'banc a lombaires']],
  ['superman', 'Superman', 'Superman', ['lowerBack'], ['glutes'], ['extension dorsale au sol']],

  // --- Jambes
  ['squat', 'Squat', 'Squat', ['quads', 'glutes'], ['hamstrings', 'lowerBack', 'adductors'], ['squat barre', 'back squat', 'squat arriere', 'squat halteres', 'squat poids du corps', 'bodyweight squat', 'air squat', 'squat smith', 'smith machine squat', 'hack squat', 'squat machine']],
  ['front_squat', 'Squat avant', 'Front squat', ['quads'], ['glutes', 'abs'], ['front squat barre']],
  ['goblet_squat', 'Squat gobelet', 'Goblet squat', ['quads', 'glutes'], ['abs'], ['goblet squat', 'squat kettlebell']],
  ['sumo_squat', 'Squat sumo', 'Sumo squat', ['adductors', 'glutes'], ['quads'], ['sumo squat']],
  ['bulgarian_split_squat', 'Squat bulgare', 'Bulgarian split squat', ['quads', 'glutes'], ['hamstrings', 'adductors'], ['fente bulgare', 'split squat', 'bulgarian squat', 'squat unilateral']],
  ['lunge', 'Fentes', 'Lunges', ['quads', 'glutes'], ['hamstrings', 'adductors'], ['fente', 'lunge', 'fentes marchees', 'walking lunge', 'fentes avant', 'fentes arriere', 'reverse lunge', 'fentes halteres']],
  ['leg_press', 'Presse à cuisses', 'Leg press', ['quads', 'glutes'], ['hamstrings', 'adductors'], ['presse cuisses', 'presse a cuisse', 'presse inclinee', 'presse horizontale']],
  ['leg_extension', 'Leg extension', 'Leg extension', ['quads'], [], ['extension jambes', 'extension quadriceps', 'extension de jambes']],
  ['leg_curl', 'Leg curl', 'Leg curl', ['hamstrings'], ['calves'], ['curl jambes', 'curl ischio', 'curl allonge', 'curl assis', 'curl ischio jambiers', 'hamstring curl']],
  ['hip_thrust', 'Hip thrust', 'Hip thrust', ['glutes'], ['hamstrings', 'quads'], ['poussee de hanches', 'pont fessier', 'glute bridge', 'hip thrust barre', 'pont']],
  ['glute_kickback', 'Kickback fessier', 'Glute kickback', ['glutes'], ['hamstrings'], ['donkey kick', 'cable kickback', 'kickback poulie', 'extension hanche poulie', 'fire hydrant']],
  ['step_up', 'Montée sur banc', 'Step-up', ['quads', 'glutes'], ['hamstrings'], ['montee banc', 'step up', 'montees sur marche', 'step down', 'descente marche', 'descente de marche', 'descente de step']],
  ['hip_abduction', 'Abduction des hanches', 'Hip abduction', ['glutes'], [], ['abduction', 'abducteurs', 'machine abducteurs', 'ecarte jambes machine', 'clamshell']],
  ['hip_adduction', 'Adduction des hanches', 'Hip adduction', ['adductors'], [], ['adduction', 'adducteurs', 'machine adducteurs', 'rapprochement jambes']],
  ['calf_raise', 'Mollets debout', 'Standing calf raise', ['calves'], [], ['mollets', 'releve de mollets', 'releves de mollets', 'calf raise', 'extension mollets', 'soleaire', 'mollets assis', 'seated calf raise', 'standing calf raise', 'mollets presse', 'donkey calf']],
  ['wall_sit', 'Chaise murale', 'Wall sit', ['quads'], ['glutes'], ['chaise', 'chaise au mur']],

  // --- Abdominaux
  ['crunch', 'Crunch', 'Crunch', ['abs'], ['obliques'], ['crunchs', 'abdos', 'releve de buste', 'releves de buste', 'sit up', 'situp', 'abdominaux', 'crunch machine', 'crunch incline']],
  ['leg_raise', 'Relevé de jambes', 'Leg raise', ['abs'], ['obliques', 'quads'], ['releves de jambes', 'hanging leg raise', 'releve de genoux', 'releves de genoux', 'knee raise', 'releve jambes suspendu', 'toes to bar']],
  ['plank', 'Gainage', 'Plank', ['abs'], ['obliques', 'shoulders', 'glutes', 'lowerBack'], ['planche', 'gainage ventral', 'gainage facial']],
  ['side_plank', 'Gainage latéral', 'Side plank', ['obliques'], ['abs', 'shoulders', 'glutes'], ['planche laterale', 'gainage cote']],
  ['russian_twist', 'Rotations russes', 'Russian twist', ['obliques'], ['abs'], ['russian twist', 'rotation russe', 'twist', 'rotation du buste', 'rotations du buste']],
  ['bicycle_crunch', 'Crunch vélo', 'Bicycle crunch', ['abs', 'obliques'], [], ['bicycle crunch', 'velo abdominal']],
  ['mountain_climber', 'Mountain climbers', 'Mountain climbers', ['abs'], ['quads', 'shoulders', 'obliques'], ['mountain climber', 'grimpeur', 'grimpeurs']],
  ['ab_wheel', 'Roue abdominale', 'Ab wheel rollout', ['abs'], ['shoulders', 'lats', 'lowerBack'], ['ab wheel', 'rollout', 'ab roller']],
  ['cable_crunch', 'Crunch à la poulie', 'Cable crunch', ['abs'], [], ['crunch poulie', 'crunch poulie haute']],
  ['wood_chop', 'Bûcheron', 'Wood chop', ['obliques', 'abs'], ['shoulders'], ['bucheron', 'wood chopper', 'woodchop', 'pallof press', 'rotation poulie']],

  // --- Corps entier, force explosive, cardio
  ['kettlebell_swing', 'Kettlebell swing', 'Kettlebell swing', ['glutes', 'hamstrings'], ['lowerBack', 'shoulders', 'abs'], ['swing kettlebell', 'swing', 'balancier kettlebell']],
  ['power_clean', 'Épaulé (power clean)', 'Power clean', ['hamstrings', 'glutes', 'traps'], ['quads', 'shoulders', 'forearms'], ['epaule jete', 'clean', 'hang clean', 'power clean', 'epaule power clean']],
  ['thruster', 'Thruster', 'Thruster', ['quads', 'shoulders'], ['glutes', 'triceps'], ['thrusters']],
  ['farmers_walk', 'Marche du fermier', 'Farmer’s walk', ['forearms', 'traps'], ['abs', 'quads', 'glutes'], ['farmer walk', 'farmers carry', 'marche fermier', 'farmer carry', 'suitcase carry', 'marche de valise', 'marche valise']],
  ['burpees', 'Burpees', 'Burpees', ['quads', 'chest', 'abs'], ['shoulders', 'triceps', 'glutes', 'hamstrings'], ['burpee']],
  ['jump_rope', 'Corde à sauter', 'Jump rope', ['calves'], ['shoulders', 'forearms', 'quads'], ['saut a la corde', 'skipping corde', 'jump rope']],
  ['jumping_jacks', 'Jumping jacks', 'Jumping jacks', ['calves', 'shoulders'], ['quads', 'glutes'], ['jumping jack', 'pompes sautees', 'sauts etoile']],
  ['running', 'Course à pied', 'Running', ['quads', 'hamstrings', 'calves', 'glutes'], ['abs'], ['course', 'footing', 'jogging', 'running', 'sprint', 'tapis de course', 'treadmill', 'fractionne']],
  ['cycling', 'Vélo', 'Cycling', ['quads'], ['glutes', 'hamstrings', 'calves'], ['velo', 'bike', 'spinning', 'cycling', 'velo stationnaire', 'assault bike']],
  ['rowing_machine', 'Rameur', 'Rowing machine', ['lats', 'quads'], ['hamstrings', 'biceps', 'lowerBack', 'glutes'], ['rameur', 'ergometre', 'rowing ergometre', 'concept2']],
  ['swimming', 'Natation', 'Swimming', ['lats', 'shoulders'], ['chest', 'triceps', 'abs'], ['nage', 'crawl', 'swimming']],
  ['walking', 'Marche', 'Walking', ['quads', 'calves'], ['glutes', 'hamstrings'], ['marche rapide', 'randonnee', 'walking', 'marche inclinee']],
  // --- Compléments
  ['landmine_press', 'Landmine press', 'Landmine press', ['shoulders', 'chest'], ['triceps'], ['developpe landmine']],
  ['handstand_push_up', 'Pompes en équilibre', 'Handstand push-up', ['shoulders'], ['triceps', 'traps'], ['pike push up', 'pompes pike', 'handstand pushup']],
  ['reverse_curl', 'Curl inversé', 'Reverse curl', ['forearms', 'biceps'], [], ['reverse curl', 'curl prise pronation']],
  ['inverted_row', 'Rowing inversé', 'Inverted row', ['lats'], ['biceps', 'traps', 'forearms'], ['tractions australiennes', 'australian pull up', 'rowing suspendu', 'trx row']],
  ['straight_arm_pulldown', 'Pull-over à la poulie', 'Straight-arm pulldown', ['lats'], ['triceps'], ['pullover poulie', 'cable pullover', 'tirage bras tendus']],
  ['rack_pull', 'Rack pull', 'Rack pull', ['traps', 'lowerBack'], ['glutes', 'hamstrings', 'forearms'], ['souleve de terre depuis les butees', 'souleve partiel']],
  ['sumo_deadlift', 'Soulevé de terre sumo', 'Sumo deadlift', ['glutes', 'adductors', 'hamstrings'], ['lowerBack', 'quads', 'traps'], ['souleve terre sumo']],
  ['pistol_squat', 'Squat pistol', 'Pistol squat', ['quads', 'glutes'], ['adductors', 'abs'], ['pistol', 'squat sur une jambe', 'single leg squat']],
  ['jump_squat', 'Squat sauté', 'Jump squat', ['quads', 'glutes'], ['calves', 'hamstrings'], ['squats sautes', 'squat saute', 'jumping squat', 'squats sautes']],
  ['box_jump', 'Saut sur box', 'Box jump', ['quads', 'glutes', 'calves'], ['hamstrings'], ['sauts sur box', 'box jumps', 'saut sur plyo box']],
  ['lateral_lunge', 'Fente latérale', 'Lateral lunge', ['adductors', 'glutes'], ['quads', 'hamstrings'], ['fentes laterales', 'side lunge', 'curtsy lunge', 'fente croisee', 'squat cosaque', 'cossack squat']],
  ['glute_ham_raise', 'Glute-ham raise', 'Glute-ham raise', ['hamstrings', 'glutes'], ['lowerBack', 'calves'], ['ghr', 'curl ischio banc']],
  ['reverse_hyper', 'Reverse hyper', 'Reverse hyper', ['glutes', 'lowerBack'], ['hamstrings'], ['hyperextension inversee']],
  ['dead_bug', 'Dead bug', 'Dead bug', ['abs'], ['obliques'], ['insecte mort']],
  ['bird_dog', 'Bird dog', 'Bird dog', ['lowerBack', 'glutes'], ['abs', 'shoulders'], ['chien oiseau', 'quadrupedie bras jambe']],
  ['hollow_hold', 'Hollow hold', 'Hollow hold', ['abs'], ['quads'], ['gainage hollow', 'position creuse', 'hollow body']],
  ['v_up', 'V-up', 'V-up', ['abs'], ['quads'], ['v up', 'canif', 'jackknife']],
  ['flutter_kicks', 'Ciseaux', 'Flutter kicks', ['abs'], ['quads'], ['ciseaux jambes', 'battements de jambes']],
  ['elliptical', 'Vélo elliptique', 'Elliptical trainer', ['quads', 'glutes'], ['hamstrings', 'calves', 'shoulders'], ['elliptique', 'elliptical', 'cross trainer']],
  ['stair_climber', 'Escalier', 'Stair climber', ['quads', 'glutes', 'calves'], ['hamstrings'], ['stairmaster', 'escaliers', 'montee escaliers', 'stepper']],
  ['sled_push', 'Poussée de traîneau', 'Sled push', ['quads', 'glutes'], ['calves', 'shoulders', 'abs'], ['traineau', 'sled', 'pousser traineau']],
  ['med_ball_slam', 'Slam ball', 'Medicine ball slam', ['abs', 'lats'], ['shoulders', 'triceps'], ['wall ball', 'medecine ball', 'slam']],
  ['battle_ropes', 'Cordes ondulatoires', 'Battle ropes', ['shoulders', 'forearms'], ['abs', 'biceps'], ['battle rope', 'corde ondulatoire']],
  // --- Prévention et préparation (ajoutés avec le programme « Genoux solides »)
  ['spanish_squat', 'Squat espagnol', 'Spanish squat', ['quads'], ['glutes'], ['squat espagnol isometrique', 'squat espagnol elastique', 'spanish squat isometrique']],
  ['nordic_curl', 'Nordic curl', 'Nordic hamstring curl', ['hamstrings'], ['glutes', 'calves'], ['nordic hamstring curl', 'nordic', 'nordic hamstring', 'curl nordique', 'nordic curl']],
  ['copenhagen_plank', 'Planche Copenhague', 'Copenhagen plank', ['adductors'], ['obliques', 'glutes', 'abs'], ['copenhague', 'copenhagen', 'planche copenhague', 'adduction copenhague']],
  ['external_rotation', "Rotation externe d'épaule", 'Shoulder external rotation', ['shoulders'], [], ['rotation externe', 'rotations externes', 'external rotation', 'rotation externe elastique', 'coiffe des rotateurs']],
  // Le devant du tibia n'a pas de zone à lui sur la silhouette : il est rattaché au bas de jambe (« mollets »).
  ['tibialis_raise', 'Relevé de pointe (tibialis)', 'Tibialis raise', ['calves'], [], ['releve de pointe', 'releves de pointes', 'tibialis', 'tibial anterieur', 'tib raise', 'toe raise tibialis']],
  ['plyometric_drills', 'Pliométrie et réceptions', 'Plyometric drills', ['quads', 'glutes', 'calves'], ['hamstrings', 'adductors'], ['pliometrie', 'plyometrics', 'plyo', 'pogo hops', 'pogo', 'snap down', 'snap downs', 'bonds lateraux', 'bond lateral', 'skater jumps', 'receptions']],
];

export const CATALOG: CatalogExercise[] = ENTRIES.map(([id, fr, en, primary, secondary, aliases = []]) => ({
  id,
  names: { fr, en },
  primary,
  secondary,
  aliases,
}));

const BY_ID = new Map(CATALOG.map((exercise) => [exercise.id, exercise]));

export function getCatalogExercise(id: string | null | undefined): CatalogExercise | null {
  return id ? (BY_ID.get(id) ?? null) : null;
}

// ---------------------------------------------------------------------------------------------
// Reconnaissance d'un nom d'exercice écrit librement ("Développé couché haltères", "Dumbbell row"…)
// ---------------------------------------------------------------------------------------------

const STOP_WORDS = new Set([
  'de', 'du', 'des', 'la', 'le', 'les', 'a', 'au', 'aux', 'en', 'sur', 'avec', 'un', 'une', 'et', 'ou', 'd', 'l',
  'the', 'with', 'of', 'to', 'on', 'and', 'or', 'an',
]);

/** Mots d'un nom, sans accents ni ponctuation ni pluriel simple, et sans mots vides. */
export function tokenize(name: string): string[] {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’']/g, ' ')
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 0 && !STOP_WORDS.has(word))
    .map((word) => (word.length > 2 && /[sx]$/.test(word) ? word.slice(0, -1) : word));
}

type Phrase = { tokens: string[]; exercise: CatalogExercise };

const PHRASES: Phrase[] = CATALOG.flatMap((exercise) =>
  [exercise.names.fr, exercise.names.en, ...exercise.aliases].map((text) => ({ tokens: tokenize(text), exercise })),
).filter((phrase) => phrase.tokens.length > 0);

/**
 * Exercice du répertoire qui correspond le mieux à un nom libre : l'appellation la plus longue
 * dont TOUS les mots se retrouvent dans le nom ("développé couché incliné haltères" → développé
 * incliné, pas développé couché). À égalité, celle qui laisse le moins de mots du nom inexpliqués.
 * Null si rien ne correspond (exercice inconnu : il n'apparaîtra pas dans la heatmap).
 */
export function matchExercise(name: string): CatalogExercise | null {
  const words = new Set(tokenize(name));
  if (words.size === 0) return null;

  let best: { exercise: CatalogExercise; length: number; extra: number } | null = null;
  for (const { tokens, exercise } of PHRASES) {
    if (!tokens.every((token) => words.has(token))) continue;
    const candidate = { exercise, length: tokens.length, extra: words.size - tokens.length };
    if (!best || candidate.length > best.length || (candidate.length === best.length && candidate.extra < best.extra)) {
      best = candidate;
    }
  }
  return best?.exercise ?? null;
}

/**
 * Exercice du répertoire pour une ligne de programme : l'identifiant donné par l'assistant IA s'il
 * existe dans le répertoire, sinon la reconnaissance du nom.
 */
export function resolveExercise(name: string, exerciseId?: string | null): CatalogExercise | null {
  return getCatalogExercise(exerciseId) ?? matchExercise(name);
}

/** Liste « identifiant — nom » du répertoire, dans la langue courante, pour le prompt de génération de programme. */
export function catalogForPrompt(): string {
  const language = getLanguage();
  return CATALOG.map((exercise) => `${exercise.id} — ${exercise.names[language]}`).join('\n');
}
