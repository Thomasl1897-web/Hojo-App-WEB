/** Famille d'un créneau de repas, devinée d'après son libellé (le plan le nomme librement). */
export type MealSlotKind = 'breakfast' | 'lunch' | 'snack' | 'dinner' | 'evening';

/** Minuscules sans accents : "Dîner" et "diner", "Goûter" et "gouter" se valent. */
function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

/**
 * "Petit-déjeuner" → breakfast, "Collation du soir" → evening, "Collation 2" / "Goûter" → snack,
 * "Dîner" / "Souper" → dinner. Tout le reste ("Déjeuner", un libellé inattendu) → lunch.
 */
export function mealSlotKind(slotName: string): MealSlotKind {
  const name = normalize(slotName);
  if (name.includes('petit') || name.includes('breakfast')) return 'breakfast';
  const isSnack = ['collation', 'snack', 'gouter', 'tisane', 'en-cas', 'encas'].some((word) => name.includes(word));
  if (isSnack) return name.includes('soir') || name.includes('evening') || name.includes('night') ? 'evening' : 'snack';
  if (name.includes('diner') || name.includes('souper') || name.includes('dinner') || name.includes('supper')) return 'dinner';
  return 'lunch';
}

/** Nom court du créneau sur la carte ("Collation 2" → "Collation") ; le libellé complet reste dans le détail. */
export function baseSlotName(slotName: string): string {
  return slotName.replace(/\s*\d+$/, '').trim() || slotName;
}
