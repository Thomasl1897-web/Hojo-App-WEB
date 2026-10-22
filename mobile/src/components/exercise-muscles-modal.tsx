import Ionicons from '@expo/vector-icons/Ionicons';
import { Modal, Pressable, StyleSheet } from 'react-native';

import { MuscleMap } from '@/components/muscle-map';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ModalOverlay, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';
import { MUSCLE_LABELS, resolveExercise } from '@/lib/exercise-catalog';
import { intensitiesForExercise } from '@/lib/muscle-load';

/** Fenêtre « Muscles travaillés » d'un exercice, ouverte depuis l'écran de séance. */
export function ExerciseMusclesModal({
  visible,
  name,
  exerciseId,
  onClose,
}: {
  visible: boolean;
  name: string;
  exerciseId?: string | null;
  onClose: () => void;
}) {
  const theme = useTheme();
  const exercise = visible ? resolveExercise(name, exerciseId) : null;
  const intensities = visible ? intensitiesForExercise(name, exerciseId) : null;
  const labels = (groups: readonly (keyof typeof MUSCLE_LABELS)[]) => groups.map((group) => t(MUSCLE_LABELS[group])).join(', ');

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable onPress={() => {}} style={styles.wrapper}>
          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedView style={styles.header}>
              <ThemedText type="eyebrow" themeColor="accent">
                {t('Muscles travaillés')}
              </ThemedText>
              <Pressable onPress={onClose} hitSlop={Spacing.three} accessibilityLabel={t('Fermer')}>
                <Ionicons name="close" size={24} color={theme.textSecondary} />
              </Pressable>
            </ThemedView>
            <ThemedText type="subtitle" style={styles.title}>
              {name}
            </ThemedText>
            {exercise && intensities ? (
              <>
                <MuscleMap intensities={intensities} />
                <ThemedText type="small" themeColor="textSecondary">
                  {t('Principal : {muscles}', { muscles: labels(exercise.primary) })}
                </ThemedText>
                {exercise.secondary.length > 0 && (
                  <ThemedText type="small" themeColor="textSecondary">
                    {t('Secondaire : {muscles}', { muscles: labels(exercise.secondary) })}
                  </ThemedText>
                )}
              </>
            ) : (
              <ThemedText type="small" themeColor="textSecondary">
                {t("Cet exercice n'est pas reconnu : ses muscles ne sont pas affichés.")}
              </ThemedText>
            )}
          </ThemedView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: ModalOverlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
  },
  wrapper: {
    width: '100%',
    maxWidth: 380,
  },
  card: {
    borderRadius: Spacing.four,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  title: {
    fontSize: 22,
    lineHeight: 28,
  },
});
