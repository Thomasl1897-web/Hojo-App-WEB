import { msg, t } from '@/i18n';
import { daysBetween } from '@/lib/calendar';
import { addDays, getWeekdayLabel, parseDateString } from '@/lib/date';

export type WasteBinDef = {
  id: number;
  /** Libellé complet dans les Paramètres. */
  label: string;
  /** Couleur d'identification (pastille) : celle du sac réel. */
  color: string;
  /** Formulation dans le rappel : "Sortir les sacs PMC bleus". */
  reminderLabel: string;
};

/** Les types de collecte de l'utilisateur. Les identifiants sont stables (stockés en base). */
export const WASTE_BIN_DEFS: WasteBinDef[] = [
  { id: 1, label: msg('Déchets communs (gris)'), color: '#8A9099', reminderLabel: msg('les déchets communs (sac gris)') },
  { id: 2, label: msg('Sacs PMC (bleus)'), color: '#3A7BC8', reminderLabel: msg('les sacs PMC bleus') },
  { id: 3, label: msg('Sacs jardin (verts)'), color: '#4E9F5A', reminderLabel: msg('les sacs jardin verts') },
  { id: 4, label: msg('Cartons'), color: '#B07A4A', reminderLabel: msg('les cartons') },
];

export type WasteBinConfig = {
  id: number;
  /** Jour de ramassage ("jeudi"), null = ce type n'est pas suivi. */
  weekday: string | null;
  /** Vrai = une semaine sur deux, calée sur `anchorDate`. */
  everyOtherWeek: boolean;
  /** Une date de ramassage réelle, qui fixe la parité des semaines (AAAA-MM-JJ). */
  anchorDate: string | null;
};

export const DEFAULT_WASTE_REMINDER_TIME = '19:00';

/**
 * Le ramassage a-t-il lieu ce jour-là ? Pour "une semaine sur deux", la parité du nombre de
 * semaines écoulées depuis la date d'ancrage décide (valable aussi pour les dates AVANT
 * l'ancrage). Sans date d'ancrage, on retombe sur "chaque semaine" : mieux vaut un rappel de
 * trop qu'un ramassage raté sans prévenir.
 */
export function isCollectionDay(bin: WasteBinConfig, date: Date): boolean {
  if (!bin.weekday || getWeekdayLabel(date) !== bin.weekday) return false;
  if (!bin.everyOtherWeek || !bin.anchorDate) return true;
  const weeks = Math.floor(daysBetween(parseDateString(bin.anchorDate), date) / 7);
  return ((weeks % 2) + 2) % 2 === 0;
}

export function binsCollectedOn(bins: WasteBinConfig[], date: Date): WasteBinConfig[] {
  return bins.filter((bin) => isCollectionDay(bin, date));
}

/** Prochain ramassage à partir de `from` (aujourd'hui compris), null si aucun dans l'horizon. */
export function nextCollectionDate(bin: WasteBinConfig, from: Date, horizonDays = 30): Date | null {
  for (let offset = 0; offset <= horizonDays; offset++) {
    const date = addDays(from, offset);
    if (isCollectionDay(bin, date)) return date;
  }
  return null;
}

/**
 * Les deux prochaines dates possibles pour un ramassage un jour de semaine donné : la plus
 * proche (aujourd'hui compris), puis celle d'une semaine plus tard. L'utilisateur choisit
 * laquelle est un vrai ramassage, ce qui cale la parité du "une semaine sur deux".
 */
export function candidateAnchors(weekday: string, from: Date): [Date, Date] {
  for (let offset = 0; offset < 7; offset++) {
    const date = addDays(from, offset);
    if (getWeekdayLabel(date) === weekday) return [date, addDays(date, 7)];
  }
  // Jour inconnu : ne devrait pas arriver, on reste sur une valeur exploitable.
  return [from, addDays(from, 7)];
}

/** "les sacs bleus", "A et B", "A, B et C". */
export function formatBinList(labels: string[]): string {
  if (labels.length <= 1) return labels[0] ?? '';
  return t('{list} et {last}', { list: labels.slice(0, -1).join(', '), last: labels[labels.length - 1] });
}

export type WasteReminder = {
  fireDate: Date;
  bins: WasteBinConfig[];
};

/**
 * Rappels de la veille au soir sur les `windowDays` prochains jours : un seul rappel par soir,
 * qui regroupe tous les sacs à sortir pour le lendemain. Les soirs déjà passés sont ignorés.
 */
export function buildWasteReminders(
  bins: WasteBinConfig[],
  now: Date,
  time: string,
  windowDays: number,
): WasteReminder[] {
  const [hour, minute] = time.split(':').map(Number);
  const reminders: WasteReminder[] = [];
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  for (let offset = 0; offset < windowDays; offset++) {
    const evening = addDays(today, offset);
    const due = binsCollectedOn(bins, addDays(evening, 1));
    if (due.length === 0) continue;

    const fireDate = new Date(evening.getFullYear(), evening.getMonth(), evening.getDate(), hour, minute);
    if (fireDate.getTime() <= now.getTime()) continue;
    reminders.push({ fireDate, bins: due });
  }
  return reminders;
}
