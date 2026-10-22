import { useMemo, useState } from 'react';
import { StyleSheet } from 'react-native';

import { ChipSingleSelect, FieldGroup } from '@/components/form-fields';
import { MuscleMap } from '@/components/muscle-map';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { msg, t, tp } from '@/i18n';
import { addDays, toDateString } from '@/lib/date';
import { MUSCLE_LABELS, resolveExercise } from '@/lib/exercise-catalog';
import {
  computeMuscleLoad,
  intensitiesForExercise,
  intensitiesFromLoad,
  intensitiesRelative,
  rankMuscles,
  type MuscleIntensities,
} from '@/lib/muscle-load';
import {
  getCurrentSession,
  getLoggedExercises,
  getLoggedSetCounts,
  getProgramExerciseIds,
  getProgramExercises,
} from '@/lib/sport-db';
import { formatNumber, isAuxiliaryExercise } from '@/lib/sport-stats';

type Mode = 'week' | 'month' | 'session' | 'program' | 'exercise';

const MODE_OPTIONS: { value: Mode; label: string }[] = [
  { value: 'week', label: msg('7 jours') },
  { value: 'month', label: msg('30 jours') },
  { value: 'session', label: msg('Séance') },
  { value: 'program', label: msg('Programme') },
  { value: 'exercise', label: msg('Exercice') },
];

/** Combien de muscles on détaille sous la silhouette. */
const LEGEND_SIZE = 5;

type View = {
  intensities: MuscleIntensities;
  /** Lignes de légende (déjà traduites). */
  legend: string[];
  /** Message à la place de la légende quand il n'y a rien à montrer. */
  empty: string | null;
  unknown: string[];
};

function loadView(
  entries: { name: string; sets: number; exerciseId?: string | null }[],
  toIntensities: (load: ReturnType<typeof computeMuscleLoad>['load']) => MuscleIntensities,
  empty: string,
): View {
  const { load, unknown } = computeMuscleLoad(entries, getProgramExerciseIds());
  const ranked = rankMuscles(load);
  return {
    intensities: toIntensities(load),
    legend: ranked.slice(0, LEGEND_SIZE).map(({ group, sets }) => `${t(MUSCLE_LABELS[group])} · ${formatNumber(sets)}`),
    empty: ranked.length === 0 ? empty : null,
    unknown,
  };
}

/** Exercices proposés dans la vue « Exercice » : ceux du programme puis ceux déjà faits, sans doublon. */
function exerciseChoices(): string[] {
  const names = [
    ...getProgramExercises().map((exercise) => exercise.name),
    ...getLoggedExercises().map((exercise) => exercise.name),
  ].filter((name) => !isAuxiliaryExercise(name));
  return [...new Set(names)];
}

/**
 * Carte « Muscles » : la silhouette colorée selon ce qui a été travaillé (7 / 30 derniers jours), ce
 * que prévoit la séance du jour ou le programme, ou les muscles d'un exercice. `version` force la
 * relecture quand l'écran reprend le focus.
 */
export function MuscleHeatmapCard({ version }: { version: number }) {
  const [mode, setMode] = useState<Mode>('week');
  const [chosenExercise, setChosenExercise] = useState<string | null>(null);

  const choices = useMemo(
    () => exerciseChoices(),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version],
  );
  const exerciseName = chosenExercise && choices.includes(chosenExercise) ? chosenExercise : (choices[0] ?? null);

  const view = useMemo<View>(
    () => {
      const today = new Date();
      if (mode === 'week' || mode === 'month') {
        const days = mode === 'week' ? 7 : 30;
        const since = toDateString(addDays(today, -(days - 1)));
        return loadView(
          getLoggedSetCounts(since),
          (load) => intensitiesFromLoad(load, days / 7),
          t('Aucune série enregistrée sur cette période.'),
        );
      }
      if (mode === 'session') {
        const session = getCurrentSession()?.session;
        const exercises = (session?.exercises ?? []).filter((exercise) => !isAuxiliaryExercise(exercise.name));
        return loadView(exercises, intensitiesRelative, t("Pas d'exercice dans la séance du jour."));
      }
      if (mode === 'program') {
        return loadView(getProgramExercises(), (load) => intensitiesFromLoad(load, 1), t("Aucun exercice dans le programme."));
      }
      const exercise = exerciseName ? resolveExercise(exerciseName, getProgramExerciseIds().get(exerciseName)) : null;
      const intensities = exerciseName ? intensitiesForExercise(exerciseName, getProgramExerciseIds().get(exerciseName)) : null;
      if (!exerciseName || !exercise || !intensities) {
        return {
          intensities: {},
          legend: [],
          empty: exerciseName ? t("Cet exercice n'est pas reconnu : ses muscles ne sont pas affichés.") : t("Aucun exercice à afficher."),
          unknown: [],
        };
      }
      return {
        intensities,
        legend: [
          t('Principal : {muscles}', { muscles: exercise.primary.map((group) => t(MUSCLE_LABELS[group])).join(', ') }),
          ...(exercise.secondary.length > 0
            ? [t('Secondaire : {muscles}', { muscles: exercise.secondary.map((group) => t(MUSCLE_LABELS[group])).join(', ') })]
            : []),
        ],
        empty: null,
        unknown: [],
      };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mode, exerciseName, version],
  );

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <FieldGroup title="Muscles" icon="sport">
        <ChipSingleSelect options={MODE_OPTIONS} value={mode} onChange={setMode} />

        {mode === 'exercise' && choices.length > 0 && (
          <ChipSingleSelect
            scrollable
            options={choices.map((name) => ({ value: name, label: name }))}
            value={exerciseName}
            onChange={setChosenExercise}
          />
        )}

        <MuscleMap intensities={view.intensities} />

        {view.empty ? (
          <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
            {view.empty}
          </ThemedText>
        ) : (
          <ThemedView style={styles.legend}>
            {view.legend.map((line) => (
              <ThemedText key={line} type="small" themeColor="textSecondary">
                {line}
              </ThemedText>
            ))}
            {mode !== 'exercise' && (
              <ThemedText type="small" themeColor="textFaint">
                {t('Séries par muscle ; un muscle secondaire compte pour moitié.')}
              </ThemedText>
            )}
          </ThemedView>
        )}

        {view.unknown.length > 0 && (
          <ThemedText type="small" themeColor="textFaint">
            {tp(
              view.unknown.length,
              "{count} exercice n'est pas reconnu et n'est pas compté : {names}.",
              "{count} exercices ne sont pas reconnus et ne sont pas comptés : {names}.",
              { names: view.unknown.join(', ') },
            )}
          </ThemedText>
        )}
      </FieldGroup>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
  },
  legend: {
    gap: Spacing.half,
    backgroundColor: 'transparent',
  },
  centered: {
    textAlign: 'center',
  },
});
