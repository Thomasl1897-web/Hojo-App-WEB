import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableFeedback } from '@/components/pressable-feedback';
import { t } from '@/i18n';
import { ChipMultiSelect, ChipSingleSelect, FieldGroup, TextField } from '@/components/form-fields';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  buildSportPrompt,
  DAYS_PER_WEEK_OPTIONS,
  EMPTY_SPORT_QUESTIONNAIRE_ANSWERS,
  EQUIPMENT_OPTIONS,
  FITNESS_LEVEL_OPTIONS,
  isMinor,
  SEX_OPTIONS,
  SPORT_MODE_OPTIONS,
  SPORT_OBJECTIVES,
  TRAINING_LOCATION_OPTIONS,
  type SportQuestionnaireAnswers,
} from '@/lib/sport-prompt';

const DAYS_PER_WEEK_SELECT_OPTIONS = DAYS_PER_WEEK_OPTIONS.map((n) => ({ value: n, label: String(n) }));
const EQUIPMENT_SELECT_OPTIONS = EQUIPMENT_OPTIONS.map((item) => ({ value: item, label: item }));
const SPORT_MODE_SELECT_OPTIONS = SPORT_MODE_OPTIONS.map(({ value, label }) => ({ value, label }));

function toggleInArray<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

export default function SportQuestionnaireScreen() {
  const theme = useTheme();
  const [answers, setAnswers] = useState<SportQuestionnaireAnswers>(EMPTY_SPORT_QUESTIONNAIRE_ANSWERS);

  function update<K extends keyof SportQuestionnaireAnswers>(key: K, value: SportQuestionnaireAnswers[K]) {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  }

  async function handleGenerate() {
    const prompt = buildSportPrompt(answers);
    await Clipboard.setStringAsync(prompt);
    Alert.alert(
      t('Prompt copié'),
      t("Colle-le dans ton assistant IA préféré (ChatGPT, Claude, etc.), puis reviens dans Réglages › Sport pour importer sa réponse."),
      [{ text: t('Retour'), onPress: () => router.back() }],
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
          <ThemedText type="small" themeColor="textSecondary">
            {t("Plus tu donnes de détails, plus le programme généré par l'IA sera adapté. Tous les champs sont optionnels.")}
          </ThemedText>

          <FieldGroup title="Profil">
            <TextField label="Âge" value={answers.age} onChangeText={(v) => update('age', v)} placeholder="ex : 32" keyboardType="number-pad" />
            <ChipSingleSelect label="Sexe" options={SEX_OPTIONS} value={answers.sex} onChange={(v) => update('sex', v)} />
            <ChipSingleSelect label="Niveau" options={FITNESS_LEVEL_OPTIONS} value={answers.fitnessLevel} onChange={(v) => update('fitnessLevel', v)} />
            <TextField
              label="Blessures / limitations"
              value={answers.injuriesOrLimitations}
              onChangeText={(v) => update('injuriesOrLimitations', v)}
              placeholder="ex : tendinite épaule droite, genoux fragiles..."
            />
          </FieldGroup>

          {isMinor(answers) && (
            <ThemedView type="warnWash" style={[styles.warningCard, { borderLeftColor: theme.warn }]}>
              <ThemedText type="smallBold">{t('Moins de 18 ans')}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {t('Le prompt généré demandera des charges légères à modérées, sans tentative de charge maximale, avec un encadrement recommandé.')}
              </ThemedText>
            </ThemedView>
          )}

          <FieldGroup title="Organisation">
            <ChipSingleSelect label="Type de programme" options={SPORT_MODE_SELECT_OPTIONS} value={answers.mode} onChange={(v) => update('mode', v)} />
            <ThemedText type="small" themeColor="textSecondary">
              {t(SPORT_MODE_OPTIONS.find((o) => o.value === answers.mode)?.description ?? '')}
            </ThemedText>
          </FieldGroup>

          <FieldGroup title="Objectif & organisation">
            <ChipSingleSelect label="Objectif" options={SPORT_OBJECTIVES} value={answers.objective} onChange={(v) => update('objective', v)} />
            <ChipSingleSelect label="Jours d'entraînement par semaine" options={DAYS_PER_WEEK_SELECT_OPTIONS} value={answers.daysPerWeek} onChange={(v) => update('daysPerWeek', v)} />
            <TextField label="Durée de séance visée (minutes)" value={answers.sessionDurationMinutes} onChangeText={(v) => update('sessionDurationMinutes', v)} placeholder="ex : 45" keyboardType="number-pad" />
            <ChipSingleSelect label="Lieu" options={TRAINING_LOCATION_OPTIONS} value={answers.location} onChange={(v) => update('location', v)} />
            <ChipMultiSelect
              label="Équipement disponible"
              options={EQUIPMENT_SELECT_OPTIONS}
              values={answers.equipment}
              onToggle={(v: string) => update('equipment', toggleInArray(answers.equipment, v))}
            />
            <TextField label="Autre équipement" value={answers.equipmentOther} onChangeText={(v) => update('equipmentOther', v)} placeholder="ex : TRX, corde à sauter..." />
          </FieldGroup>

          <FieldGroup title="Rappels">
            <TextField label="Heure habituelle d'entraînement (HH:MM)" value={answers.preferredTime} onChangeText={(v) => update('preferredTime', v)} placeholder="ex : 18:00" />
            {answers.mode === 'continu' && (
              <ThemedText type="small" themeColor="textSecondary">
                {t("En flux continu, l'app ne peut pas programmer de rappel daté à l'avance (elle ne sait pas quel jour tu feras la prochaine séance) — aucun rappel automatique ne sera envoyé dans ce mode.")}
              </ThemedText>
            )}
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
