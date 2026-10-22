import { Stack } from 'expo-router';

import { t } from '@/i18n';
import { useTheme } from '@/hooks/use-theme';

/**
 * Pile de navigation des sous-menus des Réglages. L'en-tête reprend la palette de l'app
 * (le thème de navigation par défaut est blanc/noir pur, qui jurerait avec le fond vert pâle).
 */
export default function PreferencesLayout() {
  const theme = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: theme.background },
        headerTintColor: theme.accent,
        headerTitleStyle: { color: theme.text },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: theme.background },
      }}>
      <Stack.Screen name="appearance" options={{ title: t('Apparence') }} />
      <Stack.Screen name="notifications" options={{ title: t('Notifications') }} />
      <Stack.Screen name="nutrition" options={{ title: t('Nutrition') }} />
      <Stack.Screen name="waste" options={{ title: t('Poubelles') }} />
      <Stack.Screen name="sport" options={{ title: t('Sport') }} />
      <Stack.Screen name="statistics" options={{ title: t('Statistiques') }} />
      <Stack.Screen name="health" options={{ title: t('Santé') }} />
      <Stack.Screen name="language" options={{ title: t('Langue') }} />
      <Stack.Screen name="backup" options={{ title: t('Sauvegarde') }} />
    </Stack>
  );
}
