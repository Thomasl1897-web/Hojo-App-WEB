import { msg, t } from '@/i18n';
import { catalogForPrompt } from '@/lib/exercise-catalog';

export type Sex = 'homme' | 'femme';
export type FitnessLevel = 'debutant' | 'intermediaire' | 'avance';
export type SportObjective = 'force' | 'hypertrophie' | 'endurance' | 'perte_de_poids' | 'mobilite' | 'sante_generale';
export type TrainingLocation = 'maison' | 'salle_de_sport';
export type SportMode = 'fixe' | 'continu';

export const SEX_OPTIONS: { value: Sex; label: string }[] = [
  { value: 'homme', label: msg('Homme') },
  { value: 'femme', label: msg('Femme') },
];

export const FITNESS_LEVEL_OPTIONS: { value: FitnessLevel; label: string }[] = [
  { value: 'debutant', label: msg('Débutant') },
  { value: 'intermediaire', label: msg('Intermédiaire') },
  { value: 'avance', label: msg('Avancé') },
];

export const SPORT_OBJECTIVES: { value: SportObjective; label: string }[] = [
  { value: 'force', label: msg('Force') },
  { value: 'hypertrophie', label: msg('Prise de muscle (hypertrophie)') },
  { value: 'endurance', label: msg('Endurance') },
  { value: 'perte_de_poids', label: msg('Perte de poids') },
  { value: 'mobilite', label: msg('Mobilité / souplesse') },
  { value: 'sante_generale', label: msg('Santé générale') },
];

export const TRAINING_LOCATION_OPTIONS: { value: TrainingLocation; label: string }[] = [
  { value: 'maison', label: msg('À la maison') },
  { value: 'salle_de_sport', label: msg('En salle de sport') },
];

export const SPORT_MODE_OPTIONS: { value: SportMode; label: string; description: string }[] = [
  {
    value: 'fixe',
    label: msg('Séances fixes'),
    description: msg('Une séance précise à chaque jour de la semaine (ex: Push le lundi).'),
  },
  {
    value: 'continu',
    label: msg('Flux continu'),
    description: msg(
      "Un enchaînement de séances (ex: Push → Pull → Legs) qui avance seulement quand tu coches la précédente comme faite, peu importe le jour réel.",
    ),
  },
];

export const DAYS_PER_WEEK_OPTIONS = [2, 3, 4, 5, 6];

export const EQUIPMENT_OPTIONS = [
  msg('Poids du corps uniquement'),
  msg('Haltères'),
  msg('Barre + disques'),
  msg('Kettlebell'),
  msg('Élastiques'),
  msg('Banc'),
  msg('Rack / cage à squat'),
  msg('Machines de musculation'),
  msg('Vélo / rameur / tapis'),
] as const;

export type SportQuestionnaireAnswers = {
  age: string;
  sex: Sex | null;
  fitnessLevel: FitnessLevel;
  injuriesOrLimitations: string;

  objective: SportObjective;
  mode: SportMode;
  daysPerWeek: number;
  sessionDurationMinutes: string;
  location: TrainingLocation;
  equipment: string[];
  equipmentOther: string;

  preferredTime: string;
};

export const EMPTY_SPORT_QUESTIONNAIRE_ANSWERS: SportQuestionnaireAnswers = {
  age: '',
  sex: null,
  fitnessLevel: 'intermediaire',
  injuriesOrLimitations: '',

  objective: 'sante_generale',
  mode: 'fixe',
  daysPerWeek: 3,
  sessionDurationMinutes: '',
  location: 'salle_de_sport',
  equipment: [],
  equipmentOther: '',

  preferredTime: '18:00',
};

function label<T extends string | number>(options: { value: T; label: string }[], value: T): string {
  const found = options.find((option) => option.value === value)?.label;
  return found ? t(found) : String(value);
}

function getAgeYears(answers: SportQuestionnaireAnswers): number | null {
  const parsed = Number.parseInt(answers.age.trim(), 10);
  if (Number.isNaN(parsed) || parsed <= 0 || parsed > 120) return null;
  return parsed;
}

export function isMinor(answers: SportQuestionnaireAnswers): boolean {
  const age = getAgeYears(answers);
  return age !== null && age < 18;
}

function safetyInstructions(answers: SportQuestionnaireAnswers): string {
  const rules: string[] = [];
  const age = getAgeYears(answers);

  if (isMinor(answers)) {
    rules.push(
      t(
        "Cette personne a {age} ans, elle est donc MINEURE. Privilégie les charges légères à modérées, la technique avant la charge, PAS de tentative de charge maximale (1RM), et rappelle qu'un encadrement par un adulte ou un coach qualifié est recommandé pour la musculation chez les mineurs.",
        { age: age ?? '' },
      ),
    );
  }

  if (answers.injuriesOrLimitations.trim()) {
    rules.push(
      t(
        "Blessures / limitations déclarées : {injuries}. Évite ou adapte tout exercice qui solliciterait la zone concernée, et rappelle qu'un avis médical ou d'un kinésithérapeute est recommandé avant de reprendre une activité intense sur une zone blessée.",
        { injuries: answers.injuriesOrLimitations.trim() },
      ),
    );
  }

  rules.push(
    t(
      "Prévois un échauffement avant chaque séance et au moins une séance de repos dans le cycle (récupération musculaire). Écris l'échauffement et les étirements de fin comme des exercices dont le nom commence par « Échauffement » ou « Étirements » : l'app ne suit pas de charge pour ceux-là.",
    ),
    t('Progression graduelle des charges/volume, jamais de saut brutal.'),
    t("Précise dans chaque exercice si un signal d'alerte (douleur articulaire, vertige...) doit interrompre la séance."),
  );

  return `${t('CONTRAINTES DE SÉCURITÉ — elles priment sur toutes les préférences exprimées ci-dessus :')}\n${rules
    .map((rule) => `- ${rule}`)
    .join('\n')}`;
}

const EXERCISE_ID_RULE = msg(
  "- \"exerciseId\" : l'identifiant de l'exercice dans la liste ci-dessous quand il en fait partie (même mouvement, quelle que soit la variante d'équipement) ; omets ce champ pour un exercice qui n'y figure pas. Ne l'invente jamais. L'app s'en sert pour afficher les muscles travaillés.",
);

function jsonFormatInstructions(mode: SportMode): string {
  const shared = `${t(
    'IMPORTANT — FORMAT DE LIVRAISON : génère le résultat sous forme de FICHIER .json TÉLÉCHARGEABLE (nomme-le "plan-sport.json"). Si ton interface ne permet pas de produire un fichier téléchargeable, affiche le JSON complet dans un unique bloc de code.',
  )}\n\n${t('Le fichier doit contenir UNIQUEMENT du JSON valide, sans aucun texte avant ou après.')}`;

  const sessionName = JSON.stringify(t('Push (pectoraux, épaules, triceps)'));
  const benchPress = JSON.stringify(t('Développé couché haltères'));
  const benchNote = JSON.stringify(t('Contrôle la descente, 2s minimum'));
  const restName = JSON.stringify(t('Repos'));
  const programName = JSON.stringify(t('Nom court du programme'));

  if (mode === 'fixe') {
    return [
      `${shared} ${t('Respecte exactement cette structure ("mode": "fixe" — une séance par jour de semaine réel) :')}`,
      '',
      `{
  "type": "sport",
  "mode": "fixe",
  "name": ${programName},
  "preferredTime": "18:00",
  "days": [
    {
      "weekday": "lundi",
      "sessionName": ${sessionName},
      "isRestDay": false,
      "exercises": [
        { "name": ${benchPress}, "exerciseId": "bench_press", "sets": 4, "reps": "8-12", "restSeconds": 90, "note": ${benchNote} }
      ]
    },
    {
      "weekday": "mardi",
      "sessionName": ${restName},
      "isRestDay": true,
      "exercises": []
    }
  ]
}`,
      '',
      t('Règles strictes :'),
      t(
        '- "days" doit contenir EXACTEMENT les 7 jours de la semaine (lundi, mardi, mercredi, jeudi, vendredi, samedi, dimanche), chacun une seule fois, en minuscules',
      ),
      t(
        '- "preferredTime" (HH:MM) est l\'heure habituelle d\'entraînement, utilisée pour les rappels',
      ),
      t('- "isRestDay": true → "exercises" doit être un tableau VIDE. "isRestDay": false → au moins un exercice obligatoire'),
      t('- "sets" est un entier, "reps" est du texte libre ("8-12", "AMRAP", "30s"...), "restSeconds" est un entier en secondes'),
      t(EXERCISE_ID_RULE),
      t(
        '- Ne mets aucun commentaire ni texte hors du JSON, ne tronque jamais, n\'utilise pas de "..." : les 7 jours doivent être écrits en entier',
      ),
      t('- Rédige les noms de séances, les noms d\'exercices et les notes en français (les identifiants et les clés JSON, dont les noms de jours ci-dessus, ne changent pas).'),
      '',
      t("Identifiants d'exercices disponibles (identifiant — nom) :"),
      catalogForPrompt(),
    ].join('\n');
  }

  return [
    `${shared} ${t('Respecte exactement cette structure ("mode": "continu" — un enchaînement de séances, sans jour attitré) :')}`,
    '',
    `{
  "type": "sport",
  "mode": "continu",
  "name": ${programName},
  "preferredTime": "18:00",
  "sequence": [
    {
      "sessionName": ${sessionName},
      "isRestDay": false,
      "exercises": [
        { "name": ${benchPress}, "exerciseId": "bench_press", "sets": 4, "reps": "8-12", "restSeconds": 90, "note": ${benchNote} }
      ]
    },
    {
      "sessionName": ${JSON.stringify(t('Pull (dos, biceps)'))},
      "isRestDay": false,
      "exercises": [
        { "name": ${JSON.stringify(t('Tirage horizontal'))}, "exerciseId": "barbell_row", "sets": 4, "reps": "8-12", "restSeconds": 90 }
      ]
    },
    {
      "sessionName": ${JSON.stringify(t('Legs (jambes)'))},
      "isRestDay": false,
      "exercises": [
        { "name": ${JSON.stringify(t('Squat'))}, "exerciseId": "squat", "sets": 4, "reps": "6-10", "restSeconds": 120 }
      ]
    },
    {
      "sessionName": ${restName},
      "isRestDay": true,
      "exercises": []
    }
  ]
}`,
    '',
    t('Règles strictes :'),
    t(
      '- "sequence" est l\'ordre exact dans lequel les séances doivent s\'enchaîner (l\'app avance dans cet ordre à chaque séance cochée comme faite, peu importe le jour réel — n\'y mets PAS de jour de semaine)',
    ),
    t(
      '- "preferredTime" (HH:MM) reste utile pour l\'heure habituelle d\'entraînement, même si l\'app ne peut pas programmer de rappel daté à l\'avance dans ce mode',
    ),
    t('- "isRestDay": true → "exercises" doit être un tableau VIDE. "isRestDay": false → au moins un exercice obligatoire'),
    t('- "sets" est un entier, "reps" est du texte libre ("8-12", "AMRAP", "30s"...), "restSeconds" est un entier en secondes'),
    t(EXERCISE_ID_RULE),
    t(
      '- Ne mets aucun commentaire ni texte hors du JSON, ne tronque jamais, n\'utilise pas de "..." : l\'enchaînement complet doit être écrit en entier',
    ),
    t('- Rédige les noms de séances, les noms d\'exercices et les notes en français (les identifiants et les clés JSON ne changent pas).'),
    '',
    t("Identifiants d'exercices disponibles (identifiant — nom) :"),
    catalogForPrompt(),
  ].join('\n');
}

/** Prompt générique à compléter soi-même (sans questionnaire). */
export function sportGenericPrompt(): string {
  return [
    t(
      "Tu es un coach sportif. Crée-moi un programme d'entraînement en séances fixes (une séance par jour de la semaine, qui se répète ensuite à l'identique) adapté à mes objectifs [DÉCRIS ICI TON NIVEAU, TON OBJECTIF, LE MATÉRIEL DISPONIBLE, LE NOMBRE DE JOURS PAR SEMAINE, ETC.].",
    ),
    '',
    t('CONTRAINTES DE SÉCURITÉ — elles priment sur toutes les préférences exprimées ci-dessus :'),
    t(
      "- Si mineur (moins de 18 ans) : charges légères à modérées, technique avant la charge, pas de charge maximale (1RM), encadrement recommandé.",
    ),
    t(
      "- Prévois un échauffement avant chaque séance et au moins un jour de repos complet par semaine. Écris l'échauffement et les étirements de fin comme des exercices dont le nom commence par « Échauffement » ou « Étirements » : l'app ne suit pas de charge pour ceux-là.",
    ),
    t('- Progression graduelle, jamais de saut brutal de charge/volume.'),
    '',
    jsonFormatInstructions('fixe'),
  ].join('\n');
}

export function buildSportPrompt(answers: SportQuestionnaireAnswers): string {
  const paragraphs: string[] = [];

  const profileParts: string[] = [];
  if (answers.age.trim()) profileParts.push(t('{age} ans', { age: answers.age.trim() }));
  if (answers.sex) profileParts.push(label(SEX_OPTIONS, answers.sex).toLowerCase());
  const profileText = profileParts.length ? t(' pour une personne de {profile}', { profile: profileParts.join(', ') }) : '';

  const modeText =
    answers.mode === 'fixe'
      ? t("en séances fixes (une séance précise par jour de la semaine, qui se répète ensuite à l'identique)")
      : t(
          'en flux continu (un enchaînement de séances qui avance seulement quand je coche la précédente comme faite, indépendamment du jour réel — par exemple Push → Pull → Legs → Repos, peu importe si je fais Push un jeudi et Pull le dimanche suivant)',
        );

  paragraphs.push(
    t("Tu es un coach sportif expérimenté. Construis-moi un programme d'entraînement {mode}{profile}, de niveau {level}.", {
      mode: modeText,
      profile: profileText,
      level: label(FITNESS_LEVEL_OPTIONS, answers.fitnessLevel).toLowerCase(),
    }),
  );

  paragraphs.push(
    t("Mon objectif principal est : {objective}. Je veux m'entraîner {days} jours par semaine", {
      objective: label(SPORT_OBJECTIVES, answers.objective).toLowerCase(),
      days: answers.daysPerWeek,
    }) +
      (answers.sessionDurationMinutes.trim()
        ? t(", avec des séances d'environ {minutes} minutes", { minutes: answers.sessionDurationMinutes.trim() })
        : '') +
      t(". Je m'entraîne {location}.", { location: label(TRAINING_LOCATION_OPTIONS, answers.location).toLowerCase() }),
  );

  const equipmentList = [
    ...answers.equipment.map((item) => t(item)),
    ...(answers.equipmentOther.trim() ? [answers.equipmentOther.trim()] : []),
  ];
  if (equipmentList.length) {
    paragraphs.push(t('Matériel disponible : {list}.', { list: equipmentList.join(', ') }));
  }

  paragraphs.push(t("Heure habituelle d'entraînement : {time}.", { time: answers.preferredTime }));

  return `${paragraphs.join('\n\n')}\n\n${safetyInstructions(answers)}\n\n${jsonFormatInstructions(answers.mode)}`;
}
