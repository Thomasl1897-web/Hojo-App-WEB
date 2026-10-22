import { t } from '@/i18n';

/**
 * Vérifie qu'un ensemble de jours couvre exactement 1..cycleLengthDays, chacun une fois.
 * Partagé entre les domaines nutrition et sport, qui utilisent tous les deux le même
 * modèle de "cycle de N jours" plutôt que des jours de semaine récurrents.
 */
export function validateCycleDayCoverage(days: { day: number }[], cycleLengthDays: number): string | null {
  const outOfRange = days.find((d) => d.day > cycleLengthDays);
  if (outOfRange) {
    return t('Le jour {day} dépasse la durée du cycle annoncée ({length} jours).', { day: outOfRange.day, length: cycleLengthDays });
  }

  const seenDays = new Set<number>();
  const duplicateDay = days.find((d) => {
    if (seenDays.has(d.day)) return true;
    seenDays.add(d.day);
    return false;
  });
  if (duplicateDay) {
    return t('Le jour {day} apparaît plusieurs fois dans le plan.', { day: duplicateDay.day });
  }

  if (days.length !== cycleLengthDays) {
    const missing = Array.from({ length: cycleLengthDays }, (_, i) => i + 1).filter((d) => !seenDays.has(d));
    return t("Le plan annonce un cycle de {length} jours mais il manque le(s) jour(s) {days}.", { length: cycleLengthDays, days: missing.join(', ') });
  }

  return null;
}
