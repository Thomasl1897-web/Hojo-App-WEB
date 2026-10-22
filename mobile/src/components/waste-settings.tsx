import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { PressableFeedback } from '@/components/pressable-feedback';
import { t, msg } from '@/i18n';
import { ChipSingleSelect, FieldGroup, TextField } from '@/components/form-fields';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { formatLongDate, isValidTimeString, toDateString, weekdayName } from '@/lib/date';
import { rescheduleIfPermitted } from '@/lib/notifications';
import { WEEKDAYS } from '@/lib/nutrition-schema';
import {
  candidateAnchors,
  isCollectionDay,
  nextCollectionDate,
  WASTE_BIN_DEFS,
  type WasteBinConfig,
} from '@/lib/waste';
import { getWasteBins, getWasteReminderTime, setWasteBin, setWasteReminderTime } from '@/lib/waste-db';

const FREQUENCY_OPTIONS = [
  { value: 1, label: msg('Chaque semaine') },
  { value: 2, label: msg('1 semaine sur 2') },
];

export function WasteSettings() {
  const [bins, setBins] = useState<WasteBinConfig[]>(getWasteBins);
  const [timeDraft, setTimeDraft] = useState(getWasteReminderTime);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function applyChange(next: WasteBinConfig) {
    setError(null);
    setWasteBin(next);
    setBins(getWasteBins());
    const rescheduled = await rescheduleIfPermitted();
    setMessage(rescheduled ? t('Enregistré, rappels reprogrammés.') : t('Enregistré.'));
  }

  function changeWeekday(bin: WasteBinConfig, weekday: string) {
    if (weekday === '') {
      void applyChange({ ...bin, weekday: null, everyOtherWeek: false, anchorDate: null });
      return;
    }
    // Un changement de jour invalide l'ancienne date de calage : on repart du ramassage le plus proche.
    const anchorDate = bin.everyOtherWeek ? toDateString(candidateAnchors(weekday, new Date())[0]) : null;
    void applyChange({ ...bin, weekday, anchorDate });
  }

  function changeFrequency(bin: WasteBinConfig, frequency: number) {
    if (!bin.weekday) return;
    if (frequency === 1) {
      void applyChange({ ...bin, everyOtherWeek: false, anchorDate: null });
    } else {
      const anchorDate = toDateString(candidateAnchors(bin.weekday, new Date())[0]);
      void applyChange({ ...bin, everyOtherWeek: true, anchorDate });
    }
  }

  async function saveTime() {
    setMessage(null);
    if (!isValidTimeString(timeDraft)) {
      setError(t('Heure invalide. Format attendu HH:MM, par exemple 19:00.'));
      return;
    }
    setError(null);
    setWasteReminderTime(timeDraft);
    const rescheduled = await rescheduleIfPermitted();
    setMessage(rescheduled ? t('Heure enregistrée, rappels reprogrammés.') : t('Heure enregistrée.'));
  }

  const today = new Date();
  const weekdayOptions: { value: string; label: string }[] = [
    { value: '', label: t('Aucun') },
    ...WEEKDAYS.map((day) => {
      const name = weekdayName(day);
      return { value: day as string, label: name.charAt(0).toUpperCase() + name.slice(1) };
    }),
  ];

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <FieldGroup title="Poubelles" icon="bins">
        <ThemedText type="small" themeColor="textSecondary">
          {t("Choisis le jour de ramassage de chaque type. Un rappel te prévient la veille au soir de ce qu'il faut sortir.")}
        </ThemedText>

        {WASTE_BIN_DEFS.map((def) => {
          const bin = bins.find((candidate) => candidate.id === def.id);
          if (!bin) return null;

          const next = bin.weekday ? nextCollectionDate(bin, today) : null;
          const anchors = bin.weekday && bin.everyOtherWeek ? candidateAnchors(bin.weekday, today) : null;
          const selectedAnchor = anchors?.find((date) => isCollectionDay(bin, date));

          return (
            <ThemedView key={def.id} style={styles.bin}>
              <ThemedView style={styles.binHeader}>
                <View style={[styles.dot, { backgroundColor: def.color }]} />
                <ThemedText type="smallBold">{t(def.label)}</ThemedText>
              </ThemedView>

              <ChipSingleSelect
                label="Jour de ramassage"
                options={weekdayOptions}
                value={bin.weekday ?? ''}
                onChange={(weekday) => changeWeekday(bin, weekday)}
              />

              {bin.weekday && (
                <ChipSingleSelect
                  label="Fréquence"
                  options={FREQUENCY_OPTIONS}
                  value={bin.everyOtherWeek ? 2 : 1}
                  onChange={(frequency) => changeFrequency(bin, frequency)}
                />
              )}

              {anchors && (
                <ChipSingleSelect
                  label="Prochain ramassage"
                  options={anchors.map((date) => ({ value: toDateString(date), label: formatLongDate(date) }))}
                  value={selectedAnchor ? toDateString(selectedAnchor) : null}
                  onChange={(anchorDate) => void applyChange({ ...bin, anchorDate })}
                />
              )}

              {next && (
                <ThemedText type="small" themeColor="textFaint">
                  {t('Prochain ramassage : {date}', { date: formatLongDate(next) })}
                </ThemedText>
              )}
            </ThemedView>
          );
        })}

        <TextField
          label="Heure du rappel (la veille au soir)"
          value={timeDraft}
          onChangeText={setTimeDraft}
          placeholder="HH:MM"
        />
        <PressableFeedback onPress={saveTime}>
          <ThemedView type="accent" style={styles.button}>
            <ThemedText type="link" themeColor="accentOnColor">
              {t("Enregistrer l'heure")}
            </ThemedText>
          </ThemedView>
        </PressableFeedback>

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
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
  },
  bin: {
    gap: Spacing.two,
    backgroundColor: 'transparent',
    paddingTop: Spacing.two,
  },
  binHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: 'transparent',
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  button: {
    borderRadius: Spacing.two,
    paddingVertical: Spacing.two,
    alignItems: 'center',
  },
});
