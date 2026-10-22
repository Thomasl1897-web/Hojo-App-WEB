import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, TextInput } from 'react-native';

import { PressableFeedback } from '@/components/pressable-feedback';
import { t, tp } from '@/i18n';
import { ChipSingleSelect, FieldGroup } from '@/components/form-fields';
import { PreferenceScreen } from '@/components/preference-screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getCycleDayForDate, getWeekdayOfDateString, weekdayName } from '@/lib/date';
import {
  ensureNotificationSetup,
  NOTIFICATIONS_AVAILABLE,
  requestNotificationPermission,
  rescheduleAllNotifications,
  rescheduleIfPermitted,
} from '@/lib/notifications';
import { savePlanSource } from '@/lib/backup';
import { verifyPlanInvariants } from '@/lib/nutrition-invariants';
import {
  getActivePlanMeta,
  getAllMeals,
  importNutritionPlan,
  resetCycleStart,
  setCycleStart,
  type PlanMeta,
} from '@/lib/nutrition-db';
import { nutritionGenericPrompt } from '@/lib/nutrition-prompt';
import { parseNutritionPlan, WEEKDAYS } from '@/lib/nutrition-schema';
import { getActiveSportPlanMeta } from '@/lib/sport-db';

export default function NutritionPreferencesScreen() {
  const theme = useTheme();
  const [planMeta, setPlanMeta] = useState<PlanMeta | null>(null);
  const [mealCount, setMealCount] = useState(0);
  const [jsonInput, setJsonInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [showPasteFallback, setShowPasteFallback] = useState(false);
  // Replié par défaut si un plan est déjà actif : l'essentiel (obtenir / importer) est fait.
  const [showImport, setShowImport] = useState(() => !getActivePlanMeta());
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(() => {
    setPlanMeta(getActivePlanMeta());
    setMealCount(getAllMeals().length);
  }, []);
  useFocusEffect(load);

  async function copyToClipboard(text: string) {
    await Clipboard.setStringAsync(text);
    Alert.alert(
      t('Copié'),
      t("Colle ce prompt dans ton assistant IA préféré (ChatGPT, Claude, etc.), puis récupère le fichier .json qu'il génère pour l'importer ici."),
    );
  }

  /** Import commun au fichier et au collage manuel. */
  async function importFromText(raw: string) {
    setError(null);
    const result = parseNutritionPlan(raw);
    if (!result.success) {
      setError(result.error);
      return;
    }

    const violations = verifyPlanInvariants(result.data);
    const errors = violations.filter((v) => v.severity === 'error');
    const warnings = violations.filter((v) => v.severity === 'warning');

    if (errors.length > 0) {
      setError(
        tp(
          errors.length,
          '{count} incohérence détectée dans le plan, à corriger avant import :',
          '{count} incohérences détectées dans le plan, à corriger avant import :',
        ) +
          '\n\n' +
          errors
            .slice(0, 5)
            .map((v) => `• ${v.message}`)
            .join('\n') +
          (errors.length > 5 ? `\n${tp(errors.length - 5, '… et {count} autre.', '… et {count} autres.')}` : ''),
      );
      return;
    }

    setImporting(true);
    try {
      importNutritionPlan(result.data);
      savePlanSource('nutrition', raw);

      await ensureNotificationSetup();
      const granted = await requestNotificationPermission();
      if (granted) {
        await rescheduleAllNotifications(getActivePlanMeta(), getActiveSportPlanMeta());
      }

      setJsonInput('');
      setShowPasteFallback(false);
      setShowImport(false);
      load();

      const warningNote = warnings.length ? `\n\n⚠️ ${warnings.map((w) => w.message).join(' ')}` : '';
      Alert.alert(
        t('Plan importé'),
        (!NOTIFICATIONS_AVAILABLE
          ? t("« {name} » est actif. Les rappels sont indisponibles dans Expo Go (ils fonctionnent dans une vraie installation de l'app).", { name: result.data.name })
          : granted
            ? t('« {name} » est actif. Les rappels de repas sont programmés.', { name: result.data.name })
            : t('« {name} » est actif. Autorise les notifications pour recevoir les rappels de repas.', { name: result.data.name })) +
          warningNote,
      );
    } finally {
      setImporting(false);
    }
  }

  // Venu de l'accueil (« J'ai déjà un plan ») : le sélecteur de fichier s'ouvre tout de suite, une seule fois.
  const { pick } = useLocalSearchParams<{ pick?: string }>();
  const pickRequested = useRef(pick === '1');
  useEffect(() => {
    if (!pickRequested.current) return;
    pickRequested.current = false;
    void handlePickFile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handlePickFile() {
    setError(null);
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        // Certaines apps exposent le .json sous un type générique : on reste large et on
        // laisse le parseur juger du contenu.
        type: ['application/json', 'text/plain', '*/*'],
        copyToCacheDirectory: true,
      });

      if (picked.canceled || !picked.assets?.length) return;

      const content = await new File(picked.assets[0].uri).text();
      await importFromText(content);
    } catch (e) {
      setError(t('Impossible de lire le fichier : {error}', { error: e instanceof Error ? e.message : String(e) }));
    }
  }

  async function changeCycleStart(startWeekday: string, cycleWeek: number) {
    setCycleStart(startWeekday, cycleWeek);
    const rescheduled = await rescheduleIfPermitted();
    load();
    setMessage(rescheduled ? t('Cycle mis à jour, rappels reprogrammés.') : t('Cycle mis à jour.'));
  }

  async function resetCycle() {
    resetCycleStart();
    const rescheduled = await rescheduleIfPermitted();
    load();
    setMessage(
      rescheduled
        ? t("Le début du cycle est de nouveau le jour d'import du plan, rappels reprogrammés.")
        : t("Le début du cycle est de nouveau le jour d'import du plan."),
    );
  }

  const todayCycleDay = planMeta ? getCycleDayForDate(planMeta.cycleStartDate, planMeta.cycleLengthDays) : null;
  const startWeekday = planMeta ? getWeekdayOfDateString(planMeta.cycleStartDate) : null;
  const weekCount = planMeta ? planMeta.cycleLengthDays / 7 : 1;
  const currentWeek = todayCycleDay ? Math.ceil(todayCycleDay / 7) : 1;
  const weekdayOptions = WEEKDAYS.map((day) => {
    const name = weekdayName(day);
    return { value: day as string, label: name.charAt(0).toUpperCase() + name.slice(1) };
  });
  const weekOptions = Array.from({ length: weekCount }, (_, index) => ({
    value: index + 1,
    label: t('Semaine {number}', { number: index + 1 }),
  }));

  return (
    <PreferenceScreen>
      <ThemedView type="backgroundElement" style={styles.statusCard}>
        {planMeta ? (
          <>
            <ThemedText type="smallBold">{t('Plan actif : {name}', { name: planMeta.name })}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {t('{meals} repas programmés sur le cycle de {days} jours', { meals: mealCount, days: planMeta.cycleLengthDays })}
            </ThemedText>
          </>
        ) : (
          <ThemedText type="small" themeColor="textSecondary">
            {t("Aucun plan importé pour l'instant")}
          </ThemedText>
        )}
      </ThemedView>

      {planMeta && !showImport && (
        <PressableFeedback onPress={() => setShowImport(true)}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.toggleLink}>
            {t('Remplacer le plan')}
          </ThemedText>
        </PressableFeedback>
      )}

      {showImport && (
        <>
          {planMeta && (
            <PressableFeedback onPress={() => setShowImport(false)}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.toggleLink}>
                {t('Annuler')}
              </ThemedText>
            </PressableFeedback>
          )}

          <ThemedView style={styles.section}>
            <ThemedText type="smallBold">{t('1. Obtenir un plan')}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {t('Copie un prompt et colle-le dans un assistant IA (ChatGPT, Claude...). Il te renverra un fichier .json à télécharger, puis à importer ci-dessous.')}
            </ThemedText>

            <PressableFeedback onPress={() => copyToClipboard(nutritionGenericPrompt())}>
              <ThemedView type="backgroundElement" style={styles.button}>
                <ThemedText type="link">{t('Copier le prompt générique')}</ThemedText>
              </ThemedView>
            </PressableFeedback>

            <PressableFeedback onPress={() => router.push('/questionnaire')}>
              <ThemedView type="backgroundElement" style={styles.button}>
                <ThemedText type="link">{t('Personnaliser via un questionnaire détaillé')}</ThemedText>
              </ThemedView>
            </PressableFeedback>
          </ThemedView>

          <ThemedView style={styles.section}>
            <ThemedText type="smallBold">{t('2. Importer le plan')}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {t("Sélectionne le fichier .json téléchargé depuis l'assistant IA.")}
            </ThemedText>

            <PressableFeedback onPress={handlePickFile} disabled={importing}>
              <ThemedView type="accent" style={[styles.button, importing && styles.buttonDisabled]}>
                <ThemedText type="link" themeColor="accentOnColor">
                  {importing ? t('Import en cours…') : t('Choisir un fichier .json')}
                </ThemedText>
              </ThemedView>
            </PressableFeedback>

            {error && (
              <ThemedText type="small" themeColor="danger">
                {error}
              </ThemedText>
            )}

            <PressableFeedback onPress={() => setShowPasteFallback((value) => !value)}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.toggleLink}>
                {showPasteFallback ? t('Masquer le collage manuel') : t('Ou coller le JSON manuellement')}
              </ThemedText>
            </PressableFeedback>

            {showPasteFallback && (
              <>
                <TextInput
                  value={jsonInput}
                  onChangeText={setJsonInput}
                  placeholder={t("Colle ici la réponse JSON de l'assistant IA")}
                  placeholderTextColor={theme.textSecondary}
                  multiline
                  style={[
                    styles.textInput,
                    { color: theme.text, borderColor: theme.textSecondary, backgroundColor: theme.backgroundElement },
                  ]}
                />
                <PressableFeedback
                  onPress={() => importFromText(jsonInput.trim())}
                  disabled={importing || jsonInput.trim().length === 0}>
                  <ThemedView
                    type="accent"
                    style={[styles.button, (importing || jsonInput.trim().length === 0) && styles.buttonDisabled]}>
                    <ThemedText type="link" themeColor="accentOnColor">
                      {importing ? t('Import en cours…') : t('Importer le texte collé')}
                    </ThemedText>
                  </ThemedView>
                </PressableFeedback>
              </>
            )}
          </ThemedView>
        </>
      )}

      {planMeta && startWeekday && (
        <ThemedView type="backgroundElement" style={styles.card}>
          <FieldGroup title="Cycle du plan">
            <ThemedText type="small" themeColor="textSecondary">
              {t("Ton plan dure {days} jours. Indique le jour de la semaine où il commence : en général le jour des courses ou du batch cooking. Par défaut, c'est le jour où tu as importé le plan.", { days: planMeta.cycleLengthDays })}
            </ThemedText>
            <ChipSingleSelect
              label="Le cycle commence un…"
              options={weekdayOptions}
              value={startWeekday}
              onChange={(day) => changeCycleStart(day, currentWeek)}
            />
            {weekCount > 1 && (
              <ChipSingleSelect
                label="Cette semaine, tu en es à la…"
                options={weekOptions}
                value={currentWeek}
                onChange={(week) => changeCycleStart(startWeekday, week)}
              />
            )}
            {message && (
              <ThemedText type="small" themeColor="accent">
                {message}
              </ThemedText>
            )}
            <PressableFeedback onPress={resetCycle}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.toggleLink}>
                {t("Rétablir (début = jour d'import)")}
              </ThemedText>
            </PressableFeedback>
          </FieldGroup>
        </ThemedView>
      )}
    </PreferenceScreen>
  );
}

const styles = StyleSheet.create({
  statusCard: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  card: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  section: {
    gap: Spacing.two,
    backgroundColor: 'transparent',
  },
  button: {
    borderRadius: Spacing.two,
    paddingVertical: Spacing.two,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  textInput: {
    minHeight: 140,
    borderWidth: 1,
    borderRadius: Spacing.two,
    padding: Spacing.two,
    fontSize: 14,
    textAlignVertical: 'top',
  },
  toggleLink: {
    textDecorationLine: 'underline',
    paddingVertical: Spacing.one,
  },
});
