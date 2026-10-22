/**
 * Répétitions visées par défaut pour une série, d'après le texte du programme : "10" → 10,
 * "8-12" ou "8 à 12" → 8 (le bas de la fourchette, à ajuster). Les textes qui ne sont pas un nombre
 * de répétitions ("AMRAP", "échec") et les durées ("30s", "1 min") n'ont pas de valeur par défaut.
 */
export function parseTargetReps(text: string): number | null {
  const cleaned = text.trim().toLowerCase();
  if (/^\d+\s*(s|sec|secondes?|seconds?|min|minutes?|m)\b/.test(cleaned)) return null;
  const match = cleaned.match(/^(\d{1,3})\b/);
  if (!match) return null;
  const value = Number.parseInt(match[1], 10);
  return value >= 1 ? value : null;
}

export type SetEntry = { weight: number; reps: number | null };

/**
 * Ce que la personne a saisi pour une série. Le poids accepte la virgule ("42,5"), vide ou illisible = 0
 * (exercice au poids du corps) ; les répétitions sont un entier de 1 à 999, sinon inconnues. Une série
 * sans poids NI répétitions n'est pas enregistrée (null).
 */
export function parseSetEntry(weightText: string, repsText: string): SetEntry | null {
  const parsedWeight = Number.parseFloat(weightText.replace(',', '.'));
  const weight = Number.isFinite(parsedWeight) && parsedWeight > 0 ? parsedWeight : 0;

  const cleanReps = repsText.trim();
  const parsedReps = /^\d+$/.test(cleanReps) ? Number.parseInt(cleanReps, 10) : NaN;
  const reps = Number.isFinite(parsedReps) && parsedReps >= 1 && parsedReps <= 999 ? parsedReps : null;

  if (weight === 0 && reps === null) return null;
  return { weight, reps };
}

/** "60 kg × 8", "60 kg", "8 reps" selon ce qui a été saisi. */
export function formatSetEntry(entry: SetEntry, formatWeight: (kg: number) => string): string {
  if (entry.weight > 0 && entry.reps !== null) return `${formatWeight(entry.weight)} × ${entry.reps}`;
  if (entry.weight > 0) return formatWeight(entry.weight);
  return `${entry.reps} reps`;
}
