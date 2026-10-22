import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, StyleSheet } from 'react-native';

import { PressableFeedback } from '@/components/pressable-feedback';
import { t } from '@/i18n';
import { FieldGroup, TextField, Tier } from '@/components/form-fields';
import { PreferenceScreen } from '@/components/preference-screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { isValidTimeString } from '@/lib/date';
import {
  getNotificationPermissionState,
  requestNotificationPermission,
  rescheduleIfPermitted,
  type NotificationPermissionState,
} from '@/lib/notifications';
import { clearSlotTimes, getMealSlots, setSlotTime, type MealSlot } from '@/lib/nutrition-db';
import { PERMISSION_LABELS } from '@/lib/preference-labels';
import { deleteSetting, setSetting, SPORT_REMINDER_TIME_KEY } from '@/lib/settings-db';
import { getActiveSportPlanMeta, type SportPlanMeta } from '@/lib/sport-db';

export default function NotificationsPreferencesScreen() {
  const [permission, setPermission] = useState<NotificationPermissionState>('undetermined');
  const [slots, setSlots] = useState<MealSlot[]>([]);
  const [slotDrafts, setSlotDrafts] = useState<Record<string, string>>({});
  const [sportPlan, setSportPlan] = useState<SportPlanMeta | null>(null);
  const [sportDraft, setSportDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(() => {
    const loadedSlots = getMealSlots();
    setSlots(loadedSlots);
    setSlotDrafts(Object.fromEntries(loadedSlots.map((slot) => [slot.slotName, slot.time])));

    const sport = getActiveSportPlanMeta();
    setSportPlan(sport);
    setSportDraft(sport?.preferredTime ?? '');

    void getNotificationPermissionState().then(setPermission);
  }, []);

  useFocusEffect(load);

  async function handleAllowNotifications() {
    setError(null);
    setMessage(null);
    if (permission === 'denied') {
      // Android/iOS ne réaffichent plus la demande une fois refusée : seul le réglage système
      // permet de revenir en arrière.
      await Linking.openSettings();
      return;
    }
    const granted = await requestNotificationPermission();
    setPermission(await getNotificationPermissionState());
    if (granted) {
      await rescheduleIfPermitted();
      setMessage(t('Notifications autorisées, rappels programmés.'));
    }
  }

  async function reschedule(): Promise<boolean> {
    const rescheduled = await rescheduleIfPermitted();
    setPermission(await getNotificationPermissionState());
    return rescheduled;
  }

  async function saveTimes() {
    setError(null);
    setMessage(null);

    const invalidSlots = slots.filter((slot) => !isValidTimeString(slotDrafts[slot.slotName] ?? ''));
    const sportInvalid = sportPlan?.mode === 'fixe' && !isValidTimeString(sportDraft);
    if (invalidSlots.length > 0 || sportInvalid) {
      const names = [...invalidSlots.map((slot) => slot.slotName), ...(sportInvalid ? [t('Séance de sport')] : [])];
      setError(t('Heure invalide pour : {names}. Format attendu HH:MM, par exemple 07:30.', { names: names.join(', ') }));
      return;
    }

    for (const slot of slots) {
      const draft = slotDrafts[slot.slotName];
      if (draft !== slot.time) setSlotTime(slot.slotName, draft);
    }
    if (sportPlan?.mode === 'fixe' && sportDraft !== sportPlan.preferredTime) {
      setSetting(SPORT_REMINDER_TIME_KEY, sportDraft);
    }

    const rescheduled = await reschedule();
    load();
    setMessage(
      rescheduled
        ? t('Heures enregistrées, rappels reprogrammés.')
        : t('Heures enregistrées. Autorise les notifications pour recevoir les rappels.'),
    );
  }

  async function resetTimes() {
    setError(null);
    clearSlotTimes();
    deleteSetting(SPORT_REMINDER_TIME_KEY);
    const rescheduled = await reschedule();
    load();
    setMessage(rescheduled ? t('Heures du plan rétablies, rappels reprogrammés.') : t('Heures du plan rétablies.'));
  }

  const permissionInfo = PERMISSION_LABELS[permission];
  const hasTimes = slots.length > 0 || sportPlan?.mode === 'fixe';

  return (
    <PreferenceScreen>
      <ThemedView type="backgroundElement" style={styles.card}>
        <FieldGroup title="Autorisation">
          <Tier label={permissionInfo.label} tone={permissionInfo.tone} />
          {permission === 'undetermined' && (
            <PressableFeedback onPress={handleAllowNotifications}>
              <ThemedView type="accent" style={styles.button}>
                <ThemedText type="link" themeColor="accentOnColor">
                  {t('Autoriser les notifications')}
                </ThemedText>
              </ThemedView>
            </PressableFeedback>
          )}
          {permission === 'denied' && (
            <>
              <ThemedText type="small" themeColor="textSecondary">
                {t("Le téléphone ne redemande plus l'autorisation une fois refusée. Il faut l'activer dans les réglages de l'app.")}
              </ThemedText>
              <PressableFeedback onPress={handleAllowNotifications}>
                <ThemedView type="accent" style={styles.button}>
                  <ThemedText type="link" themeColor="accentOnColor">
                    {t('Ouvrir les réglages du téléphone')}
                  </ThemedText>
                </ThemedView>
              </PressableFeedback>
            </>
          )}
          {permission === 'unavailable' && (
            <ThemedText type="small" themeColor="textSecondary">
              {t("Les rappels fonctionnent dans l'application installée (development build), pas dans Expo Go.")}
            </ThemedText>
          )}
        </FieldGroup>
      </ThemedView>

      <ThemedView type="backgroundElement" style={styles.card}>
        <FieldGroup title="Heures des rappels">
          {!hasTimes && (
            <ThemedText type="small" themeColor="textSecondary">
              {t('Importe un plan nutrition ou un programme sport en séances fixes pour régler ses heures. Les heures des poubelles se règlent dans leur propre rubrique.')}
            </ThemedText>
          )}

          {slots.map((slot) => (
            <TextField
              key={slot.slotName}
              label={slot.variesByDay ? t('{slot} (varie selon les jours dans le plan)', { slot: t(slot.slotName) }) : t(slot.slotName)}
              value={slotDrafts[slot.slotName] ?? ''}
              onChangeText={(value) => setSlotDrafts((prev) => ({ ...prev, [slot.slotName]: value }))}
              placeholder="HH:MM"
            />
          ))}

          {sportPlan?.mode === 'fixe' && (
            <TextField label="Séance de sport" value={sportDraft} onChangeText={setSportDraft} placeholder="HH:MM" />
          )}
          {sportPlan?.mode === 'continu' && (
            <ThemedText type="small" themeColor="textSecondary">
              {t("Le programme en flux continu n'a pas de rappel daté : pas d'heure à régler pour le sport.")}
            </ThemedText>
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

          {hasTimes && (
            <>
              <PressableFeedback onPress={saveTimes}>
                <ThemedView type="accent" style={styles.button}>
                  <ThemedText type="link" themeColor="accentOnColor">
                    {t('Enregistrer les heures')}
                  </ThemedText>
                </ThemedView>
              </PressableFeedback>
              <PressableFeedback onPress={resetTimes}>
                <ThemedText type="small" themeColor="textSecondary" style={styles.toggleLink}>
                  {t('Rétablir les heures du plan')}
                </ThemedText>
              </PressableFeedback>
            </>
          )}
        </FieldGroup>
      </ThemedView>
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
  toggleLink: {
    textDecorationLine: 'underline',
    paddingVertical: Spacing.one,
  },
});
