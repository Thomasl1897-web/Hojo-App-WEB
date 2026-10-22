import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { placeTooltip } from '@/lib/chart-utils';
import { niceAxis } from '@/lib/sport-stats';
import { hapticSelection } from '@/lib/haptics';

export type ChartPoint = { label: string; value: number };

const PAD_LEFT = 40;
const PAD_RIGHT = 14;
const PAD_TOP = 12;
const PAD_BOTTOM = 22;
const LINE_THICKNESS = 2.5;
const TOOLTIP_WIDTH = 96;
const TOOLTIP_HEIGHT = 44;
/** La bulle reste un instant après avoir levé le doigt, pour qu'un simple appui soit lisible. */
const TOOLTIP_LINGER_MS = 700;

/**
 * Courbe dessinée avec de simples vues (pas de bibliothèque de dessin native, donc pas de
 * nouveau build) : chaque segment est une fine vue pivotée entre deux points. Les points sont
 * répartis régulièrement (un par séance, pas proportionnellement aux dates). Rien d'autre que le
 * tracé n'est écrit : la valeur d'un point n'apparaît que lorsqu'on le maintient sous le doigt.
 */
export function LineChart({
  points,
  formatValue,
  formatAxis,
  integerAxis = false,
  height = 170,
}: {
  points: ChartPoint[];
  formatValue: (value: number) => string;
  formatAxis: (value: number) => string;
  /** Axe en nombres entiers (nombre de séries). */
  integerAxis?: boolean;
  height?: number;
}) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    },
    [],
  );

  if (points.length === 0) return null;

  const showPoint = (index: number) => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setActive(index);
  };
  const hidePoint = () => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setActive(null), TOOLTIP_LINGER_MS);
  };

  const innerWidth = Math.max(0, width - PAD_LEFT - PAD_RIGHT);
  const innerHeight = height - PAD_TOP - PAD_BOTTOM;

  const values = points.map((point) => point.value);
  const { min, max } = niceAxis(Math.min(...values), Math.max(...values), { integer: integerAxis });

  const x = (index: number) => PAD_LEFT + (points.length === 1 ? innerWidth / 2 : (index / (points.length - 1)) * innerWidth);
  const y = (value: number) => PAD_TOP + (1 - (value - min) / (max - min)) * innerHeight;
  const dotSize = points.length > 30 ? 5 : 9;

  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);
  const gridValues = [max, (max + min) / 2, min];

  const activePoint = active !== null && active < points.length ? points[active] : null;
  const tooltip =
    activePoint && active !== null
      ? placeTooltip(x(active), y(activePoint.value), width, TOOLTIP_WIDTH, TOOLTIP_HEIGHT)
      : null;

  return (
    <View style={{ height }} onLayout={onLayout}>
      {width > 0 && (
        <>
          {gridValues.map((value, index) => (
            <View key={index}>
              <View
                style={[styles.gridLine, { top: y(value), left: PAD_LEFT, right: PAD_RIGHT, backgroundColor: theme.lineSoft }]}
              />
              <ThemedText type="small" themeColor="textFaint" style={[styles.axisLabel, { top: y(value) - 9 }]}>
                {formatAxis(value)}
              </ThemedText>
            </View>
          ))}

          {points.slice(1).map((point, index) => {
            const x1 = x(index);
            const y1 = y(points[index].value);
            const x2 = x(index + 1);
            const y2 = y(point.value);
            const length = Math.hypot(x2 - x1, y2 - y1);
            return (
              <View
                key={`segment-${index}`}
                style={{
                  position: 'absolute',
                  left: (x1 + x2) / 2 - length / 2,
                  top: (y1 + y2) / 2 - LINE_THICKNESS / 2,
                  width: length,
                  height: LINE_THICKNESS,
                  backgroundColor: theme.accent,
                  transform: [{ rotate: `${Math.atan2(y2 - y1, x2 - x1)}rad` }],
                }}
              />
            );
          })}

          {points.map((point, index) => {
            const isActive = index === active;
            const size = isActive ? dotSize + 5 : dotSize;
            return (
              <Pressable
                key={`dot-${index}`}
                onPressIn={() => {
                  hapticSelection();
                  showPoint(index);
                }}
                onPressOut={hidePoint}
                hitSlop={8}
                style={{
                  position: 'absolute',
                  left: x(index) - 14,
                  top: y(point.value) - 14,
                  width: 28,
                  height: 28,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                <View
                  style={{
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    backgroundColor: isActive ? theme.accent : theme.backgroundElement,
                    borderWidth: 2,
                    borderColor: theme.accent,
                  }}
                />
              </Pressable>
            );
          })}

          <ThemedText type="small" themeColor="textFaint" style={[styles.xLabel, { left: PAD_LEFT - 6, top: height - 18 }]}>
            {points[0].label}
          </ThemedText>
          {points.length > 1 && (
            <ThemedText
              type="small"
              themeColor="textFaint"
              style={[styles.xLabel, { right: PAD_RIGHT - 6, top: height - 18, textAlign: 'right' }]}>
              {points[points.length - 1].label}
            </ThemedText>
          )}

          {activePoint && tooltip && (
            <ThemedView
              pointerEvents="none"
              type="backgroundSelected"
              style={[
                styles.tooltip,
                { left: tooltip.left, top: tooltip.top, width: TOOLTIP_WIDTH, height: TOOLTIP_HEIGHT, borderColor: theme.accentLine },
              ]}>
              <ThemedText type="data" themeColor="accent" style={styles.tooltipValue}>
                {formatValue(activePoint.value)}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.tooltipLabel}>
                {activePoint.label}
              </ThemedText>
            </ThemedView>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  gridLine: {
    position: 'absolute',
    height: 1,
  },
  axisLabel: {
    position: 'absolute',
    left: 0,
    width: PAD_LEFT - 6,
    textAlign: 'right',
    fontSize: 11,
    lineHeight: 18,
  },
  xLabel: {
    position: 'absolute',
    fontSize: 11,
    lineHeight: 16,
  },
  tooltip: {
    position: 'absolute',
    borderRadius: Spacing.two,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  tooltipValue: {
    fontSize: 14,
    lineHeight: 18,
  },
  tooltipLabel: {
    fontSize: 11,
    lineHeight: 15,
  },
});
