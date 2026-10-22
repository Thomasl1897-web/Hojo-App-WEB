/** Décalage d'apparition (ms) du n-ième élément d'une liste : plafonné pour ne pas faire attendre une longue liste. */
export function revealDelay(index: number): number {
  return Math.min(Math.max(index, 0), 8) * 45;
}
