import { formatMonthYear, parseDateString } from '@/lib/date';

export type HistoryEntry = {
  key: string;
  date: string;
  title: string;
  /** "program" = séance du programme terminée ; "activity" = activité saisie à la main. */
  kind: 'program' | 'activity';
  durationMinutes: number | null;
  /** Identifiant de l'activité (pour la supprimer), null pour une séance du programme. */
  activityId: number | null;
  /** Activité importée de Health Connect : elle ne se modifie ni ne se supprime ici (elle reviendrait à la synchronisation suivante). */
  imported: boolean;
};

export type HistoryActivity = {
  id: number;
  date: string;
  name: string;
  durationMinutes: number | null;
  /** "health_connect" si importée, absent ou null si saisie à la main. */
  source?: string | null;
};
export type HistoryCompletion = { date: string; sessionName: string };

/**
 * Historique unique des entraînements, du plus récent au plus ancien. À date égale, la séance du
 * programme précède les activités saisies à la main, et celles-ci sont rangées de la dernière
 * saisie à la première : l'ordre est donc le même à chaque ouverture de l'écran.
 */
export function buildHistory(completions: HistoryCompletion[], activities: HistoryActivity[]): HistoryEntry[] {
  const entries: HistoryEntry[] = [
    ...completions.map((completion) => ({
      key: `program-${completion.date}`,
      date: completion.date,
      title: completion.sessionName,
      kind: 'program' as const,
      durationMinutes: null,
      activityId: null,
      imported: false,
    })),
    ...activities.map((activity) => ({
      key: `activity-${activity.id}`,
      date: activity.date,
      title: activity.name,
      kind: 'activity' as const,
      durationMinutes: activity.durationMinutes,
      activityId: activity.id,
      imported: Boolean(activity.source),
    })),
  ];

  return entries.sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    if (a.kind !== b.kind) return a.kind === 'program' ? -1 : 1;
    return (b.activityId ?? 0) - (a.activityId ?? 0);
  });
}

export type HistoryFilter = 'all' | 'program' | 'activity';

/** Garde les entrées du type demandé, sans changer leur ordre ni modifier la liste d'origine. */
export function filterHistory(entries: HistoryEntry[], filter: HistoryFilter): HistoryEntry[] {
  return filter === 'all' ? entries : entries.filter((entry) => entry.kind === filter);
}

export type HistoryMonth = { key: string; title: string; entries: HistoryEntry[] };

/** Regroupe un historique déjà trié par mois ("Octobre 2026"), en gardant l'ordre. */
export function groupByMonth(entries: HistoryEntry[]): HistoryMonth[] {
  const months: HistoryMonth[] = [];
  for (const entry of entries) {
    const key = entry.date.slice(0, 7);
    const last = months[months.length - 1];
    if (last && last.key === key) {
      last.entries.push(entry);
    } else {
      months.push({ key, title: formatMonthYear(parseDateString(entry.date)), entries: [entry] });
    }
  }
  return months;
}

export type ActivityBreakdown = { name: string; count: number; minutes: number };

/**
 * Répartition des activités saisies à la main par nom : nombre de fois et temps total (les
 * durées non renseignées ne comptent pas dans le temps). Les plus pratiquées d'abord. "Vélo" et
 * "vélo" sont la même activité.
 */
export function breakdownByActivity(activities: HistoryActivity[]): ActivityBreakdown[] {
  const byName = new Map<string, ActivityBreakdown>();
  for (const activity of activities) {
    const key = activity.name.trim().toLocaleLowerCase('fr');
    const existing = byName.get(key) ?? { name: activity.name.trim(), count: 0, minutes: 0 };
    existing.count++;
    existing.minutes += activity.durationMinutes ?? 0;
    byName.set(key, existing);
  }
  return [...byName.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'fr'));
}

export type HistoryTotals = { total: number; program: number; activities: number; thisMonth: number };

export function summarizeHistory(entries: HistoryEntry[], today: Date): HistoryTotals {
  const monthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  return {
    total: entries.length,
    program: entries.filter((entry) => entry.kind === 'program').length,
    activities: entries.filter((entry) => entry.kind === 'activity').length,
    thisMonth: entries.filter((entry) => entry.date.startsWith(monthKey)).length,
  };
}
