export type TooltipPlacement = { left: number; top: number };

/**
 * Place une bulle de `boxWidth` x `boxHeight` centrée sur un point (`x`, `y`) d'un graphique de
 * `chartWidth` de large : au-dessus du point, ou en dessous s'il est trop près du haut, et
 * toujours entièrement dans le graphique (sinon elle serait coupée sur les bords).
 */
export function placeTooltip(
  x: number,
  y: number,
  chartWidth: number,
  boxWidth: number,
  boxHeight: number,
  gap = 12,
): TooltipPlacement {
  const maxLeft = Math.max(0, chartWidth - boxWidth);
  const left = Math.min(maxLeft, Math.max(0, x - boxWidth / 2));
  const above = y - gap - boxHeight;
  const top = above >= 0 ? above : y + gap;
  return { left, top };
}
