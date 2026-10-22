import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type Bar = { label: string; value: number; highlight?: boolean };

/**
 * Histogramme simple (des vues, pas de bibliothèque de dessin). La valeur est écrite au-dessus de
 * chaque barre non vide ; une barre vide reste visible sous forme de petit trait, pour qu'une
 * semaine sans séance se lise comme un "zéro" et non comme un trou. Une étiquette sur
 * `labelEvery` en partant de la dernière barre (les petites étiquettes se chevaucheraient).
 */
export function BarChart({ bars, height = 120, labelEvery = 3 }: { bars: Bar[]; height?: number; labelEvery?: number }) {
  const theme = useTheme();
  const max = Math.max(1, ...bars.map((bar) => bar.value));
  const plotHeight = height - 34;

  return (
    <ThemedView style={[styles.row, { height }]}>
      {bars.map((bar, index) => {
        const barHeight = bar.value === 0 ? 3 : Math.max(6, (bar.value / max) * plotHeight);
        const showLabel = (bars.length - 1 - index) % labelEvery === 0;
        return (
          <View key={index} style={styles.column}>
            {bar.value > 0 && (
              <ThemedText type="data" themeColor="textSecondary" style={styles.value}>
                {bar.value}
              </ThemedText>
            )}
            <View
              style={[
                styles.bar,
                {
                  height: barHeight,
                  backgroundColor: bar.value === 0 ? theme.line : bar.highlight ? theme.accent : theme.accentLine,
                },
              ]}
            />
            <View style={styles.labelBox}>
              {showLabel && (
                <ThemedText type="small" themeColor="textFaint" numberOfLines={1} style={styles.label}>
                  {bar.label}
                </ThemedText>
              )}
            </View>
          </View>
        );
      })}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.half * 2,
    backgroundColor: 'transparent',
  },
  column: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  bar: {
    width: '70%',
    borderRadius: 4,
  },
  value: {
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 2,
  },
  labelBox: {
    height: 18,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  label: {
    width: 54,
    textAlign: 'center',
    fontSize: 10,
    lineHeight: 14,
  },
});
