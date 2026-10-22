import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, StyleSheet, TextInput, Vibration } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableFeedback } from '@/components/pressable-feedback';
import { t } from '@/i18n';
import { ExerciseMusclesModal } from '@/components/exercise-muscles-modal';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Fonts, Spacing } from '@/constants/theme';
import { useSessionKeepAwake } from '@/hooks/use-session-keep-awake';
import { useTheme } from '@/hooks/use-theme';
import { cancelScheduledNotification, scheduleRestEndNotification } from '@/lib/notifications';
import { nextPosition, restAfter, supersetInfo, type Position } from '@/lib/session-flow';
import { formatSetEntry, parseSetEntry, parseTargetReps, type SetEntry } from '@/lib/set-entry';
import { formatWeight, isAuxiliaryExercise } from '@/lib/sport-stats';
import {
  completeCurrentSession,
  completeOptionalSession,
  getCurrentSession,
  getSessionAtPosition,
  getLastSessionWeights,
  getSessionProgress,
  getWeightHistory,
  logSetWeight,
  saveSessionProgress,
  type WeightHistoryPoint,
  type WeightLogEntry,
} from '@/lib/sport-db';

type Phase = 'exercise' | 'resting' | 'finished';

function formatShortDate(isoDate: string): string {
  const [, month, day] = isoDate.split('-');
  return `${day}/${month}`;
}

export default function LiveSessionScreen() {
  const theme = useTheme();
  useSessionKeepAwake();
  // `position` : séance facultative lancée depuis l'onglet Sport (sinon, la séance du jour / la suivante).
  const params = useLocalSearchParams<{ position?: string }>();
  // La séance et la position sauvegardée sont lues une seule fois, à l'ouverture de l'écran.
  const [initial] = useState(() => {
    const optionalPosition = params.position !== undefined ? Number(params.position) : NaN;
    const found = Number.isInteger(optionalPosition)
      ? getSessionAtPosition(optionalPosition)
      : (getCurrentSession()?.session ?? null);
    const saved = found ? getSessionProgress(found.sessionName) : null;
    const validSaved = saved && saved.exerciseIndex < (found?.exercises.length ?? 0) ? saved : null;
    return { session: found, saved: validSaved };
  });
  const session = initial.session;
  const [exerciseIndex, setExerciseIndex] = useState(initial.saved?.exerciseIndex ?? 0);
  const [currentSet, setCurrentSet] = useState(initial.saved?.currentSet ?? 1);
  const [phase, setPhase] = useState<Phase>('exercise');
  const [remainingRestSeconds, setRemainingRestSeconds] = useState(0);
  const [restEndsAt, setRestEndsAt] = useState<number | null>(null);
  const restNotificationId = useRef<string | null>(null);
  const [typedWeight, setTypedWeight] = useState<{ key: string; value: string } | null>(null);
  const [musclesOpen, setMusclesOpen] = useState(false);
  const [typedReps, setTypedReps] = useState<{ key: string; value: string } | null>(null);
  // Où aller après le repos (calculé en validant la série) ; null = fin de séance.
  const [pending, setPending] = useState<Position | null>(null);

  const exercise = session?.exercises[exerciseIndex] ?? null;
  const exerciseName = exercise?.name;
  const superset = session ? supersetInfo(session.exercises, exerciseIndex) : null;

  // Une séance facultative compte comme faite sans faire avancer l'enchaînement.
  const completeSession = useCallback(() => {
    if (session?.isOptional) completeOptionalSession(session.sessionName);
    else completeCurrentSession();
  }, [session]);

  // Relu à chaque changement d'exercice seulement : l'historique affiché ne bouge pas en cours de série.
  const lastSessionWeights = useMemo<WeightLogEntry[]>(
    () => (exerciseName ? getLastSessionWeights(exerciseName) : []),
    [exerciseName],
  );
  const weightHistory = useMemo<WeightHistoryPoint[]>(
    () => (exerciseName ? getWeightHistory(exerciseName) : []),
    [exerciseName],
  );

  // Les champs sont pré-remplis avec le poids et les répétitions de la même série la dernière fois (à
  // défaut, répétitions = bas de la fourchette du programme) ; ce que l'utilisateur tape pour la série
  // en cours prend le dessus.
  const weightKey = `${exerciseIndex}-${currentSet}`;
  const lastEntry = lastEntryForSet(lastSessionWeights, currentSet);
  const prefilledReps = lastEntry?.reps ?? (exercise ? parseTargetReps(exercise.reps) : null);
  const weightInput =
    typedWeight?.key === weightKey ? typedWeight.value : lastEntry && lastEntry.weight > 0 ? String(lastEntry.weight) : '';
  const repsInput = typedReps?.key === weightKey ? typedReps.value : prefilledReps !== null ? String(prefilledReps) : '';
  const setWeightInput = (value: string) => setTypedWeight({ key: weightKey, value });
  const setRepsInput = (value: string) => setTypedReps({ key: weightKey, value });

  const clearRestNotification = useCallback(() => {
    const id = restNotificationId.current;
    restNotificationId.current = null;
    if (id) void cancelScheduledNotification(id);
  }, []);

  // Quitter la séance en plein repos ne doit pas laisser traîner une notification qui
  // sonnera dans le vide quelques minutes plus tard.
  useEffect(() => clearRestNotification, [clearRestNotification]);

  const goTo = useCallback(
    (next: Position | null) => {
      clearRestNotification();
      setRestEndsAt(null);
      if (next) {
        setExerciseIndex(next.exerciseIndex);
        setCurrentSet(next.currentSet);
        setPhase('exercise');
      } else {
        completeSession();
        setPhase('finished');
      }
    },
    [clearRestNotification, completeSession],
  );

  const advanceAfterRest = useCallback(() => goTo(pending), [goTo, pending]);

  /*
   * Le temps restant est recalculé depuis un timestamp de fin plutôt que décrémenté seconde
   * par seconde : un compteur décrémenté se fige dès que l'app passe en arrière-plan (JS
   * suspendu sur iOS, throttlé sur Android), et le repos ne durait alors que le temps passé
   * à regarder l'écran. La notification programmée en parallèle prend le relais du signal
   * sonore quand le téléphone est verrouillé.
   */
  useEffect(() => {
    if (phase !== 'resting' || restEndsAt === null) return;

    const tick = () => {
      const remaining = Math.max(0, Math.ceil((restEndsAt - Date.now()) / 1000));
      setRemainingRestSeconds(remaining);
      if (remaining === 0) {
        Vibration.vibrate([0, 400, 200, 400]);
        advanceAfterRest();
      }
    };

    tick();
    const interval = setInterval(tick, 500);
    return () => clearInterval(interval);
  }, [phase, restEndsAt, advanceAfterRest]);

  async function finishSet() {
    if (!session || !exercise) return;
    const entry = isAuxiliaryExercise(exercise.name) ? null : parseSetEntry(weightInput, repsInput);
    if (entry) logSetWeight(exercise.name, currentSet, entry.weight, entry.reps);
    // On sauvegarde la position SUIVANTE : si l'utilisateur quitte pendant le repos, il
    // reprendra à la série qu'il doit faire, pas à celle qu'il vient de terminer.
    const next = nextPosition(session.exercises, exerciseIndex, currentSet);
    if (next) saveSessionProgress(session.sessionName, next);

    // Dans un superset, on enchaîne sans repos jusqu'à la fin du tour.
    const rest = next ? restAfter(session.exercises, exerciseIndex, currentSet) : 0;
    if (rest > 0) {
      setPending(next);
      setRestEndsAt(Date.now() + rest * 1000);
      setRemainingRestSeconds(rest);
      setPhase('resting');
      restNotificationId.current = await scheduleRestEndNotification(rest);
    } else {
      goTo(next);
    }
  }

  function goToExercise(index: number) {
    if (!session) return;
    clearRestNotification();
    setRestEndsAt(null);
    setExerciseIndex(index);
    setCurrentSet(1);
    setPhase('exercise');
    saveSessionProgress(session.sessionName, { exerciseIndex: index, currentSet: 1 });
  }

  function skipExercise() {
    if (!session) return;
    if (exerciseIndex < session.exercises.length - 1) {
      goToExercise(exerciseIndex + 1);
    } else {
      goTo(null);
    }
  }

  function handleQuit() {
    if (!session) return;
    Alert.alert(t('Quitter la séance'), t('Que veux-tu faire ?'), [
      {
        text: t('Mettre en pause'),
        onPress: () => {
          // Pendant un repos, la position déjà sauvegardée est la bonne (série suivante).
          if (phase === 'exercise') saveSessionProgress(session.sessionName, { exerciseIndex, currentSet });
          router.back();
        },
      },
      {
        text: t('Terminer la séance'),
        onPress: () => {
          completeSession();
          router.back();
        },
      },
      { text: t('Annuler'), style: 'cancel' },
    ]);
  }

  if (!session) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ThemedText type="smallBold">{t("Aucune séance trouvée pour aujourd'hui.")}</ThemedText>
          <PressableFeedback onPress={() => router.back()}>
            <ThemedText type="link">{t('Retour')}</ThemedText>
          </PressableFeedback>
        </SafeAreaView>
      </ThemedView>
    );
  }

  if (phase === 'finished') {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ThemedView style={styles.centerContent}>
            <ThemedText type="title" style={styles.centerText}>
              {t('Séance terminée 💪')}
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.centerText}>
              {t('{name} — {count} exercices complétés', { name: session.sessionName, count: session.exercises.length })}
            </ThemedText>
            <PressableFeedback onPress={() => router.back()}>
              <ThemedView type="backgroundElement" style={styles.bigButton}>
                <ThemedText type="link">{t('Retour')}</ThemedText>
              </ThemedView>
            </PressableFeedback>
          </ThemedView>
        </SafeAreaView>
      </ThemedView>
    );
  }

  if (!exercise) return null;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.header}>
          <ThemedText type="small" themeColor="textSecondary">
            {t('{name} — Exercice {current}/{total}', { name: session.sessionName, current: exerciseIndex + 1, total: session.exercises.length })}
          </ThemedText>
          <PressableFeedback onPress={handleQuit}>
            <ThemedText type="small" themeColor="textSecondary">
              {t('Quitter')}
            </ThemedText>
          </PressableFeedback>
        </ThemedView>

        {phase === 'exercise' && (
          <ThemedView style={styles.centerContent}>
            <ThemedText type="title" style={styles.centerText}>
              {exercise.name}
            </ThemedText>
            {superset && (
              <ThemedText type="eyebrow" themeColor="accent" style={styles.centerText}>
                {t('Superset {label} · exercice {rank}/{size}', { label: superset.label, rank: superset.rank, size: superset.size })}
              </ThemedText>
            )}
            <ThemedText type="data" themeColor="accent" style={styles.centerText}>
              {/^\d+(\s*-\s*\d+)?$/.test(exercise.reps.trim())
                ? t('Série {current}/{total} · {reps} reps', { current: currentSet, total: exercise.sets, reps: exercise.reps })
                : // « 8 min », « 10 par côté », « 30-45 s » : l'unité est déjà dans le texte.
                  t('Série {current}/{total} · {reps}', { current: currentSet, total: exercise.sets, reps: exercise.reps })}
            </ThemedText>
            {(exercise.tempo || exercise.rir) && (
              <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
                {[
                  exercise.tempo ? t('Tempo {tempo}', { tempo: exercise.tempo }) : null,
                  exercise.rir ? t('RIR {rir}', { rir: exercise.rir }) : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </ThemedText>
            )}
            {exercise.alternative && (
              <ThemedText type="small" themeColor="textFaint" style={styles.centerText}>
                {t('Alternative : {alternative}', { alternative: exercise.alternative })}
              </ThemedText>
            )}
            {exercise.note && (
              <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
                {exercise.note}
              </ThemedText>
            )}

            {!isAuxiliaryExercise(exercise.name) && (
              <PressableFeedback onPress={() => setMusclesOpen(true)} hitSlop={Spacing.two} style={styles.musclesLink}>
                <Ionicons name="body-outline" size={18} color={theme.accent} />
                <ThemedText type="small" themeColor="accent">
                  {t('Muscles travaillés')}
                </ThemedText>
              </PressableFeedback>
            )}

            {!isAuxiliaryExercise(exercise.name) && (
            <ThemedView style={styles.weightBlock}>
              <ThemedView style={styles.inputsRow}>
                <ThemedView style={styles.inputColumn}>
                  <ThemedText type="small" themeColor="textSecondary">
                    {t('Poids (kg)')}
                  </ThemedText>
                  <TextInput
                    value={weightInput}
                    onChangeText={setWeightInput}
                    keyboardType="decimal-pad"
                    placeholder={t('ex : 40')}
                    placeholderTextColor={theme.textSecondary}
                    style={[
                      styles.weightInput,
                      { color: theme.text, borderColor: theme.line, backgroundColor: theme.backgroundElement },
                    ]}
                  />
                </ThemedView>
                <ThemedView style={styles.inputColumn}>
                  <ThemedText type="small" themeColor="textSecondary">
                    {t('Répétitions')}
                  </ThemedText>
                  <TextInput
                    value={repsInput}
                    onChangeText={setRepsInput}
                    keyboardType="number-pad"
                    placeholder={t('ex : 10')}
                    placeholderTextColor={theme.textSecondary}
                    maxLength={3}
                    style={[
                      styles.weightInput,
                      { color: theme.text, borderColor: theme.line, backgroundColor: theme.backgroundElement },
                    ]}
                  />
                </ThemedView>
              </ThemedView>
              {lastEntry && (
                <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
                  {t('Dernière fois (série {set}) : {entry}', { set: currentSet, entry: formatSetEntry(lastEntry, formatWeight) })}
                </ThemedText>
              )}
              {weightHistory.some((h) => h.maxWeight > 0) && (
                <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
                  {t('Historique : {history}', {
                    history: weightHistory
                      .filter((h) => h.maxWeight > 0)
                      .map((h) => `${formatShortDate(h.date)} ${h.maxWeight}kg`)
                      .join(' · '),
                  })}
                </ThemedText>
              )}
            </ThemedView>
            )}

            <PressableFeedback onPress={finishSet} haptic="success">
              <ThemedView type="accent" style={styles.bigButton}>
                <ThemedText type="link" themeColor="accentOnColor">
                  {t('Série terminée')}
                </ThemedText>
              </ThemedView>
            </PressableFeedback>

            <ThemedView style={styles.navRow}>
              <PressableFeedback onPress={() => goToExercise(exerciseIndex - 1)} disabled={exerciseIndex === 0}>
                <ThemedText type="small" themeColor="textSecondary" style={exerciseIndex === 0 && styles.navDisabled}>
                  {t('← Exercice précédent')}
                </ThemedText>
              </PressableFeedback>
              <PressableFeedback onPress={skipExercise} haptic="light">
                <ThemedText type="small" themeColor="textSecondary">
                  {t("Passer l'exercice →")}
                </ThemedText>
              </PressableFeedback>
            </ThemedView>
          </ThemedView>
        )}

        {phase === 'resting' && (
          <ThemedView style={styles.centerContent}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
              {t('Repos')}
            </ThemedText>
            <ThemedText style={[styles.timerText, { color: theme.accent }]}>
              {formatSeconds(remainingRestSeconds)}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
              {pending
                ? t('Prochain : {name} — série {number}', {
                    name: session.exercises[pending.exerciseIndex]?.name ?? '',
                    number: pending.currentSet,
                  })
                : t('fin de séance')}
            </ThemedText>
            <PressableFeedback onPress={advanceAfterRest} haptic="light">
              <ThemedView type="backgroundElement" style={styles.bigButton}>
                <ThemedText type="link">{t('Passer le repos')}</ThemedText>
              </ThemedView>
            </PressableFeedback>
          </ThemedView>
        )}
      </SafeAreaView>
      <ExerciseMusclesModal
        visible={musclesOpen}
        name={exercise.name}
        exerciseId={exercise.exerciseId}
        onClose={() => setMusclesOpen(false)}
      />
    </ThemedView>
  );
}

function lastEntryForSet(entries: WeightLogEntry[], setNumber: number): SetEntry | null {
  const found = entries.find((entry) => entry.setNumber === setNumber);
  return found ? { weight: found.weight, reps: found.reps } : null;
}

function formatSeconds(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.three,
    backgroundColor: 'transparent',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.three,
    backgroundColor: 'transparent',
  },
  centerText: {
    textAlign: 'center',
  },
  timerText: {
    fontFamily: Fonts.mono,
    fontVariant: ['tabular-nums'],
    fontSize: 72,
    lineHeight: 80,
    fontWeight: '600',
  },
  navRow: {
    flexDirection: 'row',
    gap: Spacing.four,
    backgroundColor: 'transparent',
  },
  navDisabled: {
    opacity: 0.3,
  },
  weightBlock: {
    alignItems: 'center',
    gap: Spacing.one,
    backgroundColor: 'transparent',
  },
  musclesLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  inputsRow: {
    flexDirection: 'row',
    gap: Spacing.three,
    backgroundColor: 'transparent',
  },
  inputColumn: {
    alignItems: 'center',
    gap: Spacing.one,
    backgroundColor: 'transparent',
  },
  weightInput: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    fontSize: 20,
    textAlign: 'center',
    minWidth: 110,
  },
  bigButton: {
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.five,
    alignItems: 'center',
    marginTop: Spacing.three,
  },
});
