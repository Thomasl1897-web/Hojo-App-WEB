import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, TextInput } from 'react-native';

import { PressableFeedback } from '@/components/pressable-feedback';
import { t } from '@/i18n';
import { PreferenceScreen } from '@/components/preference-screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { savePlanSource } from '@/lib/backup';
import { ensureNotificationSetup, NOTIFICATIONS_AVAILABLE, rescheduleAllNotifications, requestNotificationPermission } from '@/lib/notifications';
import { getActivePlanMeta } from '@/lib/nutrition-db';
import { getActiveSportPlanMeta, importSportPlan, type SportPlanMeta } from '@/lib/sport-db';
import { sportGenericPrompt } from '@/lib/sport-prompt';
import { parseSportPlan } from '@/lib/sport-schema';

export default function SportPreferencesScreen() {
  const theme = useTheme();
  const [planMeta, setPlanMeta] = useState<SportPlanMeta | null>(null);
  const [jsonInput, setJsonInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [showPasteFallback, setShowPasteFallback] = useState(false);
  // Replié par défaut si un programme est déjà actif : l'essentiel (obtenir / importer) est fait.
  const [showImport, setShowImport] = useState(() => !getActiveSportPlanMeta());

  const load = useCallback(() => setPlanMeta(getActiveSportPlanMeta()), []);
  useFocusEffect(load);

  async function copyToClipboard(text: string) {
    await Clipboard.setStringAsync(text);
    Alert.alert(
      t('Copié'),
      t("Colle ce prompt dans ton assistant IA préféré (ChatGPT, Claude, etc.), puis récupère le fichier .json qu'il génère pour l'importer ici."),
    );
  }

  async function importFromText(raw: string) {
    setError(null);
    const result = parseSportPlan(raw);
    if (!result.success) {
      setError(result.error);
      return;
    }

    setImporting(true);
    try {
      importSportPlan(result.data);
      savePlanSource('sport', raw);

      await ensureNotificationSetup();
      const granted = await requestNotificationPermission();
      if (granted) {
        await rescheduleAllNotifications(getActivePlanMeta(), getActiveSportPlanMeta());
      }

      setJsonInput('');
      setShowPasteFallback(false);
      setShowImport(false);
      load();

      const warningNote = result.warnings.length ? `\n\n⚠️ ${result.warnings.join(' ')}` : '';
      Alert.alert(
        t('Programme importé'),
        (!NOTIFICATIONS_AVAILABLE
          ? t("« {name} » est actif. Les rappels sont indisponibles dans Expo Go (ils fonctionnent dans une vraie installation de l'app).", { name: result.data.name })
          : granted
            ? t("« {name} » est actif. Les rappels d'entraînement sont programmés.", { name: result.data.name })
            : t('« {name} » est actif. Autorise les notifications pour recevoir les rappels.', { name: result.data.name })) +
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

  return (
    <PreferenceScreen>
      <ThemedView type="backgroundElement" style={styles.statusCard}>
        {planMeta ? (
          <>
            <ThemedText type="smallBold">{t('Programme actif : {name}', { name: planMeta.name })}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {t('{mode} · rappel à {time}', { mode: planMeta.mode === 'fixe' ? t('Séances fixes') : t('Flux continu'), time: planMeta.preferredTime })}
              {planMeta.mode === 'continu' ? ` ${t('(pas de rappel daté en flux continu)')}` : ''}
            </ThemedText>
          </>
        ) : (
          <ThemedText type="small" themeColor="textSecondary">
            {t("Aucun programme importé pour l'instant")}
          </ThemedText>
        )}
      </ThemedView>

      {planMeta && !showImport && (
        <PressableFeedback onPress={() => router.push('/sport-editor')}>
          <ThemedView type="accent" style={styles.button}>
            <ThemedText type="link" themeColor="accentOnColor">
              {t('Modifier le programme')}
            </ThemedText>
          </ThemedView>
        </PressableFeedback>
      )}

      {planMeta && !showImport && (
        <PressableFeedback onPress={() => setShowImport(true)}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.toggleLink}>
            {t('Remplacer le programme')}
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
            <ThemedText type="smallBold">{t('1. Obtenir un programme')}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {t('Copie un prompt et colle-le dans un assistant IA (ChatGPT, Claude...). Il te renverra un fichier .json à télécharger, puis à importer ci-dessous.')}
            </ThemedText>

            <PressableFeedback onPress={() => copyToClipboard(sportGenericPrompt())}>
              <ThemedView type="backgroundElement" style={styles.button}>
                <ThemedText type="link">{t('Copier le prompt générique')}</ThemedText>
              </ThemedView>
            </PressableFeedback>

            <PressableFeedback onPress={() => router.push('/sport-questionnaire')}>
              <ThemedView type="backgroundElement" style={styles.button}>
                <ThemedText type="link">{t('Personnaliser via un questionnaire détaillé')}</ThemedText>
              </ThemedView>
            </PressableFeedback>
          </ThemedView>

          <ThemedView style={styles.section}>
            <ThemedText type="smallBold">{t('Ou le créer à la main')}</ThemedText>
            <PressableFeedback onPress={() => router.push('/sport-editor')}>
              <ThemedView type="backgroundElement" style={styles.button}>
                <ThemedText type="link">{planMeta ? t('Modifier le programme actuel') : t('Créer un programme à la main')}</ThemedText>
              </ThemedView>
            </PressableFeedback>
          </ThemedView>

          <ThemedView style={styles.section}>
            <ThemedText type="smallBold">{t('2. Importer le programme')}</ThemedText>
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
    </PreferenceScreen>
  );
}

const styles = StyleSheet.create({
  statusCard: {
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
