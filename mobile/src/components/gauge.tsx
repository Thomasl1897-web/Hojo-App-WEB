import { useEffect, useState } from 'react';
import { Animated, StyleSheet } from 'react-native';

import { ThemedView } from '@/components/themed-view';
import { Spacing, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Au-delà de ce rapport, la jauge passe en ton d'avertissement (journée dépassée). */
const OVERFLOW_THRESHOLD = 1.1;

/**
 * Jauge horizontale arrondie. `ratio` = consommé / prévu : la barre se remplit jusqu'à 100 %
 * puis reste pleine, et vire à la couleur d'avertissement si on dépasse nettement la cible.
 */
/** `color` : jeton de couleur de la barre (l'accent par défaut) ; elle vire à l'ambre en cas de dépassement. */
export function Gauge({ ratio, height = 10, color = 'accent' }: { ratio: number; height?: number; color?: ThemeColor }) {
  const theme = useTheme();
  const [progress] = useState(() => new Animated.Value(0));
  const clamped = Math.max(0, Math.min(1, ratio));

  useEffect(() => {
    Animated.timing(progress, { toValue: clamped, duration: 350, useNativeDriver: false }).start();
  }, [clamped, progress]);

  const width = progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });
  const fill = ratio > OVERFLOW_THRESHOLD ? theme.warn : theme[color];

  return (
    <ThemedView type="lineSoft" style={[styles.track, { height, borderRadius: height / 2 }]}>
      <Animated.View style={[styles.fill, { width, backgroundColor: fill, borderRadius: height / 2 }]} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  track: {
    width: '100%',
    overflow: 'hidden',
    marginVertical: Spacing.half,
  },
  fill: {
    height: '100%',
  },
});
