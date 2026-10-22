import * as DocumentPicker from 'expo-document-picker';
import { Directory, File } from 'expo-file-system';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, StyleSheet } from 'react-native';

import { PressableFeedback } from '@/components/pressable-feedback';
import { t, tp } from '@/i18n';
import { FieldGroup } from '@/components/form-fields';
import { PreferenceScreen } from '@/components/preference-screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import {
  createBackup,
  getLastExportAt,
  markExported,
  parseBackup,
  restoreBackup,
  summarizeBackup,
  type BackupFile,
  type BackupSummary,
} from '@/lib/backup';
import { formatLongDate, toDateString } from '@/lib/date';
import { rescheduleIfPermitted } from '@/lib/notifications';
import { getActivePlanMeta } from '@/lib/nutrition-db';
import { getActiveSportPlanMeta } from '@/lib/sport-db';

/** Texte des éléments d'une sauvegarde, pour l'aperçu comme pour la confirmation de restauration. */
function describeContents(summary: BackupSummary): string[] {
  return [
    tp(summary.weightEntries, '{count} charge saisie', '{count} charges saisies'),
    tp(summary.sessionsDone, '{count} séance terminée', '{count} séances terminées'),
    tp(summary.activities, '{count} activité saisie à la main', '{count} activités saisies à la main'),
    tp(summary.shoppingItems, '{count} article de courses perso', '{count} articles de courses perso'),
    tp(summary.settings, '{count} réglage', '{count} réglages'),
    summary.hasNutritionPlan ? t('le plan nutrition') : t('pas de plan nutrition'),
    summary.hasSportPlan ? t('le programme sport') : t('pas de programme sport'),
  ];
}

// Fermer le sélecteur de dossier est un choix de l'utilisateur, pas une erreur à lui afficher.
function isCancellation(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /cancel|annul|dismiss/i.test(message);
}

export default function BackupPreferencesScreen() {
  const [summary, setSummary] = useState<BackupSummary | null>(null);
  const [planMissing, setPlanMissing] = useState({ nutrition: false, sport: false });
  const [lastExport, setLastExport] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(() => {
    const current = summarizeBackup(createBackup());
    setSummary(current);
    // Un plan importé avant l'existence des sauvegardes n'a pas son texte d'origine en mémoire.
    setPlanMissing({
      nutrition: getActivePlanMeta() !== null && !current.hasNutritionPlan,
      sport: getActiveSportPlanMeta() !== null && !current.hasSportPlan,
    });
    setLastExport(getLastExportAt());
  }, []);
  useFocusEffect(load);

  async function handleExport() {
    setError(null);
    setMessage(null);
    setBusy(true);
    try {
      const directory = await Directory.pickDirectoryAsync();
      const fileName = `hojo-sauvegarde-${toDateString(new Date())}.json`; // nom de fichier : identique dans toutes les langues
      const file = directory.createFile(fileName, 'application/json');
      file.write(JSON.stringify(createBackup()));
      markExported(new Date());
      load();
      setMessage(t('Sauvegarde enregistrée dans le dossier choisi : {file}', { file: fileName }));
    } catch (e) {
      if (!isCancellation(e)) {
        setError(t("Impossible d'enregistrer la sauvegarde : {error}", { error: e instanceof Error ? e.message : String(e) }));
      }
    } finally {
      setBusy(false);
    }
  }

  async function doRestore(backup: BackupFile) {
    setBusy(true);
    try {
      const result = restoreBackup(backup);
      const rescheduled = await rescheduleIfPermitted();
      load();
      setMessage(
        t('Sauvegarde restaurée.') +
          (rescheduled ? ` ${t('Rappels reprogrammés.')}` : '') +
          (result.warnings.length > 0 ? `\n\n⚠️ ${result.warnings.join('\n')}` : ''),
      );
    } catch (e) {
      setError(
        t("La restauration a échoué, tes données n'ont pas été modifiées : {error}", { error: e instanceof Error ? e.message : String(e) }),
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleRestore() {
    setError(null);
    setMessage(null);
    try {
      const picked = await DocumentPicker.getDocumentAsync({
        type: ['application/json', 'text/plain', '*/*'],
        copyToCacheDirectory: true,
      });
      if (picked.canceled || !picked.assets?.length) return;

      const content = await new File(picked.assets[0].uri).text();
      const parsed = parseBackup(content);
      if (!parsed.success) {
        setError(parsed.error);
        return;
      }

      const contents = describeContents(summarizeBackup(parsed.data));
      Alert.alert(
        t('Restaurer cette sauvegarde ?'),
        t('Faite le {date}, elle contient :\n• {contents}\n\nTes données actuelles seront remplacées.', {
          date: formatLongDate(new Date(parsed.data.createdAt)),
          contents: contents.join('\n• '),
        }),
        [
          { text: t('Annuler'), style: 'cancel' },
          { text: t('Restaurer'), style: 'destructive', onPress: () => void doRestore(parsed.data) },
        ],
      );
    } catch (e) {
      setError(t('Impossible de lire le fichier : {error}', { error: e instanceof Error ? e.message : String(e) }));
    }
  }

  return (
    <PreferenceScreen>
      <ThemedView type="backgroundElement" style={styles.card}>
        <FieldGroup title="Exporter mes données">
          <ThemedText type="small" themeColor="textSecondary">
            {t("Tout est stocké sur ce téléphone : une réinstallation de l'app ou un changement de téléphone efface tout. Exporte un fichier de sauvegarde et garde-le ailleurs (Drive, ordinateur...).")}
          </ThemedText>

          {summary && (
            <ThemedView style={styles.list}>
              <ThemedText type="small" themeColor="textSecondary">
                {t('Contenu actuel :')}
              </ThemedText>
              {describeContents(summary).map((line) => (
                <ThemedText key={line} type="small" themeColor="textSecondary">
                  • {line}
                </ThemedText>
              ))}
            </ThemedView>
          )}

          {planMissing.nutrition && (
            <ThemedText type="small" themeColor="warn">
              {t("Le plan nutrition actuel a été importé avant les sauvegardes : réimporte-le une fois (Réglages › Nutrition) pour qu'il soit inclus.")}
            </ThemedText>
          )}
          {planMissing.sport && (
            <ThemedText type="small" themeColor="warn">
              {t("Le programme sport actuel a été importé avant les sauvegardes : réimporte-le une fois (Réglages › Sport) pour qu'il soit inclus.")}
            </ThemedText>
          )}

          <ThemedText type="small" themeColor="textFaint">
            {t('Les repas cochés et les articles du plan cochés ne sont pas inclus. Dernier export : {date}.', {
              date: lastExport ? formatLongDate(new Date(lastExport)) : t('jamais'),
            })}
          </ThemedText>

          <PressableFeedback onPress={handleExport} disabled={busy}>
            <ThemedView type="accent" style={[styles.button, busy && styles.buttonDisabled]}>
              <ThemedText type="link" themeColor="accentOnColor">
                {t('Exporter mes données')}
              </ThemedText>
            </ThemedView>
          </PressableFeedback>
        </FieldGroup>
      </ThemedView>

      <ThemedView type="backgroundElement" style={styles.card}>
        <FieldGroup title="Restaurer une sauvegarde">
          <ThemedText type="small" themeColor="textSecondary">
            {t('Choisis un fichier de sauvegarde exporté plus tôt. Tes données actuelles seront remplacées par son contenu : une confirmation te sera demandée avant.')}
          </ThemedText>
          <PressableFeedback onPress={handleRestore} disabled={busy}>
            <ThemedView type="backgroundSelected" style={[styles.button, busy && styles.buttonDisabled]}>
              <ThemedText type="link">{t('Choisir un fichier de sauvegarde')}</ThemedText>
            </ThemedView>
          </PressableFeedback>
        </FieldGroup>
      </ThemedView>

      {error && (
        <ThemedText type="small" themeColor="danger">
          {error}
        </ThemedText>
      )}
      {message && (
        <ThemedText type="small" themeColor="accent">
          {message}
        </ThemedText>
      )}
    </PreferenceScreen>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
  },
  list: {
    gap: Spacing.half,
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
});
