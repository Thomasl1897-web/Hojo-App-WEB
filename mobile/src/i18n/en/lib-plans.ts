export const libPlans: Record<string, string> = {
  // Notifications
  Repas: 'Meals',
  Maison: 'Home',
  'Séances de sport': 'Workouts',
  'Séance de sport': 'Workout',
  "C'est l'heure de t'entraîner.": "It's time to train.",
  'les poubelles': 'the bins',
  'Poubelles demain': 'Bins tomorrow',
  'Ce soir, sortir {bins}.': 'Tonight, put out {bins}.',
  'Sortir {bins}': 'Put out {bins}',
  "Aujourd'hui : {bins}": 'Today: {bins}',
  'Repos terminé': 'Rest over',
  'Série suivante.': 'Next set.',

  // Import des plans (messages d'erreur et d'avertissement)
  'Heure attendue au format HH:MM': 'Time expected in HH:MM format',
  "Le contenu n'est pas un JSON valide. Si l'assistant IA a tronqué sa réponse, redemande-lui le plan complet sous forme de fichier .json.":
    'The content is not valid JSON. If the AI assistant cut its answer short, ask it again for the complete plan as a .json file.',
  'Erreur sur "{path}" : {message}': 'Error on "{path}": {message}',
  "Plan refusé pour raison de sécurité : le jour {day} n'apporte que {calories} kcal, sous le seuil minimal de {min} kcal/jour. Régénère un plan en demandant des apports adaptés, et parles-en à un médecin ou un diététicien avant de suivre un régime aussi restrictif.":
    'Plan rejected for safety reasons: day {day} provides only {calories} kcal, below the minimum of {min} kcal/day. Generate a new plan asking for suitable intakes, and talk to a doctor or dietitian before following such a restrictive diet.',
  '{label} n\'est pas marqué "repos" mais ne contient aucun exercice.': '{label} is not marked as "rest" but contains no exercise.',
  '{label} est marqué "repos" mais contient des exercices.': '{label} is marked as "rest" but contains exercises.',
  'Le jour "{day}" apparaît plusieurs fois dans le plan.': 'The day "{day}" appears more than once in the plan.',
  'Il manque un jour dans le plan : {days}.': 'A day is missing from the plan: {days}.',
  'Le jour "{day}"': 'The day "{day}"',
  'La séance #{number} ("{name}")': 'Session #{number} ("{name}")',
  'Aucun jour de repos sur la semaine — le surentraînement augmente le risque de blessure, envisage de régénérer un plan avec au moins un jour de récupération.':
    'No rest day in the week — overtraining increases the risk of injury, consider generating a new plan with at least one recovery day.',
  "Aucune séance de repos dans l'enchaînement : pense à garder des jours off entre les séances (l'enchaînement attend que tu sois prêt).": "No rest session in the rotation: remember to keep days off between sessions (the rotation waits until you are ready).",

  // Sauvegarde
  "Ce fichier n'est pas une sauvegarde valide (JSON illisible).": 'This file is not a valid backup (unreadable JSON).',
  'Cette sauvegarde est incomplète ou abîmée : elle ne peut pas être restaurée.': 'This backup is incomplete or damaged: it cannot be restored.',
  "Ce fichier n'est pas une sauvegarde de Hojo.": 'This file is not a Hojo backup.',
  "Cette sauvegarde vient d'une version plus récente de l'app : mets l'app à jour avant de la restaurer.":
    'This backup comes from a newer version of the app: update the app before restoring it.',
  "Le plan nutrition de la sauvegarde n'a pas pu être relu ({error}). Réimporte-le depuis son fichier.":
    'The nutrition plan in the backup could not be read ({error}). Import it again from its file.',
  "Le programme sport de la sauvegarde n'a pas pu être relu ({error}). Réimporte-le depuis son fichier.":
    'The workout program in the backup could not be read ({error}). Import it again from its file.',

  // Invariants du plan nutrition
  'La recette "{recipe}" utilise l\'ingrédient "{food}" qui n\'existe pas dans "foods".':
    'The recipe "{recipe}" uses the ingredient "{food}" which does not exist in "foods".',
  'Recette "{recipe}" : le champ "{field}" déclaré ({declared}) s\'écarte de plus de {tolerance}% de la valeur calculée depuis les ingrédients ({computed} par portion).':
    'Recipe "{recipe}": the declared "{field}" ({declared}) differs by more than {tolerance}% from the value computed from the ingredients ({computed} per portion).',
  'Jour {day}, repas "{meal}" : la référence "{ref}" n\'existe dans aucune recette (batches/singles).':
    'Day {day}, meal "{meal}": the reference "{ref}" does not exist in any recipe (batches/singles).',
  'Jour {day}, repas "{meal}" : référence un plat cuisiné en série ("{ref}") sans préciser "portionIndex".':
    'Day {day}, meal "{meal}": refers to a batch-cooked dish ("{ref}") without specifying "portionIndex".',
  'Jour {day}, repas "{meal}" : "portionIndex" n\'a de sens que pour un plat cuisiné en série, or "{ref}" est un plat simple.':
    'Day {day}, meal "{meal}": "portionIndex" only makes sense for a batch-cooked dish, but "{ref}" is a single dish.',
  'Jour {day} : la somme des repas connus dépasse déjà "{field}" du total déclaré, alors qu\'un repas hors-cycle doit encore s\'ajouter.':
    'Day {day}: the sum of the known meals already exceeds the declared "{field}" total, while an off-cycle meal still has to be added.',
  'Jour {day} : "{field}" déclaré dans "totals" ({declared}) ne correspond pas à la somme des repas ({sum}).':
    'Day {day}: "{field}" declared in "totals" ({declared}) does not match the sum of the meals ({sum}).',
  "meta.baseDayKcal ({declared}) s'écarte de plus de {tolerance}% de la moyenne réelle des jours ({average} kcal).":
    'meta.baseDayKcal ({declared}) differs by more than {tolerance}% from the actual average of the days ({average} kcal).',
  '"{name}" : portion(s) {portions} jamais mangée(s) sur les {total} déclarées.': '"{name}": portion(s) {portions} never eaten out of the {total} declared.',
  '"{name}" : portion(s) {portions} hors de la plage 1..{total}.': '"{name}": portion(s) {portions} outside the range 1..{total}.',
  '"{name}" : portion(s) {portions} mangée(s) plusieurs fois.': '"{name}": portion(s) {portions} eaten more than once.',
  '"{name}" : déclare {total} portions mais est mangé {count} fois au total.': '"{name}": declares {total} portions but is eaten {count} times in total.',
  '"{name}" : la portion 1 est mangée le jour {day}, mais cookDay={cookDay} (elle doit être mangée le jour de cuisson).':
    '"{name}": portion 1 is eaten on day {day}, but cookDay={cookDay} (it must be eaten on the cooking day).',
  '"{name}" : cookDay={cookDay} n\'est pas un jour du cycle (1..{length}).': '"{name}": cookDay={cookDay} is not a day of the cycle (1..{length}).',
  'Courses : "{food}" — besoin de {needed}g, acheté {purchased}g (attendu entre {min}g et {max}g en arrondissant à l\'unité).':
    'Shopping: "{food}" — needs {needed}g, bought {purchased}g (expected between {min}g and {max}g when rounding to whole units).',
  'Courses : "{food}" — besoin de {needed}g, acheté {purchased}g.': 'Shopping: "{food}" — needs {needed}g, bought {purchased}g.',
  'Courses (semaine {week}) : "{food}" est acheté mais n\'est utilisé dans aucune recette du plan.':
    'Shopping (week {week}): "{food}" is bought but not used in any recipe of the plan.',
  'Courses (semaine {week}) : "{food}" se vend à l\'unité mais l\'article est exprimé en grammes.':
    'Shopping (week {week}): "{food}" is sold by the unit but the item is expressed in grams.',
  'Courses (semaine {week}) : "{food}" se vend au poids mais l\'article est exprimé en unités.':
    'Shopping (week {week}): "{food}" is sold by weight but the item is expressed in units.',
  'Courses : "{food}" (garde-manger) apparaît dans {count} semaines différentes ({weeks}) — un article de garde-manger ne s\'achète qu\'une fois.':
    'Shopping: "{food}" (pantry) appears in {count} different weeks ({weeks}) — a pantry item is only bought once.',
  'Recette "{recipe}" : {grams}g/portion de "{food}" est sous le seuil mesurable ({min}g).':
    'Recipe "{recipe}": {grams}g/portion of "{food}" is below the measurable threshold ({min}g).',
  'Recette "{recipe}" : {grams}g/portion de "{food}" ({category}) hors de la fourchette plausible {min}-{max}g.':
    'Recipe "{recipe}": {grams}g/portion of "{food}" ({category}) is outside the plausible range {min}-{max}g.',
};
