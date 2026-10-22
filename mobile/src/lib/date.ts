import { getLanguage, t } from '@/i18n';

export function getTodayDateString(): string {
  return toDateString(new Date());
}

export function toDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Date (AAAA-MM-JJ) d'il y a `days` jours par rapport à `from` (aujourd'hui par défaut). */
export function dateStringDaysAgo(days: number, from: Date = new Date()): string {
  return toDateString(new Date(from.getFullYear(), from.getMonth(), from.getDate() - days));
}

export function parseDateString(dateString: string): Date {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/**
 * Numéro du jour dans le cycle (1..cycleLengthDays) pour la date donnée (aujourd'hui par
 * défaut), sachant que le cycle a démarré à `cycleStartDate` (date d'import du plan, format
 * AAAA-MM-JJ).
 */
export function getCycleDayForDate(
  cycleStartDate: string,
  cycleLengthDays: number,
  date: Date = new Date(),
): number {
  const start = parseDateString(cycleStartDate);
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const daysSinceStart = Math.round((target.getTime() - start.getTime()) / 86_400_000);
  const offset = ((daysSinceStart % cycleLengthDays) + cycleLengthDays) % cycleLengthDays;
  return offset + 1;
}

const WEEKDAY_LABELS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

export function getWeekdayLabel(date: Date = new Date()): string {
  return WEEKDAY_LABELS[date.getDay()];
}

/** Jour de semaine ("lundi"...) d'une date au format AAAA-MM-JJ. */
export function getWeekdayOfDateString(dateString: string): string {
  return WEEKDAY_LABELS[parseDateString(dateString).getDay()];
}

/** Nombre de jours à remonter depuis `from` pour retomber sur le dernier `weekday` (0 = aujourd'hui). */
export function daysSinceWeekday(weekday: string, from: Date = new Date()): number {
  const target = WEEKDAY_LABELS.indexOf(weekday);
  return (from.getDay() - target + 7) % 7;
}

/** Vrai pour une heure au format HH:MM (24h), ex : "07:30". */
export function isValidTimeString(value: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

const MONTH_LABELS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Date décalée de `days` jours (négatif = passé), à minuit local. */
export function addDays(from: Date, days: number): Date {
  return new Date(from.getFullYear(), from.getMonth(), from.getDate() + days);
}

/**
 * Les noms de jours sont aussi des IDENTIFIANTS (stockés, sauvegardés, dans le JSON des plans) : ils
 * restent en français quelle que soit la langue. Pour l'AFFICHAGE, passer par `weekdayName`.
 */
export function weekdayName(weekday: string): string {
  return t(weekday);
}

const WEEKDAY_ENGLISH_SHORT_LENGTH = 3;

/** Ex : "Lundi 14 octobre" / "Monday, October 14". */
export function formatLongDate(date: Date): string {
  const weekday = capitalize(t(WEEKDAY_LABELS[date.getDay()]));
  const month = t(MONTH_LABELS[date.getMonth()]);
  return getLanguage() === 'en' ? `${weekday}, ${month} ${date.getDate()}` : `${weekday} ${date.getDate()} ${month}`;
}

/** Ex : "Octobre 2026" / "October 2026". */
export function formatMonthYear(date: Date): string {
  return `${capitalize(t(MONTH_LABELS[date.getMonth()]))} ${date.getFullYear()}`;
}

/** "Bonjour", "Bon après-midi" ou "Bonsoir" selon l'heure (0-23). */
export function greetingForHour(hour: number): string {
  if (hour >= 5 && hour < 12) return t('Bonjour');
  if (hour >= 12 && hour < 18) return t('Bon après-midi');
  return t('Bonsoir');
}

const WEEKDAY_SHORT = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
const MONTH_SHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

/** Ex : "mer. 14 oct." / "Wed, Oct 14" — pour les petits sélecteurs de date. */
export function formatShortDay(date: Date): string {
  if (getLanguage() === 'en') {
    const weekday = t(WEEKDAY_LABELS[date.getDay()]).slice(0, WEEKDAY_ENGLISH_SHORT_LENGTH);
    const month = t(MONTH_LABELS[date.getMonth()]).slice(0, WEEKDAY_ENGLISH_SHORT_LENGTH);
    return `${weekday}, ${month} ${date.getDate()}`;
  }
  return `${WEEKDAY_SHORT[date.getDay()]} ${date.getDate()} ${MONTH_SHORT[date.getMonth()]}`;
}
