export type CalendarCell = Date | null;

/**
 * Grille d'un mois, semaines du lundi au dimanche : chaque semaine fait 7 cases, `null` = jour
 * qui n'appartient pas au mois (avant le 1er, après le dernier jour).
 */
export function buildMonthGrid(year: number, monthIndex: number): CalendarCell[][] {
  const first = new Date(year, monthIndex, 1);
  const leadingBlanks = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

  const cells: CalendarCell[] = [];
  for (let i = 0; i < leadingBlanks; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) cells.push(new Date(year, monthIndex, day));
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: CalendarCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** Mois décalé de `delta` mois (négatif = passé), avec report d'année. */
export function shiftMonth(year: number, monthIndex: number, delta: number): { year: number; monthIndex: number } {
  const date = new Date(year, monthIndex + delta, 1);
  return { year: date.getFullYear(), monthIndex: date.getMonth() };
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** Nombre de jours entiers de `from` à `to` (négatif si `to` est avant), insensible aux changements d'heure. */
export function daysBetween(from: Date, to: Date): number {
  const start = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const end = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((end - start) / 86_400_000);
}
