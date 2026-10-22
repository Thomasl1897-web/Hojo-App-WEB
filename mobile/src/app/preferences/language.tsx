import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { ChipSingleSelect, FieldGroup } from '@/components/form-fields';
import { PreferenceScreen } from '@/components/preference-screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { msg, t, type LanguagePreference } from '@/i18n';
import { getLanguagePreference, requestReturnToLanguageScreen, setLanguagePreference } from '@/lib/language';
import { rescheduleIfPermitted } from '@/lib/notifications';

// « Français » et « English » restent écrits dans leur propre langue, quelle que soit celle de l'app.
const LANGUAGE_OPTIONS: { value: LanguagePreference; label: string }[] = [
  { value: 'system', label: msg('Automatique') },
  { value: 'fr', label: 'Français' },
  { value: 'en', label: 'English' },
];

export default function LanguageScreen() {
  const [preference, setPreference] = useState<LanguagePreference>(getLanguagePreference);

  function choose(next: LanguagePreference) {
    if (next === preference) return;
    setPreference(next);
    requestReturnToLanguageScreen();
    setLanguagePreference(next);
    // Les textes des rappels déjà programmés sont dans l'ancienne langue : on les reprogramme.
    void rescheduleIfPermitted();
  }

  return (
    <PreferenceScreen>
      <ThemedView type="backgroundElement" style={styles.card}>
        <FieldGroup title="Langue">
          <ThemedText type="small" themeColor="textSecondary">
            {t("Automatique suit la langue de ton téléphone. Les plans déjà importés gardent leur langue d'origine.")}
          </ThemedText>
          <ChipSingleSelect label="Langue" options={LANGUAGE_OPTIONS} value={preference} onChange={choose} />
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
});
