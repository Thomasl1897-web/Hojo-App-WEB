import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, StyleSheet } from 'react-native';

import { PressableFeedback } from '@/components/pressable-feedback';
import { FieldGroup, Tier } from '@/components/form-fields';
import { PreferenceScreen } from '@/components/preference-screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { t, tp } from '@/i18n';
import { formatLongDate, toDateString } from '@/lib/date';
import { nativeHealthSource, openHealthConnectSettings, type HealthStatus } from '@/lib/health-connect';
import { getHealthDay, type HealthDay } from '@/lib/health-db';
import {
  connectHealth,
  disconnectHealth,
  forgetHealthData,
  getLastHealthSync,
  isHealthConnected,
  syncHealth,
  type SyncResult,
} from '@/lib/health-sync';

/** Texte expliquant pourquoi on ne peut pas se connecter, selon l'état de Health Connect. */
function statusMessage(status: HealthStatus): string | null {
  switch (status) {
    case 'unsupported_platform':
      return t("Health Connect n'existe que sur Android. La lecture d'Apple Santé sur iPhone n'est pas encore disponible dans Hojo.");
    case 'unavailable_build':
      return t("Cette version de l'app ne contient pas Health Connect : il faut installer la dernière version.");
    case 'not_installed':
      return t("Health Connect n'est pas installé sur ce téléphone. Installe-le depuis le Play Store (application Google gratuite).");
    case 'update_required':
      return t('Health Connect doit être mis à jour depuis le Play Store.');
    default:
      return null;
  }
}

function syncMessage(result: SyncResult | null): string {
  if (!result) return t('Synchronisation impossible pour le moment.');
  return result.imported > 0
    ? tp(result.imported, '{count} activité importée.', '{count} activités importées.')
    : t('Tout est à jour : aucune nouvelle activité.');
}

export default function HealthPreferencesScreen() {
  const theme = useTheme();
  const [connected, setConnected] = useState(isHealthConnected);
  const [status, setStatus] = useState<HealthStatus | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(getLastHealthSync);
  const [today, setToday] = useState<HealthDay | null>(null);
  const [busy, setBusy] = useState(false);
  const [sleepAccess, setSleepAccess] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setConnected(isHealthConnected());
    setLastSync(getLastHealthSync());
    setToday(getHealthDay(toDateString(new Date())));
  }, []);

  const load = useCallback(() => {
    refresh();
    void nativeHealthSource.status().then(setStatus);
    void nativeHealthSource.hasSleepAccess().then(setSleepAccess);
  }, [refresh]);
  useFocusEffect(load);

  async function handleConnect() {
    setError(null);
    setMessage(null);
    setBusy(true);
    try {
      const result = await connectHealth();
      if (result.success) {
        setMessage(`${t('Health Connect est connecté.')} ${syncMessage(result.sync)}`);
      } else if (result.reason === 'denied') {
        setError(t("Accès refusé : autorise la lecture des activités, des pas et des calories pour synchroniser."));
      } else {
        setStatus(result.status);
      }
    } finally {
      setBusy(false);
      refresh();
    }
  }

  async function handleSync() {
    setError(null);
    setMessage(null);
    setBusy(true);
    try {
      setMessage(syncMessage(await syncHealth()));
    } catch (e) {
      setError(t('Synchronisation impossible : {error}', { error: e instanceof Error ? e.message : String(e) }));
    } finally {
      setBusy(false);
      refresh();
    }
  }

  async function handleSleepAccess() {
    setError(null);
    setMessage(null);
    setBusy(true);
    try {
      await nativeHealthSource.requestAccess();
      setSleepAccess(await nativeHealthSource.hasSleepAccess());
      setMessage(syncMessage(await syncHealth()));
    } catch (e) {
      setError(t('Synchronisation impossible : {error}', { error: e instanceof Error ? e.message : String(e) }));
    } finally {
      setBusy(false);
      refresh();
    }
  }

  function handleDisconnect() {
    disconnectHealth();
    setMessage(t("Synchronisation arrêtée. Pour retirer l'accès, ouvre les réglages de Health Connect."));
    refresh();
  }

  function handleForget() {
    Alert.alert(
      t('Supprimer les données importées ?'),
      t('Les activités importées de Health Connect et les totaux de pas seront effacés de l’app. Tes activités saisies à la main ne changent pas. Elles reviendront à la prochaine synchronisation si Health Connect est toujours connecté.'),
      [
        { text: t('Annuler'), style: 'cancel' },
        {
          text: t('Supprimer'),
          style: 'destructive',
          onPress: () => {
            const removed = forgetHealthData();
            setMessage(tp(removed, '{count} activité importée supprimée.', '{count} activités importées supprimées.'));
            refresh();
          },
        },
      ],
    );
  }

  const unavailable = status !== null && status !== 'ready' ? statusMessage(status) : null;

  return (
    <PreferenceScreen>
      <ThemedView type="backgroundElement" style={styles.card}>
        <FieldGroup title="Health Connect">
          <ThemedText type="small" themeColor="textSecondary">
            {t("L'app lit dans Health Connect (Google Santé) les séances, les pas et les calories actives enregistrés par ta montre ou tes autres applications, par exemple Garmin. Ces données restent sur ton téléphone : rien n'est envoyé nulle part.")}
          </ThemedText>

          <Tier label={connected ? 'Connecté' : 'Non connecté'} tone={connected ? 'accent' : 'neutral'} />

          {!connected && (
            <>
              {unavailable && (
                <ThemedText type="small" themeColor="warn">
                  {unavailable}
                </ThemedText>
              )}
              <PressableFeedback onPress={handleConnect} disabled={busy || (status !== null && status !== 'ready')}>
                <ThemedView
                  type="accent"
                  style={[styles.button, (busy || (status !== null && status !== 'ready')) && styles.buttonDisabled]}>
                  <ThemedText type="link" themeColor="accentOnColor">
                    {t('Connecter Health Connect')}
                  </ThemedText>
                </ThemedView>
              </PressableFeedback>
              <ThemedText type="small" themeColor="textFaint">
                {t("Montre Garmin : dans l'application Garmin Connect, active le partage avec Health Connect (dans ses réglages). Tes séances arriveront ensuite ici toutes seules.")}
              </ThemedText>
            </>
          )}

          {connected && (
            <>
              <ThemedText type="small" themeColor="textSecondary">
                {lastSync
                  ? t('Dernière synchronisation : {date} à {time}', {
                      date: formatLongDate(lastSync),
                      time: `${String(lastSync.getHours()).padStart(2, '0')}:${String(lastSync.getMinutes()).padStart(2, '0')}`,
                    })
                  : t('Pas encore synchronisé.')}
              </ThemedText>
              {today && (
                <ThemedText type="small" themeColor="textSecondary">
                  {t("Aujourd'hui : {steps} pas · {kcal} kcal actives", { steps: today.steps, kcal: today.activeKcal })}
                </ThemedText>
              )}
              <PressableFeedback onPress={handleSync} disabled={busy}>
                <ThemedView type="accent" style={[styles.button, busy && styles.buttonDisabled]}>
                  <ThemedText type="link" themeColor="accentOnColor">
                    {busy ? t('Synchronisation…') : t('Synchroniser maintenant')}
                  </ThemedText>
                </ThemedView>
              </PressableFeedback>
              {!sleepAccess && (
                <>
                  <ThemedText type="small" themeColor="textSecondary">
                    {t("Pour afficher ton score de sommeil sur l'écran Aujourd'hui, autorise aussi la lecture du sommeil.")}
                  </ThemedText>
                  <PressableFeedback onPress={handleSleepAccess} disabled={busy}>
                    <ThemedView type="backgroundElement" style={[styles.button, { borderColor: theme.line, borderWidth: 1 }]}>
                      <ThemedText type="link">{t('Autoriser la lecture du sommeil')}</ThemedText>
                    </ThemedView>
                  </PressableFeedback>
                </>
              )}
            </>
          )}

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
        </FieldGroup>
      </ThemedView>

      {connected && (
        <ThemedView style={styles.links}>
          <PressableFeedback onPress={openHealthConnectSettings}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.link}>
              {t("Gérer l'accès dans Health Connect")}
            </ThemedText>
          </PressableFeedback>
          <PressableFeedback onPress={handleDisconnect}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.link}>
              {t('Arrêter la synchronisation')}
            </ThemedText>
          </PressableFeedback>
          <PressableFeedback onPress={handleForget}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.link}>
              {t('Supprimer les données importées')}
            </ThemedText>
          </PressableFeedback>
        </ThemedView>
      )}
    </PreferenceScreen>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
  },
  button: {
    borderRadius: Spacing.two,
    paddingVertical: Spacing.two,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  links: {
    gap: Spacing.one,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  link: {
    textDecorationLine: 'underline',
    paddingVertical: Spacing.one,
  },
});
