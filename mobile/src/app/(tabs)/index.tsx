import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState, Platform, RefreshControl, ScrollView, StyleSheet, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableFeedback } from '@/components/pressable-feedback';
import { getLanguage, t } from '@/i18n';
import { CircularGauge } from '@/components/circular-gauge';
import { Gauge } from '@/components/gauge';
import { MountainImage } from '@/components/mountain-image';
import { SectionIcon } from '@/components/section-icon';
import { SleepModal } from '@/components/sleep-modal';
import { SleepRing } from '@/components/sleep-ring';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useToday } from '@/hooks/use-today';
import { addDays, formatLongDate, getCycleDayForDate, greetingForHour, parseDateString, toDateString } from '@/lib/date';
import {
  getActivePlanMeta,
  getCompletedMealIdsForDate,
  getDayTotals,
  getMealsForCycleDay,
  type DayTotals,
  type Macros,
  type PlanMeta,
} from '@/lib/nutrition-db';
import { progressRatio, sumConsumedMacros } from '@/lib/nutrition-progress';
import { getHealthDay, getLatestSleep, type HealthDay } from '@/lib/health-db';
import type { SleepNight } from '@/lib/sleep';
import { isHealthConnected, syncHealth, syncHealthIfDue } from '@/lib/health-sync';
import { getSetting, setSetting } from '@/lib/settings-db';
import { binsCollectedOn, formatBinList, WASTE_BIN_DEFS } from '@/lib/waste';
import { getWasteBins } from '@/lib/waste-db';

/** Préférence mémorisée : chiffres de l'anneau et des barres affichés ou non. */
const SHOW_DETAILS_KEY = 'today_show_details';

const EMPTY_MACROS: Macros = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 };

/**
 * Écran du jour, volontairement minimal (comme sur la planche d'ambiance) : une salutation, l'anneau
 * des calories, les barres des macros, puis des tuiles qui n'apparaissent que si elles servent ce
 * jour-là (poubelles à sortir, jour de courses), sur le paysage de montagne. Les repas sont dans
 * l'onglet Nutrition.
 */
export default function TodayScreen() {
  const theme = useTheme();
  const { width, height } = useWindowDimensions();
  // Taille de l'anneau : la plus grande qui laisse les barres vers le milieu de l'écran, plafonnée à 280.
  const ringSize = Math.round(Math.min(width - 64, Math.max(232, height * 0.6 - 178), 280));
  const todayString = useToday();
  const [planMeta, setPlanMeta] = useState<PlanMeta | null>(null);
  const [totals, setTotals] = useState<DayTotals | null>(null);
  const [consumed, setConsumed] = useState<Macros>(EMPTY_MACROS);
  const [isShoppingDay, setIsShoppingDay] = useState(false);
  const [health, setHealth] = useState<HealthDay | null>(null);
  const [wasteTonight, setWasteTonight] = useState<string | null>(null);
  const [sleep, setSleep] = useState<SleepNight | null>(null);
  const [sleepOpen, setSleepOpen] = useState(false);
  const [showDetails, setShowDetails] = useState(() => getSetting(SHOW_DETAILS_KEY) === '1');

  function toggleDetails() {
    const next = !showDetails;
    setShowDetails(next);
    setSetting(SHOW_DETAILS_KEY, next ? '1' : '0');
  }

  const today = parseDateString(todayString);

  const load = useCallback(() => {
    const date = parseDateString(todayString);
    const meta = getActivePlanMeta();
    setPlanMeta(meta);
    const cycleDay = meta ? getCycleDayForDate(meta.cycleStartDate, meta.cycleLengthDays, date) : null;
    if (cycleDay !== null) {
      setTotals(getDayTotals(cycleDay));
      setConsumed(sumConsumedMacros(getMealsForCycleDay(cycleDay), getCompletedMealIdsForDate(todayString)));
    } else {
      setTotals(null);
      setConsumed(EMPTY_MACROS);
    }

    // Poubelle à sortir : ramassage demain (rappel du soir) ou aujourd'hui.
    const labelOf = new Map(WASTE_BIN_DEFS.map((def) => [def.id, t(def.reminderLabel)]));
    const bins = getWasteBins();
    const labels = (list: ReturnType<typeof binsCollectedOn>) =>
      formatBinList(list.map((bin) => labelOf.get(bin.id) ?? t('les poubelles')));
    const tomorrowBins = binsCollectedOn(bins, addDays(date, 1));
    const todayBins = binsCollectedOn(bins, date);
    setWasteTonight(
      tomorrowBins.length > 0
        ? t('Sortir {bins}', { bins: labels(tomorrowBins) })
        : todayBins.length > 0
          ? t("Aujourd'hui : {bins}", { bins: labels(todayBins) })
          : null,
    );

    // Pas et calories actives du jour, seulement si Health Connect est connecté.
    setHealth(isHealthConnected() ? getHealthDay(todayString) : null);
    // Dernière nuit : réveil aujourd'hui, ou hier si la nuit n'est pas encore terminée.
    setSleep(isHealthConnected() ? getLatestSleep(toDateString(addDays(date, -1))) : null);

    // Les courses du plan sont groupées par semaine du cycle : on les fait le premier jour de chaque semaine.
    setIsShoppingDay(cycleDay !== null && cycleDay % 7 === 1);
  }, [todayString]);

  useFocusEffect(load);

  // Health Connect : mise à jour discrète quand l'écran reprend le focus et quand l'app revient au premier plan
  // (au plus toutes les 20 minutes, voir `syncHealthIfDue`).
  const syncAndReload = useCallback(() => {
    if (!isHealthConnected()) return;
    void syncHealthIfDue().then((result) => {
      if (result) load();
    });
  }, [load]);
  useFocusEffect(syncAndReload);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') syncAndReload();
    });
    return () => subscription.remove();
  }, [syncAndReload]);

  const [refreshing, setRefreshing] = useState(false);
  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (isHealthConnected()) await syncHealth();
      load();
    } finally {
      setRefreshing(false);
    }
  }, [load]);

  const calorieRatio = totals ? progressRatio(consumed.calories, totals.calories) : 0;

  return (
    <ThemedView style={styles.container}>
      <MountainImage variant="footer" style={styles.mountain} />

      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: BottomTabInset + Spacing.three }]}>
          <ThemedView style={styles.headerRow}>
            <ThemedView style={styles.header}>
              <ThemedText type="small" themeColor="textSecondary">
                {greetingForHour(new Date().getHours())},
              </ThemedText>
              <ThemedText type="title">{t("Aujourd'hui")}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {formatLongDate(today)}
              </ThemedText>
            </ThemedView>
            {Platform.OS === 'android' ? (
              <PressableFeedback
                onPress={() => setSleepOpen(true)}
                hitSlop={Spacing.three}
                style={styles.headerIcon}
                accessibilityLabel={t('Sommeil')}>
                <SleepRing score={sleep?.score ?? null} size={50} thickness={6} fontSize={16} />
              </PressableFeedback>
            ) : (
              // iPhone : pas de lecture du sommeil (Health Connect n'existe que sur Android), on garde l'haltère.
              <PressableFeedback
                onPress={() => router.push('/sport')}
                hitSlop={Spacing.three}
                style={styles.headerIcon}
                accessibilityLabel={t('Sport')}>
                <Ionicons name="barbell" size={41} color={theme.accent} />
              </PressableFeedback>
            )}
          </ThemedView>

          {!planMeta && (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="smallBold">{t('Aucun plan importé')}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {t('Importe un plan nutritionnel pour suivre tes calories et tes macros du jour.')}
              </ThemedText>
              <PressableFeedback onPress={() => router.push('/preferences/nutrition')}>
                <ThemedView type="accent" style={styles.button}>
                  <ThemedText type="link" themeColor="accentOnColor">
                    {t('Importer un plan')}
                  </ThemedText>
                </ThemedView>
              </PressableFeedback>
            </ThemedView>
          )}

          {totals && (
            <>
              <PressableFeedback onPress={toggleDetails} style={[styles.ringWrap, { height: ringSize + 8 }]}>
                <CircularGauge ratio={calorieRatio} size={ringSize} thickness={Math.round(ringSize / 10.5)}>
                  {showDetails ? (
                    <>
                      <ThemedText type="data" style={styles.ringValue}>
                        {Math.round(consumed.calories)}
                      </ThemedText>
                      <ThemedText type="small" themeColor="textFaint">
                        / {Math.round(totals.calories)} kcal
                      </ThemedText>
                    </>
                  ) : (
                    <>
                      <ThemedText type="data" style={styles.ringValue}>
                        {Math.round(calorieRatio * 100)} %
                      </ThemedText>
                      <ThemedText type="eyebrow" themeColor="textFaint">
                        {t('Calories')}
                      </ThemedText>
                    </>
                  )}
                </CircularGauge>
              </PressableFeedback>

              <ThemedView type="backgroundElement" style={[styles.card, styles.bars]}>
                <MacroBar label={t('Protéines')} color="macroProtein" consumed={consumed.protein} planned={totals.protein} details={showDetails} />
                <MacroBar label={t('Glucides')} color="macroCarbs" consumed={consumed.carbs} planned={totals.carbs} details={showDetails} />
                <MacroBar label={t('Lipides')} color="macroFat" consumed={consumed.fat} planned={totals.fat} details={showDetails} />
              </ThemedView>
            </>
          )}

          {health && (
            <ThemedView style={styles.tiles}>
              <ThemedView type="backgroundElement" style={[styles.tilePressable, styles.statTile, { borderColor: theme.line }]}>
                <Ionicons name="footsteps-outline" size={22} color={theme.accent} />
                <ThemedText type="smallBold">{health.steps.toLocaleString(getLanguage() === 'fr' ? 'fr-FR' : 'en-US')}</ThemedText>
                <ThemedText type="eyebrow" themeColor="textFaint">
                  {t('pas')}
                </ThemedText>
              </ThemedView>
              <ThemedView type="backgroundElement" style={[styles.tilePressable, styles.statTile, { borderColor: theme.line }]}>
                <Ionicons name="flame-outline" size={22} color={theme.accent} />
                <ThemedText type="smallBold">{health.activeKcal}</ThemedText>
                <ThemedText type="eyebrow" themeColor="textFaint">
                  {t('kcal actives')}
                </ThemedText>
              </ThemedView>
            </ThemedView>
          )}

          {(wasteTonight || isShoppingDay) && (
            <ThemedView style={styles.tiles}>
              {wasteTonight && (
                <PressableFeedback
                  style={styles.tilePressable}
                  onPress={() => router.push('/preferences/waste')}
                  accessibilityRole="button"
                  accessibilityLabel={wasteTonight}>
                  <ThemedView type="warnWash" style={[styles.tile, { borderColor: theme.warn }]}>
                    <ThemedView style={styles.tileRow}>
                      <SectionIcon name="bins" size={34} />
                      <ThemedText type="smallBold" style={styles.tileText} numberOfLines={3}>
                        {wasteTonight}
                      </ThemedText>
                    </ThemedView>
                  </ThemedView>
                </PressableFeedback>
              )}
              {isShoppingDay && (
                <PressableFeedback
                  style={styles.tilePressable}
                  onPress={() => router.push('/courses')}
                  accessibilityRole="button"
                  accessibilityLabel={t('Jour de courses : liste de courses')}>
                  <ThemedView type="accentWash" style={[styles.tile, { borderColor: theme.accentLine }]}>
                    <SectionIcon name="basket" size={40} />
                  </ThemedView>
                </PressableFeedback>
              )}
            </ThemedView>
          )}
        </ScrollView>
      </SafeAreaView>

      <SleepModal
        visible={sleepOpen}
        night={sleep}
        connected={isHealthConnected()}
        onClose={() => setSleepOpen(false)}
        onConnect={() => {
          setSleepOpen(false);
          router.push('/preferences/health');
        }}
      />
    </ThemedView>
  );
}

function MacroBar({
  label,
  color,
  consumed,
  planned,
  details,
}: {
  label: string;
  color: ThemeColor;
  consumed: number;
  planned: number;
  details: boolean;
}) {
  return (
    <ThemedView style={styles.macro}>
      <ThemedView style={styles.macroHeader}>
        <ThemedText type="small">{label}</ThemedText>
        {details && (
          <ThemedText type="data" themeColor="textSecondary" style={styles.macroNumbers}>
            {Math.round(consumed)} / {Math.round(planned)} g
          </ThemedText>
        )}
      </ThemedView>
      <Gauge ratio={progressRatio(consumed, planned)} height={10} color={color} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  mountain: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 52,
    aspectRatio: 900 / 328,
  },
  tiles: {
    flexDirection: 'row',
    gap: Spacing.three,
    backgroundColor: 'transparent',
  },
  statTile: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    borderRadius: Spacing.three,
    borderWidth: 1,
    paddingVertical: Spacing.three,
  },
  tileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.two,
    backgroundColor: 'transparent',
  },
  tileText: {
    flexShrink: 1,
  },
  tilePressable: {
    flex: 1,
  },
  tile: {
    minHeight: 64,
    borderRadius: Spacing.three,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bars: {
    gap: Spacing.two,
  },
  safeArea: {
    flex: 1,
    alignItems: 'center',
  },
  scrollView: {
    width: '100%',
  },
  scrollContent: {
    flexGrow: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginTop: Spacing.four,
    backgroundColor: 'transparent',
  },
  headerIcon: {
    // Aligné sur le haut du titre, sous la ligne de salutation.
    marginTop: 20,
  },
  header: {
    gap: Spacing.half,
    backgroundColor: 'transparent',
  },
  card: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  button: {
    borderRadius: Spacing.two,
    paddingVertical: Spacing.two,
    alignItems: 'center',
    marginTop: Spacing.one,
  },
  ringWrap: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringValue: {
    fontSize: 38,
    lineHeight: 44,
  },
  macro: {
    gap: Spacing.one,
    backgroundColor: 'transparent',
  },
  macroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    backgroundColor: 'transparent',
  },
  macroNumbers: {
    fontSize: 13,
  },
});
