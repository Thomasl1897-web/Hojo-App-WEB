import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { MASK_HEIGHT, MASK_WIDTH, MUSCLE_MASKS, type MuscleView } from '@/constants/muscle-masks';
import { useTheme } from '@/hooks/use-theme';
import { msg, t } from '@/i18n';
import { MUSCLE_GROUPS, MUSCLE_LABELS } from '@/lib/exercise-catalog';
import type { MuscleIntensities } from '@/lib/muscle-load';

const VIEW_LABELS: Record<MuscleView, string> = { front: msg('Face'), back: msg('Dos') };

/** Opacité minimale d'un muscle sollicité : même très peu, il doit se distinguer de la silhouette. */
const MIN_OPACITY = 0.22;

/**
 * Silhouette de face et de dos dont chaque groupe musculaire est coloré selon son intensité (0 à 1) :
 * neutre quand il n'est pas sollicité, de plus en plus soutenu à mesure que l'intensité monte. Les
 * masques sont des images blanches sur fond transparent, teintées ici (donc dans les deux thèmes).
 */
export function MuscleMap({ intensities }: { intensities: MuscleIntensities }) {
  const theme = useTheme();
  const active = MUSCLE_GROUPS.filter((group) => (intensities[group] ?? 0) > 0);
  const summary = active.length > 0 ? active.map((group) => t(MUSCLE_LABELS[group])).join(', ') : t('Aucun muscle sollicité');

  return (
    <View style={styles.row} accessible accessibilityLabel={summary}>
      {(['front', 'back'] as const).map((view) => (
        <ThemedView key={view} style={styles.column}>
          <View style={styles.figure}>
            <Image source={MUSCLE_MASKS[view].base} style={styles.layer} tintColor={theme.line} contentFit="contain" />
            {MUSCLE_GROUPS.map((group) => {
              const mask = MUSCLE_MASKS[view].groups[group];
              const intensity = intensities[group] ?? 0;
              if (!mask || intensity <= 0) return null;
              return (
                <Image
                  key={group}
                  source={mask}
                  style={[styles.layer, { opacity: MIN_OPACITY + (1 - MIN_OPACITY) * Math.min(1, intensity) }]}
                  tintColor={theme.accent}
                  contentFit="contain"
                />
              );
            })}
          </View>
          <ThemedText type="eyebrow" themeColor="textFaint">
            {t(VIEW_LABELS[view])}
          </ThemedText>
        </ThemedView>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
    justifyContent: 'center',
  },
  column: {
    flex: 1,
    maxWidth: 220,
    alignItems: 'center',
    gap: Spacing.one,
    backgroundColor: 'transparent',
  },
  figure: {
    width: '100%',
    aspectRatio: MASK_WIDTH / MASK_HEIGHT,
  },
  layer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
});
