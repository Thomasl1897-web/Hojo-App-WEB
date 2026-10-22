import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableFeedback } from '@/components/pressable-feedback';
import { t } from '@/i18n';
import { ChipMultiSelect, ChipSingleSelect, FieldGroup, TextField, ToggleField } from '@/components/form-fields';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { weekdayName } from '@/lib/date';
import { WEEKDAYS, type Weekday } from '@/lib/nutrition-schema';
import {
  ACTIVITY_LEVEL_OPTIONS,
  buildNutritionPrompt,
  CALORIE_STRATEGY_OPTIONS,
  COOKING_SKILL_OPTIONS,
  COOKING_STYLE_OPTIONS,
  CYCLE_LENGTH_OPTIONS,
  DIET_TYPE_OPTIONS,
  EMPTY_QUESTIONNAIRE_ANSWERS,
  FASTING_MODE_OPTIONS,
  isMinor,
  KITCHEN_EQUIPMENT_OPTIONS,
  MAIN_MEALS_PER_DAY_OPTIONS,
  NUTRIENT_FOCUS_OPTIONS,
  NUTRITION_OBJECTIVES,
  PREGNANCY_STATUS_OPTIONS,
  SEX_OPTIONS,
  SNACKS_PER_DAY_OPTIONS,
  type NutritionQuestionnaireAnswers,
} from '@/lib/nutrition-prompt';

const MAIN_MEALS_OPTIONS = MAIN_MEALS_PER_DAY_OPTIONS.map((n) => ({ value: n, label: String(n) }));
const SNACKS_OPTIONS = SNACKS_PER_DAY_OPTIONS.map((n) => ({ value: n, label: String(n) }));
const KITCHEN_EQUIPMENT_SELECT_OPTIONS = KITCHEN_EQUIPMENT_OPTIONS.map((item) => ({ value: item, label: item }));

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function toggleInArray<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

export default function QuestionnaireScreen() {
  const theme = useTheme();
  const weekdayOptions = WEEKDAYS.map((day) => ({ value: day, label: capitalize(weekdayName(day)) }));
  const [answers, setAnswers] = useState<NutritionQuestionnaireAnswers>(EMPTY_QUESTIONNAIRE_ANSWERS);

  function update<K extends keyof NutritionQuestionnaireAnswers>(key: K, value: NutritionQuestionnaireAnswers[K]) {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  }

  async function handleGenerate() {
    const prompt = buildNutritionPrompt(answers);
    await Clipboard.setStringAsync(prompt);
    Alert.alert(
      t('Prompt copié'),
      t("Colle-le dans ton assistant IA préféré (ChatGPT, Claude, etc.), puis reviens dans Réglages › Nutrition pour importer sa réponse."),
      [{ text: t('Retour'), onPress: () => router.back() }],
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <ThemedText type="small" themeColor="textSecondary">
            {t("Plus tu donnes de détails, plus le plan généré par l'IA sera adapté. Tous les champs sont optionnels.")}
          </ThemedText>

          <FieldGroup title="Profil">
            <TextField label="Âge" value={answers.age} onChangeText={(v) => update('age', v)} placeholder="ex : 32" keyboardType="number-pad" />
            <ChipSingleSelect label="Sexe" options={SEX_OPTIONS} value={answers.sex} onChange={(v) => update('sex', v)} />
            <TextField label="Poids" value={answers.weightKg} onChangeText={(v) => update('weightKg', v)} placeholder="ex : 75 kg" keyboardType="numeric" />
            <TextField label="Taille" value={answers.heightCm} onChangeText={(v) => update('heightCm', v)} placeholder="ex : 178 cm" keyboardType="numeric" />
            <TextField label="Pays (pour adapter les aliments disponibles)" value={answers.country} onChangeText={(v) => update('country', v)} placeholder="ex : France" />
          </FieldGroup>

          {isMinor(answers) && (
            <ThemedView type="warnWash" style={[styles.warningCard, { borderLeftColor: theme.warn }]}>
              <ThemedText type="smallBold">{t('Moins de 18 ans')}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {t('Le prompt généré demandera un plan couvrant les besoins de croissance, sans aucune restriction calorique. Un suivi par un médecin ou un diététicien est indispensable avant toute démarche de perte de poids à cet âge.')}
              </ThemedText>
            </ThemedView>
          )}

          <FieldGroup title="Santé & sécurité">
            <TextField
              label="Problèmes de santé ou traitements en cours"
              value={answers.medicalConditions}
              onChangeText={(v) => update('medicalConditions', v)}
              placeholder="ex : diabète type 2, hypertension, cholestérol..."
            />
            <ChipSingleSelect
              label="Grossesse / allaitement"
              options={PREGNANCY_STATUS_OPTIONS}
              value={answers.pregnancyStatus}
              onChange={(v) => update('pregnancyStatus', v)}
            />
          </FieldGroup>

          <FieldGroup title="Objectif & activité">
            <ChipSingleSelect label="Objectif" options={NUTRITION_OBJECTIVES} value={answers.objective} onChange={(v) => update('objective', v)} />
            <ChipSingleSelect label="Niveau d'activité" options={ACTIVITY_LEVEL_OPTIONS} value={answers.activityLevel} onChange={(v) => update('activityLevel', v)} />
            <ChipSingleSelect
              label="Gestion des calories selon l'activité du jour"
              options={CALORIE_STRATEGY_OPTIONS}
              value={answers.calorieStrategy}
              onChange={(v) => update('calorieStrategy', v)}
            />
          </FieldGroup>

          <FieldGroup title="Régime alimentaire">
            <ChipSingleSelect label="Type de régime" options={DIET_TYPE_OPTIONS} value={answers.dietType} onChange={(v) => update('dietType', v)} />
            <ChipSingleSelect label="Jeûne intermittent" options={FASTING_MODE_OPTIONS} value={answers.fastingMode} onChange={(v) => update('fastingMode', v)} />
            <ChipSingleSelect label="Focus nutritionnel" options={NUTRIENT_FOCUS_OPTIONS} value={answers.nutrientFocus} onChange={(v) => update('nutrientFocus', v)} />
            <TextField label="Allergies / intolérances" value={answers.restrictions} onChangeText={(v) => update('restrictions', v)} placeholder="ex : intolérant au lactose, sans gluten..." />
            <TextField label="Aliments à éviter" value={answers.dislikedFoods} onChangeText={(v) => update('dislikedFoods', v)} placeholder="ex : poisson, champignons..." />
            <TextField label="Préférences (aliments aimés, style de cuisine...)" value={answers.preferences} onChangeText={(v) => update('preferences', v)} placeholder="ex : cuisine méditerranéenne..." />
          </FieldGroup>

          <FieldGroup title="Organisation">
            <ChipSingleSelect label="Durée du cycle avant de reprendre" options={CYCLE_LENGTH_OPTIONS} value={answers.cycleLengthDays} onChange={(v) => update('cycleLengthDays', v)} />
            <ChipSingleSelect label="Jour des courses" options={weekdayOptions} value={answers.groceryDay} onChange={(v) => update('groceryDay', v)} />
            <TextField label="Budget courses" value={answers.groceryBudget} onChangeText={(v) => update('groceryBudget', v)} placeholder="ex : 80€/semaine" />
            <ChipSingleSelect label="Mode de cuisine" options={COOKING_STYLE_OPTIONS} value={answers.cookingStyle} onChange={(v) => update('cookingStyle', v)} />
            <ChipSingleSelect label="Niveau en cuisine" options={COOKING_SKILL_OPTIONS} value={answers.cookingSkill} onChange={(v) => update('cookingSkill', v)} />
            <ChipMultiSelect
              label="Équipement de cuisine disponible"
              options={KITCHEN_EQUIPMENT_SELECT_OPTIONS}
              values={answers.kitchenEquipment}
              onToggle={(v: string) => update('kitchenEquipment', toggleInArray(answers.kitchenEquipment, v))}
            />
            <TextField label="Autre équipement" value={answers.kitchenEquipmentOther} onChangeText={(v) => update('kitchenEquipmentOther', v)} placeholder="ex : spiralizer, yaourtière..." />
          </FieldGroup>

          <FieldGroup title="Repas & flexibilité">
            <ThemedText type="small" themeColor="textSecondary">
              {t("Les repas principaux sont les repas complets (petit-déj, déjeuner, dîner...). Les collations sont des en-cas entre les repas — indique 0 si tu n'en veux pas.")}
            </ThemedText>
            <ChipSingleSelect label="Repas principaux par jour" options={MAIN_MEALS_OPTIONS} value={answers.mainMealsPerDay} onChange={(v) => update('mainMealsPerDay', v)} />
            <ChipSingleSelect label="Collations par jour" options={SNACKS_OPTIONS} value={answers.snacksPerDay} onChange={(v) => update('snacksPerDay', v)} />
            <TextField label="Temps de préparation max — petit-déjeuner" value={answers.breakfastPrepTime} onChangeText={(v) => update('breakfastPrepTime', v)} placeholder="ex : 10 min" />
            <TextField label="Temps de préparation max — autres repas" value={answers.generalPrepTime} onChangeText={(v) => update('generalPrepTime', v)} placeholder="ex : 20 min" />
            <ChipMultiSelect
              label="Jours où tu veux des restes de la veille"
              options={weekdayOptions}
              values={answers.leftoverDays}
              onToggle={(v: Weekday) => update('leftoverDays', toggleInArray(answers.leftoverDays, v))}
            />
            <ToggleField
              label="Le dîner doit prévoir une portion en plus pour le déjeuner du lendemain"
              value={answers.wantsLunchLeftoversNextDay}
              onChange={(v) => update('wantsLunchLeftoversNextDay', v)}
            />
            <ChipMultiSelect
              label={'Jours "repas libre" (restaurant, sortie...)'}
              options={weekdayOptions}
              values={answers.flexMealDays}
              onToggle={(v: Weekday) => update('flexMealDays', toggleInArray(answers.flexMealDays, v))}
            />
          </FieldGroup>

          <PressableFeedback onPress={handleGenerate}>
            <ThemedView type="accent" style={styles.generateButton}>
              <ThemedText type="link" themeColor="accentOnColor">
                {t('Générer et copier le prompt')}
              </ThemedText>
            </ThemedView>
          </PressableFeedback>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  scrollView: {
    width: '100%',
  },
  scrollContent: {
    padding: Spacing.four,
    gap: Spacing.four,
  },
  generateButton: {
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    marginBottom: Spacing.four,
  },
  warningCard: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.one,
    borderLeftWidth: 3,
  },
});
