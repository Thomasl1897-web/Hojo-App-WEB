import Ionicons from "@expo/vector-icons/Ionicons";
import { router, useFocusEffect } from "expo-router";
import { Image } from "expo-image";
import { useCallback, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AnimatedCheckbox } from "@/components/animated-checkbox";
import { PressableFeedback } from "@/components/pressable-feedback";
import { Reveal } from "@/components/reveal";
import { t } from "@/i18n";
import { DatePickerModal } from "@/components/date-picker-modal";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import {
  BottomTabInset,
  MaxContentWidth,
  ModalOverlay,
  Spacing,
} from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { useToday } from "@/hooks/use-today";
import { daysBetween } from "@/lib/calendar";
import {
  addDays,
  formatLongDate,
  formatShortDay,
  getCycleDayForDate,
  parseDateString,
  toDateString,
} from "@/lib/date";
import {
  baseSlotName,
  mealSlotKind,
  type MealSlotKind,
} from "@/lib/meal-slots";
import {
  getActivePlanMeta,
  getCompletedMealIdsForDate,
  getMealsForCycleDay,
  setMealCompletion,
  type MealRow,
  type PlanMeta,
} from "@/lib/nutrition-db";

/** Jusqu'où le calendrier et les flèches permettent d'aller dans le passé / le futur. */
const MAX_DAYS_BACK = 90;
const MAX_DAYS_AHEAD = 90;

/** Image générique par famille de créneau (en attendant d'éventuelles images propres aux recettes). */
const MEAL_IMAGES: Record<MealSlotKind, number> = {
  breakfast: require("@/assets/images/meals/breakfast.png"),
  lunch: require("@/assets/images/meals/lunch.png"),
  snack: require("@/assets/images/meals/snack.png"),
  dinner: require("@/assets/images/meals/dinner.png"),
  evening: require("@/assets/images/meals/evening.png"),
};

function formatMealMacros(macros: NonNullable<MealRow["macros"]>): string {
  return `${Math.round(macros.calories)} kcal · ${Math.round(macros.protein)}${t("P")} · ${Math.round(macros.carbs)}${t("G")} · ${Math.round(macros.fat)}${t("L")}`;
}

export default function NutritionScreen() {
  const theme = useTheme();
  const todayString = useToday();
  const [dayOffset, setDayOffset] = useState(0);
  // Quand le jour change (minuit, retour de l'app après une nuit), on revient sur le nouvel
  // "aujourd'hui" : garder un décalage de +1 afficherait sinon le surlendemain.
  const [seenToday, setSeenToday] = useState(todayString);
  if (seenToday !== todayString) {
    setSeenToday(todayString);
    setDayOffset(0);
  }

  const [calendarOpen, setCalendarOpen] = useState(false);
  const [planMeta, setPlanMeta] = useState<PlanMeta | null>(null);
  const [cycleDay, setCycleDay] = useState<number | null>(null);
  const [meals, setMeals] = useState<MealRow[]>([]);
  const [completedIds, setCompletedIds] = useState<Set<number>>(new Set());
  const [openMeal, setOpenMeal] = useState<MealRow | null>(null);

  const todayDate = parseDateString(todayString);
  const viewedDate = addDays(todayDate, dayOffset);
  const viewedDateString = toDateString(viewedDate);
  // Un jour à venir se consulte (repas, courses à prévoir) mais ne se coche pas.
  const isFuture = dayOffset > 0;

  const load = useCallback(() => {
    const meta = getActivePlanMeta();
    setPlanMeta(meta);
    const date = addDays(parseDateString(todayString), dayOffset);
    if (meta) {
      const day = getCycleDayForDate(
        meta.cycleStartDate,
        meta.cycleLengthDays,
        date,
      );
      setCycleDay(day);
      setMeals(getMealsForCycleDay(day));
    } else {
      setCycleDay(null);
      setMeals([]);
    }
    setCompletedIds(getCompletedMealIdsForDate(toDateString(date)));
  }, [dayOffset, todayString]);

  useFocusEffect(load);

  function toggleMeal(mealId: number) {
    if (isFuture) return;
    const isCompleted = completedIds.has(mealId);
    setMealCompletion(mealId, viewedDateString, !isCompleted);
    const next = new Set(completedIds);
    if (isCompleted) next.delete(mealId);
    else next.add(mealId);
    setCompletedIds(next);
  }

  const chipLabel =
    dayOffset === 0
      ? t("Aujourd'hui")
      : dayOffset === 1
        ? t("Demain")
        : dayOffset === -1
          ? t("Hier")
          : formatShortDay(viewedDate);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: BottomTabInset + Spacing.three },
          ]}
        >
          <ThemedView style={styles.header}>
            <ThemedView style={styles.headerText}>
              <ThemedText type="title">{t("Nutrition")}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {t("Alimente tes performances")}
              </ThemedText>
            </ThemedView>

            {planMeta && (
              <ThemedView style={styles.dateControls}>
                <PressableFeedback
                  onPress={() =>
                    setDayOffset((offset) =>
                      Math.max(-MAX_DAYS_BACK, offset - 1),
                    )
                  }
                  disabled={dayOffset <= -MAX_DAYS_BACK}
                  hitSlop={Spacing.two}
                  accessibilityLabel={t("Jour précédent")}
                >
                  <Ionicons
                    name="chevron-back"
                    size={22}
                    color={
                      dayOffset <= -MAX_DAYS_BACK ? theme.line : theme.accent
                    }
                  />
                </PressableFeedback>
                <PressableFeedback
                  onPress={() => setCalendarOpen(true)}
                  accessibilityLabel={t("Choisir une date")}
                >
                  <ThemedView
                    type="backgroundElement"
                    style={[styles.chip, { borderColor: theme.line }]}
                  >
                    <Ionicons
                      name="calendar-outline"
                      size={16}
                      color={theme.accent}
                    />
                    <ThemedText type="small">{chipLabel}</ThemedText>
                    <Ionicons
                      name="chevron-down"
                      size={14}
                      color={theme.textFaint}
                    />
                  </ThemedView>
                </PressableFeedback>
                <PressableFeedback
                  onPress={() =>
                    setDayOffset((offset) =>
                      Math.min(MAX_DAYS_AHEAD, offset + 1),
                    )
                  }
                  disabled={dayOffset >= MAX_DAYS_AHEAD}
                  hitSlop={Spacing.two}
                  accessibilityLabel={t("Jour suivant")}
                >
                  <Ionicons
                    name="chevron-forward"
                    size={22}
                    color={
                      dayOffset >= MAX_DAYS_AHEAD ? theme.line : theme.accent
                    }
                  />
                </PressableFeedback>
              </ThemedView>
            )}
          </ThemedView>

          {!planMeta && (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="smallBold">
                {t("Aucun plan importé")}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {t(
                  "Importe un plan nutritionnel pour retrouver tes repas du jour.",
                )}
              </ThemedText>
              <PressableFeedback
                onPress={() => router.push("/preferences/nutrition")}
              >
                <ThemedView type="accent" style={styles.button}>
                  <ThemedText type="link" themeColor="accentOnColor">
                    {t("Importer un plan")}
                  </ThemedText>
                </ThemedView>
              </PressableFeedback>
            </ThemedView>
          )}

          {planMeta && (
            <ThemedView style={styles.dayInfo}>
              <ThemedText type="smallBold">
                {formatLongDate(viewedDate)}
                {cycleDay && planMeta.cycleLengthDays > 7
                  ? ` — ${t("semaine {week} sur {total}", { week: Math.ceil(cycleDay / 7), total: planMeta.cycleLengthDays / 7 })}`
                  : ""}
              </ThemedText>
            </ThemedView>
          )}

          {planMeta && meals.length === 0 && (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="smallBold">
                {dayOffset === 0
                  ? t("Rien de prévu aujourd'hui")
                  : t("Rien de prévu ce jour-là")}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {t(
                  "Le plan « {name} » ne contient aucun repas pour ce jour du cycle.",
                  { name: planMeta.name },
                )}
              </ThemedText>
            </ThemedView>
          )}

          {meals.map((meal, index) => {
            const isCompleted = completedIds.has(meal.id);
            return (
              <Reveal key={`${viewedDateString}-${meal.id}`} index={index}>
                <ThemedView
                  type="backgroundElement"
                  style={[styles.mealCard, isCompleted && { opacity: 0.6 }]}
                >
                  <PressableFeedback
                    onPress={() => setOpenMeal(meal)}
                    style={styles.mealRow}
                  >
                    <Image
                      source={MEAL_IMAGES[mealSlotKind(meal.slotName)]}
                      style={styles.mealImage}
                      contentFit="cover"
                    />
                    <ThemedView style={styles.mealText}>
                      <ThemedText
                        type="subtitle"
                        style={[
                          styles.mealTitle,
                          isCompleted && styles.strikethrough,
                        ]}
                      >
                        {t(baseSlotName(meal.slotName))}
                      </ThemedText>
                      {meal.macros && (
                        <ThemedText
                          type="data"
                          themeColor="textFaint"
                          style={styles.macros}
                          numberOfLines={1}
                        >
                          {formatMealMacros(meal.macros)}
                        </ThemedText>
                      )}
                    </ThemedView>
                    {!isFuture && (
                      <PressableFeedback
                        onPress={() => toggleMeal(meal.id)}
                        haptic="light"
                        hitSlop={Spacing.two}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: isCompleted }}
                        accessibilityLabel={t("{meal} fait", {
                          meal: t(meal.slotName),
                        })}
                      >
                        <AnimatedCheckbox checked={isCompleted} />
                      </PressableFeedback>
                    )}
                  </PressableFeedback>
                </ThemedView>
              </Reveal>
            );
          })}

          {planMeta && (
            <ThemedView style={styles.actions}>
              <PressableFeedback
                style={styles.actionPrimary}
                onPress={() => router.push("/courses")}
              >
                <ThemedView type="accent" style={styles.actionButton}>
                  <Ionicons
                    name="basket-outline"
                    size={20}
                    color={theme.accentOnColor}
                  />
                  <ThemedText type="link" themeColor="accentOnColor">
                    {t("Liste de courses")}
                  </ThemedText>
                </ThemedView>
              </PressableFeedback>
              <PressableFeedback
                style={styles.actionSecondary}
                onPress={() => router.push("/preferences/nutrition")}
              >
                <ThemedView
                  type="backgroundElement"
                  style={[
                    styles.actionButton,
                    { borderColor: theme.line, borderWidth: 1 },
                  ]}
                >
                  <ThemedText type="small" themeColor="textSecondary">
                    {t("Gérer le plan")}
                  </ThemedText>
                </ThemedView>
              </PressableFeedback>
            </ThemedView>
          )}
        </ScrollView>
      </SafeAreaView>

      <Modal
        visible={openMeal !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setOpenMeal(null)}
      >
        <Pressable style={styles.backdrop} onPress={() => setOpenMeal(null)}>
          <Pressable onPress={() => {}} style={styles.popupWrapper}>
            {openMeal && (
              <ThemedView type="backgroundElement" style={styles.popup}>
                <ThemedView style={styles.popupHeader}>
                  <ThemedText type="eyebrow" themeColor="accent">
                    {t(openMeal.slotName)}
                  </ThemedText>
                  <PressableFeedback
                    onPress={() => setOpenMeal(null)}
                    hitSlop={Spacing.three}
                    accessibilityLabel={t("Fermer")}
                  >
                    <Ionicons
                      name="close"
                      size={24}
                      color={theme.textSecondary}
                    />
                  </PressableFeedback>
                </ThemedView>
                <ThemedText type="subtitle" style={styles.popupTitle}>
                  {openMeal.dishName}
                </ThemedText>
                {openMeal.macros && (
                  <ThemedText
                    type="data"
                    themeColor="textSecondary"
                    style={styles.popupMacros}
                  >
                    {formatMealMacros(openMeal.macros)}
                  </ThemedText>
                )}
                <ScrollView
                  style={styles.popupList}
                  contentContainerStyle={styles.popupListContent}
                >
                  {openMeal.ingredients.length > 0 ? (
                    <>
                      <ThemedText type="eyebrow" themeColor="textFaint">
                        {t("Ingrédients")}
                      </ThemedText>
                      {openMeal.ingredients.map((item, index) => (
                        <ThemedText
                          key={index}
                          type="small"
                          themeColor="textSecondary"
                        >
                          {item.name} — {item.quantity}
                        </ThemedText>
                      ))}
                    </>
                  ) : (
                    <ThemedText type="small" themeColor="textSecondary">
                      {t("Repas libre : pas d'ingrédients dans le plan.")}
                    </ThemedText>
                  )}
                  {openMeal.steps.length > 0 && (
                    <>
                      <ThemedText
                        type="eyebrow"
                        themeColor="textFaint"
                        style={styles.popupSection}
                      >
                        {t("Préparation")}
                      </ThemedText>
                      {openMeal.steps.map((step, index) => (
                        <ThemedText
                          key={index}
                          type="small"
                          themeColor="textSecondary"
                        >
                          {index + 1}. {step}
                        </ThemedText>
                      ))}
                    </>
                  )}
                </ScrollView>
              </ThemedView>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      <DatePickerModal
        visible={calendarOpen}
        selected={viewedDate}
        today={todayDate}
        maxDaysBack={MAX_DAYS_BACK}
        maxDaysAhead={MAX_DAYS_AHEAD}
        onSelect={(date) => {
          setDayOffset(daysBetween(todayDate, date));
          setCalendarOpen(false);
        }}
        onClose={() => setCalendarOpen(false)}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    alignItems: "center",
  },
  scrollView: {
    width: "100%",
  },
  scrollContent: {
    width: "100%",
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.two,
    marginTop: Spacing.four,
    backgroundColor: "transparent",
  },
  headerText: {
    flexShrink: 1,
    gap: Spacing.half,
    backgroundColor: "transparent",
  },
  dateControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.one,
    backgroundColor: "transparent",
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.one,
    borderRadius: 20,
    borderWidth: 1,
    paddingVertical: Spacing.one + 2,
    paddingHorizontal: Spacing.three,
  },
  dayInfo: {
    gap: Spacing.half,
    backgroundColor: "transparent",
  },
  card: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  button: {
    borderRadius: Spacing.two,
    paddingVertical: Spacing.two,
    alignItems: "center",
    marginTop: Spacing.one,
  },
  mealCard: {
    borderRadius: Spacing.four,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  mealImage: {
    width: 68,
    height: 68,
    borderRadius: 34,
  },
  mealTitle: {
    fontSize: 20,
    lineHeight: 26,
  },
  actions: {
    flexDirection: "row",
    gap: Spacing.two,
    backgroundColor: "transparent",
  },
  actionPrimary: {
    flex: 3,
  },
  actionSecondary: {
    flex: 2,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.two,
    borderRadius: 28,
    paddingVertical: Spacing.three,
  },
  mealRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two + 4,
  },
  mealText: {
    flex: 1,
    gap: Spacing.half,
    backgroundColor: "transparent",
  },
  macros: {
    fontSize: 10,
    letterSpacing: -0.4,
  },
  backdrop: {
    flex: 1,
    backgroundColor: ModalOverlay,
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.four,
  },
  popupWrapper: {
    width: "100%",
    maxWidth: 380,
  },
  popup: {
    borderRadius: Spacing.four,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  popupHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "transparent",
  },
  popupSection: {
    marginTop: Spacing.two,
  },
  popupTitle: {
    fontSize: 24,
    lineHeight: 30,
  },
  popupMacros: {
    fontSize: 12,
  },
  popupList: {
    maxHeight: 420,
    marginTop: Spacing.one,
  },
  popupListContent: {
    gap: Spacing.one,
  },
  strikethrough: {
    textDecorationLine: "line-through",
  },
});
