import { msg, t } from '@/i18n';

/** Activités proposées d'office pour une séance saisie à la main (hors programme importé). Textes français à traduire avec `t`. */
export const ACTIVITY_PRESETS = [
  msg('Course à pied'),
  msg('Marche'),
  msg('Vélo'),
  msg('Natation'),
  msg('Musculation'),
  msg('Yoga / étirements'),
  msg('Sport collectif'),
] as const;

/** Choix "autre" : le champ du nom est vidé, l'utilisateur écrit alors le nom lui-même. */
export const ACTIVITY_OTHER = msg('Autre');

const MAX_NAME_LENGTH = 60;
const MAX_DURATION_MINUTES = 24 * 60;

export type ActivityInput = { name: string; durationMinutes: number | null };

export type ParseActivityResult = { success: true; data: ActivityInput } | { success: false; error: string };

/**
 * Valide la saisie d'une activité : un nom (celui d'un choix prédéfini, éventuellement modifié ou
 * complété par l'utilisateur : "Football" à la place de "Sport collectif"), et une durée
 * facultative en minutes entières entre 1 et 1440. Une durée mal saisie est refusée avec un
 * message, plutôt que d'être ignorée en silence.
 */
export function parseActivityInput(rawName: string, duration: string): ParseActivityResult {
  const name = rawName.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME_LENGTH);
  if (name.length === 0) {
    return { success: false, error: t("Indique le nom de l'activité.") };
  }

  const cleanDuration = duration.trim();
  if (cleanDuration.length === 0) {
    return { success: true, data: { name, durationMinutes: null } };
  }
  if (!/^\d+$/.test(cleanDuration)) {
    return { success: false, error: t('La durée doit être un nombre entier de minutes, par exemple 45.') };
  }
  const minutes = Number.parseInt(cleanDuration, 10);
  if (minutes < 1 || minutes > MAX_DURATION_MINUTES) {
    return { success: false, error: t('La durée doit être comprise entre 1 et {max} minutes.', { max: MAX_DURATION_MINUTES }) };
  }
  return { success: true, data: { name, durationMinutes: minutes } };
}

/** "45 min", "1 h", "1 h 30". */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${String(rest).padStart(2, '0')}`;
}
