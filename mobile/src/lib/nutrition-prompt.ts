import { msg, t, tp } from '@/i18n';
import { weekdayName } from '@/lib/date';
import type { CycleLength, Weekday } from '@/lib/nutrition-schema';

export type Sex = 'homme' | 'femme';
export type ActivityLevel = 'sedentaire' | 'leger' | 'modere' | 'intense';
export type CalorieStrategy = 'jours_fixes' | 'ajustement_snacks';
export type DietType = 'omnivore' | 'vegetarien' | 'vegan' | 'pescetarien' | 'sans_porc';
export type FastingMode = 'aucun' | 'jeune_16_8' | 'jeune_autre';
export type NutrientFocus = 'macros_uniquement' | 'macros_et_micros';
export type CookingStyle = 'quotidien' | 'meal_prep';

export type NutritionObjective =
  | 'perte_de_poids'
  | 'prise_de_masse'
  | 'recomposition'
  | 'maintien'
  | 'sante_generale';

export const NUTRITION_OBJECTIVES: { value: NutritionObjective; label: string }[] = [
  { value: 'perte_de_poids', label: msg('Perte de poids') },
  { value: 'prise_de_masse', label: msg('Prise de masse') },
  { value: 'recomposition', label: msg('Rééquilibrage (perdre du gras + prendre du muscle)') },
  { value: 'maintien', label: msg('Maintien du poids') },
  { value: 'sante_generale', label: msg('Santé générale') },
];

export const SEX_OPTIONS: { value: Sex; label: string }[] = [
  { value: 'homme', label: msg('Homme') },
  { value: 'femme', label: msg('Femme') },
];

export const ACTIVITY_LEVEL_OPTIONS: { value: ActivityLevel; label: string }[] = [
  { value: 'sedentaire', label: msg('Sédentaire (peu ou pas de sport)') },
  { value: 'leger', label: msg('Léger (1 à 2 séances/semaine)') },
  { value: 'modere', label: msg('Modéré (3 à 4 séances/semaine)') },
  { value: 'intense', label: msg('Intense (5+ séances/semaine ou métier physique)') },
];

export const CALORIE_STRATEGY_OPTIONS: { value: CalorieStrategy; label: string }[] = [
  { value: 'jours_fixes', label: msg('Jours caloriques fixes (activité stable)') },
  { value: 'ajustement_snacks', label: msg('Ajuster via les collations selon l\'activité du jour') },
];

export const DIET_TYPE_OPTIONS: { value: DietType; label: string }[] = [
  { value: 'omnivore', label: msg('Omnivore') },
  { value: 'vegetarien', label: msg('Végétarien') },
  { value: 'vegan', label: msg('Végan') },
  { value: 'pescetarien', label: msg('Pescétarien') },
  { value: 'sans_porc', label: msg('Sans porc') },
];

export const FASTING_MODE_OPTIONS: { value: FastingMode; label: string }[] = [
  { value: 'aucun', label: msg('Pas de jeûne') },
  { value: 'jeune_16_8', label: msg('Jeûne intermittent 16:8') },
  { value: 'jeune_autre', label: msg('Autre jeûne (précisé ci-dessous)') },
];

export const NUTRIENT_FOCUS_OPTIONS: { value: NutrientFocus; label: string }[] = [
  { value: 'macros_uniquement', label: msg('Macros uniquement') },
  { value: 'macros_et_micros', label: msg('Macros + micronutriments (vitamines, minéraux)') },
];

export const COOKING_STYLE_OPTIONS: { value: CookingStyle; label: string }[] = [
  { value: 'quotidien', label: msg('Cuisiner chaque jour') },
  { value: 'meal_prep', label: msg('Meal-prep (cuisiner en lot à l\'avance)') },
];

export type CookingSkill = 'debutant' | 'intermediaire' | 'confirme';

export const COOKING_SKILL_OPTIONS: { value: CookingSkill; label: string }[] = [
  { value: 'debutant', label: msg('Débutant (recettes très simples)') },
  { value: 'intermediaire', label: msg('Intermédiaire') },
  { value: 'confirme', label: msg('Confirmé (techniques plus avancées)') },
];

/**
 * Cible protéique en g/kg de poids corporel selon l'objectif. En déficit ou en
 * recomposition, un apport protéique élevé limite la perte de masse musculaire.
 */
const PROTEIN_TARGET_BY_OBJECTIVE: Record<NutritionObjective, string> = {
  perte_de_poids: msg('1,8 à 2,2 g de protéines par kg de poids corporel'),
  prise_de_masse: msg('1,6 à 2,2 g de protéines par kg de poids corporel'),
  recomposition: msg('1,8 à 2,2 g de protéines par kg de poids corporel'),
  maintien: msg('1,2 à 1,6 g de protéines par kg de poids corporel'),
  sante_generale: msg('1,2 à 1,6 g de protéines par kg de poids corporel'),
};

export const CYCLE_LENGTH_OPTIONS: { value: CycleLength; label: string }[] = [
  { value: 7, label: msg('7 jours') },
  { value: 14, label: msg('14 jours') },
];

export const MAIN_MEALS_PER_DAY_OPTIONS = [2, 3, 4, 5];
export const SNACKS_PER_DAY_OPTIONS = [0, 1, 2, 3];

export const KITCHEN_EQUIPMENT_OPTIONS = [
  msg('Four'),
  msg('Micro-ondes'),
  msg('Plaques de cuisson'),
  msg('Mixeur / Blender'),
  msg('Robot culinaire'),
  msg('Autocuiseur / Multicuiseur'),
  msg('Friteuse à air'),
  msg('Grille-pain'),
  msg('Barbecue'),
] as const;

export type PregnancyStatus = 'aucune' | 'enceinte' | 'allaitante';

export const PREGNANCY_STATUS_OPTIONS: { value: PregnancyStatus; label: string }[] = [
  { value: 'aucune', label: msg('Non concerné') },
  { value: 'enceinte', label: msg('Enceinte') },
  { value: 'allaitante', label: msg('Allaitante') },
];

/** Seuils bas usuels pour un adulte sans suivi médical, par sexe. */
export const MIN_DAILY_CALORIES_BY_SEX: Record<Sex, number> = {
  femme: 1200,
  homme: 1500,
};

export type NutritionQuestionnaireAnswers = {
  // Profil
  age: string;
  sex: Sex | null;
  weightKg: string;
  heightCm: string;
  country: string;

  // Santé & sécurité
  medicalConditions: string;
  pregnancyStatus: PregnancyStatus;

  // Objectif & activité
  objective: NutritionObjective;
  activityLevel: ActivityLevel;
  calorieStrategy: CalorieStrategy;

  // Régime alimentaire
  dietType: DietType;
  fastingMode: FastingMode;
  nutrientFocus: NutrientFocus;
  restrictions: string;
  dislikedFoods: string;
  preferences: string;

  // Organisation
  cycleLengthDays: CycleLength;
  groceryDay: Weekday | null;
  groceryBudget: string;
  cookingStyle: CookingStyle;
  cookingSkill: CookingSkill;
  kitchenEquipment: string[];
  kitchenEquipmentOther: string;

  // Repas & flexibilité
  mainMealsPerDay: number;
  snacksPerDay: number;
  breakfastPrepTime: string;
  generalPrepTime: string;
  leftoverDays: Weekday[];
  wantsLunchLeftoversNextDay: boolean;
  flexMealDays: Weekday[];
};

export const EMPTY_QUESTIONNAIRE_ANSWERS: NutritionQuestionnaireAnswers = {
  age: '',
  sex: null,
  weightKg: '',
  heightCm: '',
  country: '',

  medicalConditions: '',
  pregnancyStatus: 'aucune',

  objective: 'sante_generale',
  activityLevel: 'modere',
  calorieStrategy: 'jours_fixes',

  dietType: 'omnivore',
  fastingMode: 'aucun',
  nutrientFocus: 'macros_uniquement',
  restrictions: '',
  dislikedFoods: '',
  preferences: '',

  cycleLengthDays: 7,
  groceryDay: null,
  groceryBudget: '',
  cookingStyle: 'quotidien',
  cookingSkill: 'intermediaire',
  kitchenEquipment: [],
  kitchenEquipmentOther: '',

  mainMealsPerDay: 3,
  snacksPerDay: 0,
  breakfastPrepTime: '',
  generalPrepTime: '',
  leftoverDays: [],
  wantsLunchLeftoversNextDay: false,
  flexMealDays: [],
};

function label<T extends string | number>(options: { value: T; label: string }[], value: T): string {
  const found = options.find((option) => option.value === value)?.label;
  return found ? t(found) : String(value);
}

function formatDayList(days: Weekday[]): string {
  return days
    .map((day) => {
      const name = weekdayName(day);
      return name.charAt(0).toUpperCase() + name.slice(1);
    })
    .join(', ');
}

/** Âge en années si saisi et exploitable, sinon null. */
export function getAgeYears(answers: NutritionQuestionnaireAnswers): number | null {
  const parsed = Number.parseInt(answers.age.trim(), 10);
  if (Number.isNaN(parsed) || parsed <= 0 || parsed > 120) return null;
  return parsed;
}

export function isMinor(answers: NutritionQuestionnaireAnswers): boolean {
  const age = getAgeYears(answers);
  return age !== null && age < 18;
}

/**
 * Contraintes de sécurité injectées dans le prompt. Elles priment sur les préférences de
 * l'utilisateur : un LLM sollicité pour "perdre du poids vite" peut sinon proposer des
 * apports dangereusement bas, et l'app relaierait ça en rappels quotidiens.
 */
function safetyInstructions(answers: NutritionQuestionnaireAnswers): string {
  const rules: string[] = [];
  const age = getAgeYears(answers);

  if (isMinor(answers)) {
    rules.push(
      t(
        "Cette personne a {age} ans, elle est donc MINEURE et en période de croissance. N'applique AUCUN déficit calorique et AUCUNE restriction : les apports doivent couvrir intégralement les besoins de croissance, d'activité et de développement.",
        { age: age ?? '' },
      ),
      t(
        'Même si un objectif de perte de poids est mentionné plus haut, ignore toute logique de restriction : construis un plan équilibré et suffisant, et indique dans "name" ou dès la première ligne qu\'un suivi par un médecin ou un diététicien-nutritionniste est indispensable avant toute démarche de perte de poids à cet âge.',
      ),
    );
  } else {
    const floor = answers.sex ? MIN_DAILY_CALORIES_BY_SEX[answers.sex] : 1500;
    const floorExplanation = answers.sex
      ? t('{floor} kcal/jour', { floor })
      : t("1500 kcal/jour (seuil prudent retenu car le sexe n'est pas précisé)");
    rules.push(
      t("L'apport calorique quotidien ne doit JAMAIS descendre en dessous de {floor}, quel que soit l'objectif affiché.", {
        floor: floorExplanation,
      }),
      t(
        "Si l'objectif est une perte de poids, limite le déficit à environ 300-500 kcal sous les besoins d'entretien (perte visée : 0,5 à 1 % du poids corporel par semaine maximum). Ne propose jamais de régime très basse calorie.",
      ),
    );
  }

  if (answers.pregnancyStatus !== 'aucune') {
    rules.push(
      t(
        "Cette personne est {status} : les besoins énergétiques et en micronutriments (fer, folates, iode, calcium, oméga 3) sont majorés, et certains aliments sont à proscrire (poissons crus, fromages au lait cru, charcuterie crue, alcool). Aucun déficit calorique n'est acceptable. Rappelle qu'un suivi médical est nécessaire.",
        { status: label(PREGNANCY_STATUS_OPTIONS, answers.pregnancyStatus).toLowerCase() },
      ),
    );
  }

  if (answers.medicalConditions.trim()) {
    rules.push(
      t(
        "Problèmes de santé / traitements déclarés : {conditions}. Adapte le plan en conséquence, signale explicitement les points qui nécessitent l'avis d'un professionnel de santé, et n'invente pas de recommandation thérapeutique.",
        { conditions: answers.medicalConditions.trim() },
      ),
    );
  }

  rules.push(
    t(
      "Ce plan est un support d'organisation, pas une prescription médicale : il doit rester nutritionnellement équilibré et couvrir les besoins en protéines, lipides essentiels, fibres et micronutriments. En cas de doute, privilégie toujours la sécurité à la performance.",
    ),
  );

  return `${t('CONTRAINTES DE SÉCURITÉ — elles priment sur toutes les préférences exprimées ci-dessus :')}\n${rules
    .map((rule) => `- ${rule}`)
    .join('\n')}`;
}

/**
 * Exemple de réponse attendue, inclus dans le prompt. Les noms et les étapes sont dans la langue
 * de l'app (le modèle les imite) ; les identifiants (catégories, clés) ne changent jamais.
 */
export function exampleJson(): string {
  return `{
  "type": "nutrition",
  "name": ${JSON.stringify(t('Nom court du plan'))},
  "cycleLengthDays": 7,
  "meta": { "baseDayKcal": 2100 },

  "foods": [
    { "id": "avoine", "name": ${JSON.stringify(t("Flocons d'avoine"))}, "category": "feculent", "kcal100": 375, "protein100": 13, "carbs100": 60, "fat100": 7, "fiber100": 10, "soldBy": "weight" },
    { "id": "lait_demi_ecreme", "name": ${JSON.stringify(t('Lait demi-écrémé'))}, "category": "produit_laitier", "kcal100": 46, "protein100": 3.3, "carbs100": 4.8, "fat100": 1.6, "fiber100": 0, "soldBy": "weight" },
    { "id": "oeuf", "name": ${JSON.stringify(t('Œuf'))}, "category": "proteine", "kcal100": 155, "protein100": 13, "carbs100": 1.1, "fat100": 11, "fiber100": 0, "soldBy": "unit", "unitSizeG": 58 },
    { "id": "poulet_blanc", "name": ${JSON.stringify(t('Blanc de poulet'))}, "category": "proteine", "kcal100": 165, "protein100": 31, "carbs100": 0, "fat100": 3.6, "fiber100": 0, "soldBy": "weight" },
    { "id": "riz_basmati", "name": ${JSON.stringify(t('Riz basmati cru'))}, "category": "feculent", "kcal100": 350, "protein100": 7.5, "carbs100": 77, "fat100": 0.6, "fiber100": 1.3, "soldBy": "weight" },
    { "id": "brocoli", "name": ${JSON.stringify(t('Brocoli'))}, "category": "legume", "kcal100": 34, "protein100": 2.8, "carbs100": 7, "fat100": 0.4, "fiber100": 2.6, "soldBy": "weight" },
    { "id": "huile_olive", "name": ${JSON.stringify(t("Huile d'olive"))}, "category": "matiere_grasse", "kcal100": 884, "protein100": 0, "carbs100": 0, "fat100": 100, "fiber100": 0, "soldBy": "weight" }
  ],

  "singles": [
    {
      "id": "pdj_avoine",
      "name": ${JSON.stringify(t('Porridge avoine-lait'))},
      "ingredients": [
        { "foodId": "avoine", "grams": 60 },
        { "foodId": "lait_demi_ecreme", "grams": 250 }
      ],
      "steps": [
        ${JSON.stringify(t("Verse l'avoine et le lait dans une casserole."))},
        ${JSON.stringify(t("Chauffe 4 à 5 minutes à feu moyen en remuant, jusqu'à épaississement."))}
      ],
      "calories": 340, "protein": 16.1, "carbs": 48, "fat": 8.2, "fiber": 6
    }
  ],

  "batches": [
    {
      "id": "poulet_riz_brocoli",
      "name": ${JSON.stringify(t('Poulet, riz et brocoli'))},
      "portions": 2,
      "cookDay": 1,
      "ingredients": [
        { "foodId": "poulet_blanc", "grams": 400 },
        { "foodId": "riz_basmati", "grams": 200 },
        { "foodId": "brocoli", "grams": 300 },
        { "foodId": "huile_olive", "grams": 20 }
      ],
      "steps": [
        ${JSON.stringify(t('Fais cuire le riz selon les indications du paquet.'))},
        ${JSON.stringify(t("Coupe le poulet en dés et fais-le dorer 8 minutes dans l'huile d'olive."))},
        ${JSON.stringify(t('Ajoute le brocoli en petits bouquets, couvre et laisse cuire 6 minutes.'))},
        ${JSON.stringify(t('Mélange avec le riz et répartis en 2 portions égales.'))}
      ],
      "calories": 819.4, "protein": 73.7, "carbs": 87.5, "fat": 18.4, "fiber": 5.2
    }
  ],

  "days": [
    {
      "day": 1,
      "totals": { "calories": 1159.4, "protein": 89.8, "carbs": 135.5, "fat": 26.6, "fiber": 11.2 },
      "meals": [
        { "name": ${JSON.stringify(t('Petit-déjeuner'))}, "time": "08:00", "ref": "pdj_avoine" },
        { "name": ${JSON.stringify(t('Déjeuner'))}, "time": "12:30", "ref": "poulet_riz_brocoli", "portionIndex": 1 }
      ]
    },
    {
      "day": 2,
      "totals": { "calories": 1159.4, "protein": 89.8, "carbs": 135.5, "fat": 26.6, "fiber": 11.2 },
      "meals": [
        { "name": ${JSON.stringify(t('Petit-déjeuner'))}, "time": "08:00", "ref": "pdj_avoine" },
        { "name": ${JSON.stringify(t('Déjeuner'))}, "time": "12:30", "ref": "poulet_riz_brocoli", "portionIndex": 2 }
      ]
    }
  ],

  "courses": [
    {
      "week": 1,
      "items": [
        { "foodId": "avoine", "grams": 120, "isPantry": true, "needsFreezing": false },
        { "foodId": "lait_demi_ecreme", "grams": 500, "isPantry": false, "needsFreezing": false },
        { "foodId": "poulet_blanc", "grams": 400, "isPantry": false, "needsFreezing": false },
        { "foodId": "riz_basmati", "grams": 200, "isPantry": true, "needsFreezing": false },
        { "foodId": "brocoli", "grams": 300, "isPantry": false, "needsFreezing": false },
        { "foodId": "huile_olive", "grams": 20, "isPantry": true, "needsFreezing": false }
      ]
    }
  ]
}`;
}

function jsonFormatInstructions(cycleLengthDays: CycleLength): string {
  const days = cycleLengthDays;
  return [
    t(
      'IMPORTANT — FORMAT DE LIVRAISON : génère le résultat sous forme de FICHIER .json TÉLÉCHARGEABLE (nomme-le "plan-nutrition.json"). Le plan est trop volumineux pour être copié-collé depuis la fenêtre de chat. Si ton interface ne permet pas de produire un fichier téléchargeable, affiche alors le JSON complet dans un unique bloc de code.',
    ),
    '',
    t(
      'Le fichier doit contenir UNIQUEMENT du JSON valide, sans aucun texte avant ou après. Voici la structure EXACTE attendue, avec un exemple complet sur 2 jours (ton plan devra en couvrir {days}) :',
      { days },
    ),
    '',
    exampleJson(),
    '',
    t('STRUCTURE (chaque section est obligatoire, même vide) :'),
    t('- "meta.baseDayKcal" : apport calorique de référence du plan (nombre)'),
    t(
      '- "foods" : TOUS les aliments utilisés par le plan, chacun avec un "id" unique (slug court, ex: "riz_basmati"), une "category" parmi feculent / proteine / legume / fruit / produit_laitier / matiere_grasse / liant_structurel / epice_ou_bouillon / autre, et CINQ valeurs numériques pour 100g : kcal100, protein100, carbs100, fat100, fiber100. "soldBy" vaut "weight" (vendu au poids) ou "unit" (vendu à l\'unité, ex: œuf, pot de yaourt) — dans ce cas "unitSizeG" (grammes par unité) est obligatoire.',
    ),
    t(
      '- "singles" : plats cuisinés et mangés en une seule fois. Chacun a un "id" unique, un "name", une liste "ingredients" (foodId + grams, EN GRAMMES, pour CETTE portion), et les macros DÉCLARÉES de cette portion (calories/protein/carbs/fat/fiber). Ajoute aussi "steps" : la RECETTE, sous forme de liste de phrases courtes et claires, une par étape de préparation, dans l\'ordre (3 à 8 étapes, avec temps de cuisson et températures si utile).',
    ),
    t(
      '- "batches" : plats cuisinés EN UNE FOIS puis mangés sur plusieurs repas ("portions" >= 2). "ingredients" représente la quantité TOTALE cuisinée (toutes les portions ensemble), mais les macros déclarées (calories/protein/carbs/fat/fiber) sont pour UNE SEULE portion (donc environ ingredients÷portions). "cookDay" est le jour du cycle où le plat est cuisiné. Ajoute aussi "steps" : la recette complète du lot (liste de phrases courtes, une par étape, dans l\'ordre), avec en dernière étape le partage en portions et les conseils de conservation (frigo/congélateur).',
    ),
    t(
      '- "days" : un objet par jour du cycle (1 à {days}, chaque numéro exactement une fois). "totals" = somme exacte des macros de tous les repas du jour (calcule-la, ne l\'arrondis pas au hasard). Chaque repas dans "meals" a un "name" (le CRÉNEAU : "Petit-déjeuner", "Déjeuner", "Collation 1"...), une "time" (HH:MM), et soit :',
      { days },
    ),
    t(
      '  (a) "ref" = l\'id d\'une recette dans "singles" ou "batches" — si c\'est un batch, ajoute "portionIndex" (1, 2, 3... quelle portion est mangée ce jour-là) ;',
    ),
    t(
      '  (b) pas de "ref" du tout, pour un repas hors-cycle (resto, repas libre, imprévu) — utilise "freeNote" pour le décrire, et n\'ajoute AUCUN ingrédient nulle part pour ce repas.',
    ),
    t(
      '- "courses" : liste de courses groupée par semaine (semaine 1 = jours 1-7, semaine 2 = jours 8-14 s\'il y a lieu). Pour CHAQUE aliment utilisé par au moins une recette référencée, indique la quantité totale à acheter pour TOUT le cycle en UNE SEULE semaine (celle où tu commences à l\'utiliser) : "grams" si soldBy="weight", "units" (entier) si soldBy="unit". "isPantry": true pour les produits de garde-manager achetés une fois pour tout le cycle (huile, épices, riz sec...). "needsFreezing": true si le produit doit être congelé en attendant d\'être utilisé plus tard dans le cycle.',
    ),
    '',
    t("RÈGLES D'EXACTITUDE (vérifiées automatiquement à l'import — l'app REFUSE le plan si l'une d'elles est violée) :"),
    t(
      '- Les macros déclarées d\'une recette doivent correspondre à ses ingrédients × les valeurs de "foods" (tolérance 3%). Fais le calcul, ne devine pas de valeurs rondes.',
    ),
    t('- "totals" d\'un jour = somme exacte des macros des repas de ce jour (recette entière si single, macros par portion si batch).'),
    t('- Chaque ingrédient cité dans une recette doit exister dans "foods".'),
    t('- Chaque "ref" doit exister dans "singles" ou "batches".'),
    t(
      '- Pour un batch : les "portionIndex" utilisés dans "days" doivent être exactement 1, 2, ..., "portions" (chacun une fois, sans trou ni doublon), et la portion 1 doit être mangée le jour "cookDay".',
    ),
    t(
      '- La liste de courses doit couvrir EXACTEMENT les ingrédients nécessaires (ni plus, ni moins) : chaque gramme utilisé par une recette référencée doit apparaître une fois dans "courses" (arrondi à l\'unité supérieure pour les aliments vendus à l\'unité). N\'ajoute rien qui ne sert à aucune recette. Un produit de garde-manger n\'apparaît que dans une seule semaine.',
    ),
    t(
      '- Quantités par ingrédient : jamais nulles/négatives, jamais sous 2g (sauf épices et bouillon), et dans une fourchette réaliste pour son rôle (ex: un féculent en base de repas entre 30g et 300g — pas 3g de riz, pas 900g de beurre ; une poudre de protéines se dose de 15g à 40g par prise).',
    ),
    t(
      '- Pour les aliments vendus à l\'unité (soldBy="unit"), les quantités dans les recettes doivent être des multiples entiers de "unitSizeG" (ex: des œufs entiers, pas 0,3 œuf).',
    ),
    '',
    t('RÈGLES GÉNÉRALES :'),
    t("- Le plan couvre un cycle de {days} jours qui se répète ensuite à l'identique (PAS un jour de la semaine)", { days }),
    t('- Privilégie des produits courants et de saison, disponibles en supermarché'),
    t('- Les restes ne doivent jamais être consommés plus de 48h après leur préparation'),
    t('- Ne mets aucun commentaire ni texte hors du JSON'),
    t(
      '- Ne tronque jamais le plan et n\'utilise pas de "..." : les {days} jours, toutes les recettes et toutes les semaines de courses doivent être écrits en entier dans le fichier',
      { days },
    ),
    t('- Rédige tous les noms, toutes les étapes et toutes les notes du plan en français (les identifiants et les clés JSON ne changent pas).'),
  ].join('\n');
}

/** Prompt générique à compléter soi-même (sans questionnaire). */
export function nutritionGenericPrompt(): string {
  return [
    t(
      "Tu es un nutritionniste. Crée-moi un plan nutritionnel sur un cycle de 7 jours (qui se répète ensuite à l'identique) adapté à mes objectifs [DÉCRIS ICI TES OBJECTIFS, CONTRAINTES, ALLERGIES, NOMBRE DE REPAS PAR JOUR, ETC.].",
    ),
    '',
    t('CONTRAINTES DE SÉCURITÉ — elles priment sur toutes les préférences exprimées ci-dessus :'),
    t(
      "- L'apport calorique quotidien ne doit JAMAIS descendre en dessous de 1200 kcal/jour pour une femme, 1500 kcal/jour pour un homme, quel que soit l'objectif affiché.",
    ),
    t(
      "- S'il s'agit d'une personne mineure (moins de 18 ans), n'applique AUCUN déficit calorique : les apports doivent couvrir intégralement les besoins de croissance, et un suivi médical est indispensable avant toute démarche de perte de poids.",
    ),
    t(
      "- En cas de grossesse, d'allaitement, de problème de santé ou de traitement en cours, adapte le plan et signale explicitement qu'un avis médical est nécessaire.",
    ),
    t(
      "- Si l'objectif est une perte de poids, limite le déficit à environ 300-500 kcal sous les besoins d'entretien. Ne propose jamais de régime très basse calorie.",
    ),
    t('- Le plan doit rester nutritionnellement équilibré (protéines, lipides essentiels, fibres, micronutriments).'),
    '',
    jsonFormatInstructions(7),
  ].join('\n');
}

export function buildNutritionPrompt(answers: NutritionQuestionnaireAnswers): string {
  const paragraphs: string[] = [];

  // Intro : profil
  const profileParts: string[] = [];
  if (answers.age.trim()) profileParts.push(t('{age} ans', { age: answers.age.trim() }));
  if (answers.sex) profileParts.push(label(SEX_OPTIONS, answers.sex).toLowerCase());
  if (answers.weightKg.trim()) profileParts.push(`${answers.weightKg.trim()} kg`);
  if (answers.heightCm.trim()) profileParts.push(`${answers.heightCm.trim()} cm`);
  const profileText = profileParts.length ? t(' pour une personne de {profile}', { profile: profileParts.join(', ') }) : '';
  const countryText = answers.country.trim() ? t(', basée en {country}', { country: answers.country.trim() }) : '';
  paragraphs.push(
    t(
      "Tu es un nutritionniste expérimenté. Construis-moi un plan alimentaire sur un cycle de {days} jours (le cycle se répète ensuite à l'identique){profile}{country}.",
      { days: answers.cycleLengthDays, profile: profileText, country: countryText },
    ),
  );

  // Objectif & activité
  const calorieStrategySentence =
    answers.calorieStrategy === 'ajustement_snacks'
      ? t(
          "j'aimerais ajuster les apports selon l'activité du jour, mais comme le plan doit avoir des quantités fixes (pas de quantité conditionnelle), prévois des collations dimensionnées pour un niveau d'activité modéré/moyen plutôt que variable",
        )
      : t('gestion des calories : {strategy}', { strategy: label(CALORIE_STRATEGY_OPTIONS, answers.calorieStrategy).toLowerCase() });
  paragraphs.push(
    t("Mon objectif est : {objective}, avec un niveau d'activité {level}. Pour {strategy}.", {
      objective: label(NUTRITION_OBJECTIVES, answers.objective).toLowerCase(),
      level: label(ACTIVITY_LEVEL_OPTIONS, answers.activityLevel).toLowerCase(),
      strategy: calorieStrategySentence,
    }),
  );

  // Régime
  const dietSentenceParts: string[] = [
    t('Je suis {diet}', { diet: label(DIET_TYPE_OPTIONS, answers.dietType).toLowerCase() }),
    label(FASTING_MODE_OPTIONS, answers.fastingMode).toLowerCase(),
    t('je veux un suivi {focus}', { focus: label(NUTRIENT_FOCUS_OPTIONS, answers.nutrientFocus).toLowerCase() }),
  ];
  let dietSentence = dietSentenceParts.join(', ') + '.';
  if (answers.restrictions.trim()) dietSentence += ' ' + t('Allergies / intolérances : {value}.', { value: answers.restrictions.trim() });
  if (answers.dislikedFoods.trim()) dietSentence += ' ' + t('Aliments à éviter : {value}.', { value: answers.dislikedFoods.trim() });
  if (answers.preferences.trim()) dietSentence += ' ' + t('Préférences : {value}.', { value: answers.preferences.trim() });
  paragraphs.push(dietSentence);

  // Organisation
  const orgParts: string[] = [];
  if (answers.groceryDay) orgParts.push(t('je fais mes courses le {day}', { day: weekdayName(answers.groceryDay) }));
  if (answers.groceryBudget.trim()) orgParts.push(t("avec un budget d'environ {budget}", { budget: answers.groceryBudget.trim() }));
  const equipmentList = [
    ...answers.kitchenEquipment.map((item) => t(item)),
    ...(answers.kitchenEquipmentOther.trim() ? [answers.kitchenEquipmentOther.trim()] : []),
  ];
  let orgSentence =
    t('Je préfère {style}', { style: label(COOKING_STYLE_OPTIONS, answers.cookingStyle).toLowerCase() }) +
    (orgParts.length ? `, ${orgParts.join(' ')}` : '') +
    '.';
  orgSentence +=
    ' ' +
    t('Mon niveau en cuisine est {level} — adapte la complexité des recettes en conséquence.', {
      level: label(COOKING_SKILL_OPTIONS, answers.cookingSkill).toLowerCase(),
    });
  if (equipmentList.length) orgSentence += ' ' + t('Équipement de cuisine disponible : {list}.', { list: equipmentList.join(', ') });
  paragraphs.push(orgSentence);

  // Cible protéique
  const weight = answers.weightKg.trim();
  paragraphs.push(
    t('Vise {target}', { target: t(PROTEIN_TARGET_BY_OBJECTIVE[answers.objective]) }) +
      (weight ? ' ' + t('(soit une cible calculée à partir de mes {weight} kg)', { weight }) : '') +
      ', ' +
      t(
        'et répartis les protéines de façon homogène entre les repas plutôt que de tout concentrer sur un seul. Cette cible doit se retrouver dans le champ "protein" de "totals" pour chaque jour.',
      ),
  );

  // Repas & flexibilité
  const mealsParts: string[] = [t('Prévois {count} repas principaux par jour', { count: answers.mainMealsPerDay })];
  if (answers.snacksPerDay > 0) {
    mealsParts.push(tp(answers.snacksPerDay, 'et {count} collation par jour', 'et {count} collations par jour'));
  } else {
    mealsParts.push(t('et aucune collation'));
  }
  let mealsSentence = mealsParts.join(' ') + '.';
  if (answers.breakfastPrepTime.trim()) {
    mealsSentence += ' ' + t('Le petit-déjeuner doit être prêt en {time} maximum.', { time: answers.breakfastPrepTime.trim() });
  }
  if (answers.generalPrepTime.trim()) {
    mealsSentence += ' ' + t('Les autres repas en {time} maximum.', { time: answers.generalPrepTime.trim() });
  }
  if (answers.leftoverDays.length) {
    mealsSentence +=
      ' ' +
      t('Les {days}, prévois volontairement les restes de la veille plutôt que de nouveaux plats.', {
        days: formatDayList(answers.leftoverDays),
      });
  }
  if (answers.wantsLunchLeftoversNextDay) {
    mealsSentence +=
      ' ' +
      t(
        "Le déjeuner de chaque jour doit être composé des restes du dîner de la veille (le dîner doit donc prévoir une portion supplémentaire) — ce déjeuner fait partie des {count} repas principaux comptés ci-dessus, n'ajoute pas de repas en plus pour ça.",
        { count: answers.mainMealsPerDay },
      );
  }
  if (answers.flexMealDays.length) {
    mealsSentence +=
      ' ' +
      t('{days} : jour "repas libre" (restaurant, sortie) — n\'y prévois pas de repas précis, juste une ligne indicative.', {
        days: formatDayList(answers.flexMealDays),
      });
  }
  paragraphs.push(mealsSentence);

  return `${paragraphs.join('\n\n')}\n\n${safetyInstructions(answers)}\n\n${jsonFormatInstructions(answers.cycleLengthDays)}`;
}
