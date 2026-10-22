import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { t } from '@/i18n';
import { ChipSingleSelect, FieldGroup, ToggleField } from '@/components/form-fields';
import { PreferenceScreen } from '@/components/preference-screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { isHapticsEnabled, setHapticsEnabled } from '@/lib/haptics';
import { THEME_OPTIONS } from '@/lib/preference-labels';
import { getThemePreference, setThemePreference, type ThemePreference } from '@/lib/settings-db';

export default function AppearanceScreen() {
  const [theme, setTheme] = useState<ThemePreference>(getThemePreference);

  const [haptics, setHaptics] = useState(isHapticsEnabled);

  function chooseTheme(next: ThemePreference) {
    setTheme(next);
    setThemePreference(next);
  }

  return (
    <PreferenceScreen>
      <ThemedView type="backgroundElement" style={styles.card}>
        <FieldGroup title={t('Thème')}>
          <ThemedText type="small" themeColor="textSecondary">
            {t('Automatique suit le réglage clair ou sombre de ton téléphone.')}
          </ThemedText>
          <ChipSingleSelect label={t('Thème')} options={THEME_OPTIONS} value={theme} onChange={chooseTheme} />
        </FieldGroup>
      </ThemedView>

      <ThemedView type="backgroundElement" style={styles.card}>
        <FieldGroup title={t('Retour tactile')}>
          <ThemedText type="small" themeColor="textSecondary">
            {t('Une petite vibration quand tu coches un repas, valides une série ou changes d’onglet.')}
          </ThemedText>
          <ToggleField
            label="Retour tactile"
            value={haptics}
            onChange={(next) => {
              setHaptics(next);
              setHapticsEnabled(next);
            }}
          />
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
