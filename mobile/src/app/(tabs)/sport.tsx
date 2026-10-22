import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableFeedback } from '@/components/pressable-feedback';
import { t, tp, msg } from '@/i18n';
import { BarChart } from '@/components/bar-chart';
import { ChipSingleSelect, Tier } from '@/components/form-fields';
import { LineChart } from '@/components/line-chart';
import { MuscleHeatmapCard } from '@/components/muscle-heatmap-card';
import { SectionIcon } from '@/components/section-icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { STREAK_ICON } from '@/constants/icons';
import { getWeekdayLabel, weekdayName } from '@/lib/date';
import {
  getActiveSportPlanMeta,
  getAllActivityDates,
  getCurrentSession,
  getOptionalSessions,
  getExerciseLogRows,
  getLoggedExercises,
  getSessionProgress,
  getTodayCompletedSessionName,
  type LoggedExercise,
  type SportMode,
  type SportPlanMeta,
  type SportSessionRow,
} from '@/lib/sport-db';
import {
  bestStreakWeeks,
  buildExerciseSeries,
  currentStreakWeeks,
  filterByRange,
  formatNumber,
  formatShortDate,
  formatWeight,
  isBodyweightSeries,
  metricValue,
  sessionsThisWeek,
  weeklyCounts,
  type Metric,
} from '@/lib/sport-stats';

const WEEKS_SHOWN = 12;

const METRIC_OPTIONS: { value: Metric; label: string }[] = [
  { value: 'max', label: msg('Charge max') },
  { value: 'avg', label: msg('Charge moyenne') },
  { value: 'sets', label: msg('Séries') },
  { value: 'volume', label: msg('Volume') },
  { value: 'reps', label: msg('Répétitions') },
];

// 0 = tout l'historique
const RANGE_OPTIONS = [
  { value: 30, label: msg('30 jours') },
  { value: 90, label: msg('90 jours') },
  { value: 0, label: msg('Tout') },
];

function formatMetric(metric: Metric, value: number): string {
  if (metric === 'sets') return tp(value, '{count} série', '{count} séries');
  if (metric === 'reps') return `${Math.round(value)} reps`;
  if (metric === 'volume') return `${Math.round(value)} kg`;
  return formatWeight(value);
}

export default function SportScreen() {
  const [planMeta, setPlanMeta] = useState<SportPlanMeta | null>(null);
  const [currentSession, setCurrentSession] = useState<{ mode: SportMode; session: SportSessionRow } | null>(null);
  const [completedToday, setCompletedToday] = useState<string | null>(null);
  const [optionalSessions, setOptionalSessions] = useState<SportSessionRow[]>([]);
  const [inProgress, setInProgress] = useState(false);
  const [activityDates, setActivityDates] = useState<string[]>([]);
  const [exercises, setExercises] = useState<LoggedExercise[]>([]);
  const [version, setVersion] = useState(0);
  const [chosenExercise, setChosenExercise] = useState<string | null>(null);
  // Null tant que la personne n'a pas choisi : un exercice au poids du corps suit alors les répétitions.
  const [metricChoice, setMetricChoice] = useState<Metric | null>(null);
  const [range, setRange] = useState(0);
  const [showOptions, setShowOptions] = useState(false);

  const load = useCallback(() => {
    setPlanMeta(getActiveSportPlanMeta());
    const current = getCurrentSession();
    setCurrentSession(current);
    setCompletedToday(getTodayCompletedSessionName());
    setOptionalSessions(getOptionalSessions());
    setInProgress(current ? getSessionProgress(current.session.sessionName) !== null : false);
    setActivityDates(getAllActivityDates());
    setExercises(getLoggedExercises());
    setVersion((value) => value + 1);
  }, []);

  useFocusEffect(load);

  const today = new Date();
  const streak = currentStreakWeeks(activityDates, today);
  const bestStreak = bestStreakWeeks(activityDates);
  const weekSessions = sessionsThisWeek(activityDates, today);
  const weekBars = weeklyCounts(activityDates, WEEKS_SHOWN, today).map((week, index, all) => ({
    label: formatShortDate(week.weekStart),
    value: week.count,
    highlight: index === all.length - 1,
  }));

  // Si l'exercice choisi a disparu (ou n'a jamais été choisi), on prend le plus récent.
  const exerciseName = exercises.find((exercise) => exercise.name === chosenExercise)?.name ?? exercises[0]?.name ?? null;

  // `version` force la relecture quand on revient sur l'écran après une séance.
  const series = useMemo(
    () => (exerciseName ? buildExerciseSeries(getExerciseLogRows(exerciseName)) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [exerciseName, version],
  );
  const metric: Metric = metricChoice ?? (isBodyweightSeries(series) ? 'reps' : 'max');
  const visible = filterByRange(series, range === 0 ? null : range, today);
  // Une mesure absente (répétitions non saisies ce jour-là) n'a pas de point plutôt qu'un faux zéro.
  const points = visible.flatMap((point) => {
    const value = metricValue(point, metric);
    return value === null ? [] : [{ label: formatShortDate(point.date), value }];
  });

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: BottomTabInset + Spacing.three }]}>
          <ThemedView style={styles.titleRow}>
            <ThemedText type="title">{t('Sport')}</ThemedText>
            <SectionIcon name="sport" size={44} />
          </ThemedView>

          {!planMeta && (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="smallBold">{t('Aucun programme importé')}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {t('Importe un programme pour retrouver ta séance du jour ici.')}
              </ThemedText>
              <PressableFeedback onPress={() => router.push('/preferences/sport')}>
                <ThemedView type="accent" style={styles.startButton}>
                  <ThemedText type="link" themeColor="accentOnColor">
                    {t('Importer un programme')}
                  </ThemedText>
                </ThemedView>
              </PressableFeedback>
            </ThemedView>
          )}

          {currentSession && (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="eyebrow" themeColor="textFaint">
                {currentSession.mode === 'fixe'
                  ? t("Aujourd'hui · {weekday}", { weekday: capitalize(weekdayName(getWeekdayLabel())) })
                  : t('Prochaine séance')}
              </ThemedText>
              <ThemedText type="smallBold">{currentSession.session.sessionName}</ThemedText>
              {currentSession.session.isRestDay ? (
                <Tier label={t('Jour de repos')} tone="neutral" />
              ) : (
                <>
                  {completedToday ? (
                    <Tier label={t("Séance faite aujourd'hui")} tone="accent" />
                  ) : (
                    <ThemedText type="small" themeColor="textSecondary">
                      {tp(currentSession.session.exercises.length, '{count} exercice', '{count} exercices')}
                    </ThemedText>
                  )}
                  <PressableFeedback onPress={() => router.push('/live-session')}>
                    <ThemedView
                      type={completedToday && !inProgress ? 'backgroundSelected' : 'accent'}
                      style={styles.startButton}>
                      <ThemedText
                        type="link"
                        themeColor={completedToday && !inProgress ? 'textSecondary' : 'accentOnColor'}>
                        {inProgress ? t('Reprendre la séance') : completedToday ? t('Refaire la séance') : t('Démarrer la séance')}
                      </ThemedText>
                    </ThemedView>
                  </PressableFeedback>
                </>
              )}
            </ThemedView>
          )}

          {optionalSessions.length > 0 && (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="eyebrow" themeColor="textFaint">
                {t('Séances facultatives')}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {t("Quand tu veux, par exemple un jour off : elles ne font pas avancer l'enchaînement.")}
              </ThemedText>
              {optionalSessions.map((optional) => (
                <PressableFeedback
                  key={optional.position}
                  onPress={() => router.push({ pathname: '/live-session', params: { position: String(optional.position) } })}
                  style={styles.optionalRow}>
                  <ThemedView style={styles.optionalText}>
                    <ThemedText type="smallBold">{optional.sessionName}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {tp(optional.exercises.length, '{count} exercice', '{count} exercices')}
                    </ThemedText>
                  </ThemedView>
                  <ThemedText type="link" themeColor="accent">
                    {t('Démarrer ›')}
                  </ThemedText>
                </PressableFeedback>
              ))}
            </ThemedView>
          )}

          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedView style={styles.streakHeader}>
              <ThemedView style={styles.streakMain}>
                <ThemedText style={styles.streakIcon}>{STREAK_ICON}</ThemedText>
                <ThemedText type="data" style={styles.streakNumber}>
                  {streak}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {tp(streak, 'semaine de suite', 'semaines de suite')}
                </ThemedText>
              </ThemedView>
              {bestStreak > 0 && (
                <ThemedText type="small" themeColor="textFaint">
                  {t('Record : {best}', { best: bestStreak })}
                </ThemedText>
              )}
            </ThemedView>

            {weekSessions > 0 ? (
              <ThemedText type="small" themeColor="accent">
                {tp(weekSessions, 'Cette semaine : {count} séance', 'Cette semaine : {count} séances')}
              </ThemedText>
            ) : streak > 0 ? (
              <ThemedText type="small" themeColor="warn">
                {t('Aucune séance cette semaine : fais-en une avant dimanche pour garder ta série.')}
              </ThemedText>
            ) : (
              <ThemedText type="small" themeColor="textSecondary">
                {t('Fais une séance pour lancer ta série.')}
              </ThemedText>
            )}

            <BarChart bars={weekBars} height={96} labelEvery={4} />

            <PressableFeedback onPress={() => router.push('/add-activity')}>
              <ThemedText type="small" themeColor="accent" style={styles.addActivityLink}>
                {t('＋ Ajouter une autre activité')}
              </ThemedText>
            </PressableFeedback>
          </ThemedView>

          <MuscleHeatmapCard version={version} />

          <ThemedView type="backgroundElement" style={styles.card}>
            {exercises.length === 0 ? (
              <ThemedText type="small" themeColor="textSecondary">
                {t('Tes charges apparaîtront ici dès ta première séance avec un poids saisi.')}
              </ThemedText>
            ) : (
              <>
                <ThemedView style={styles.exerciseRow}>
                  <ThemedView style={styles.exerciseChips}>
                    <ChipSingleSelect
                      scrollable
                      options={exercises.map((exercise) => ({ value: exercise.name, label: exercise.name }))}
                      value={exerciseName}
                      onChange={setChosenExercise}
                    />
                  </ThemedView>
                  <PressableFeedback
                    onPress={() => setShowOptions((value) => !value)}
                    hitSlop={Spacing.two}
                    accessibilityLabel={t('Options du graphique')}>
                    <ThemedText themeColor={showOptions ? 'accent' : 'textFaint'} style={styles.optionsDots}>
                      ⋯
                    </ThemedText>
                  </PressableFeedback>
                </ThemedView>

                {showOptions && (
                  <>
                    <ChipSingleSelect label={t('Mesure')} options={METRIC_OPTIONS} value={metric} onChange={setMetricChoice} />
                    <ChipSingleSelect label={t('Période')} options={RANGE_OPTIONS} value={range} onChange={setRange} />
                  </>
                )}

                {points.length > 0 ? (
                  <LineChart
                    key={`${exerciseName}-${metric}-${range}`}
                    points={points}
                    formatValue={(value) => formatMetric(metric, value)}
                    formatAxis={formatNumber}
                    integerAxis={metric === 'sets' || metric === 'reps'}
                  />
                ) : (
                  <ThemedText type="small" themeColor="textSecondary">
                    {visible.length > 0
                      ? t("Les répétitions n'ont pas encore été saisies pour cet exercice.")
                      : t('Aucune séance sur cette période.')}
                  </ThemedText>
                )}
              </>
            )}
          </ThemedView>

          {planMeta && (
            <PressableFeedback onPress={() => router.push('/preferences/sport')}>
              <ThemedText type="small" themeColor="textFaint" style={styles.programLink}>
                {t('Programme : {name} · {mode} — gérer ›', {
                  name: planMeta.name,
                  mode: planMeta.mode === 'fixe' ? t('séances fixes') : t('flux continu'),
                })}
              </ThemedText>
            </PressableFeedback>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const styles = StyleSheet.create({
  optionalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingVertical: Spacing.one,
  },
  optionalText: {
    flex: 1,
    gap: 2,
    backgroundColor: 'transparent',
  },
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    alignItems: 'center',
  },
  scrollView: {
    width: '100%',
  },
  scrollContent: {
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.four,
    backgroundColor: 'transparent',
  },
  card: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  startButton: {
    borderRadius: Spacing.two,
    paddingVertical: Spacing.two,
    alignItems: 'center',
    marginTop: Spacing.one,
  },
  streakHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  streakMain: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.two,
    backgroundColor: 'transparent',
  },
  streakIcon: {
    fontSize: 26,
    lineHeight: 34,
  },
  streakNumber: {
    fontSize: 34,
    lineHeight: 40,
  },
  addActivityLink: {
    paddingVertical: Spacing.one,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: 'transparent',
  },
  exerciseChips: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  optionsDots: {
    fontSize: 22,
    lineHeight: 26,
    paddingHorizontal: Spacing.one,
  },
  programLink: {
    textAlign: 'center',
    paddingVertical: Spacing.one,
  },
});
