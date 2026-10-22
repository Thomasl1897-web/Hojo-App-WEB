import { DarkTheme, DefaultTheme, router, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { useTheme } from '@/hooks/use-theme';
import { t, useLanguage } from '@/i18n';
import { initBackupSchema } from '@/lib/backup';
import { initDatabase } from '@/lib/database';
import { initHealthSchema } from '@/lib/health-db';
import { applyLanguagePreference, takeReturnToLanguageScreen } from '@/lib/language';
import { ensureNotificationSetup, rescheduleAllNotifications, requestNotificationPermission } from '@/lib/notifications';
import { getActivePlanMeta, initNutritionSchema } from '@/lib/nutrition-db';
import { shouldShowOnboarding } from '@/lib/onboarding';
import { applyThemePreference, getThemePreference, initSettingsSchema } from '@/lib/settings-db';
import { initShoppingSchema } from '@/lib/shopping-db';
import { getActiveSportPlanMeta, initSportSchema } from '@/lib/sport-db';
import { hasWasteSchedule, initWasteSchema } from '@/lib/waste-db';

SplashScreen.preventAutoHideAsync();

initDatabase([
  initNutritionSchema,
  initSportSchema,
  initSettingsSchema,
  initShoppingSchema,
  initWasteSchema,
  initBackupSchema,
  initHealthSchema,
]);

// Avant le premier rendu, pour ne pas afficher un instant le mauvais thème ni la mauvaise langue.
applyThemePreference(getThemePreference());
applyLanguagePreference();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const language = useLanguage();

  useEffect(() => {
    ensureNotificationSetup();

    // Réapprovisionne la fenêtre glissante de notifications à chaque démarrage de l'app,
    // pour qu'elle avance dans le temps même sans réimport de plan (voir CLAUDE.md). Les
    // deux domaines sont TOUJOURS reprogrammés ensemble (voir notifications.ts).
    (async () => {
      const nutritionPlan = getActivePlanMeta();
      const sportPlan = getActiveSportPlanMeta();
      if (!nutritionPlan && !sportPlan && !hasWasteSchedule()) return;

      const granted = await requestNotificationPermission();
      if (granted) {
        await rescheduleAllNotifications(nutritionPlan, sportPlan);
      }
    })();
  }, []);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      {/* La navigation est remontée à chaque changement de langue : tous les textes se relisent. */}
      <AppStack key={language} />
    </ThemeProvider>
  );
}

function AppStack() {
  const theme = useTheme();

  // Après un changement de langue, on revient sur l'écran de choix de la langue (le remontage
  // ramène sinon la navigation au premier onglet).
  useEffect(() => {
    if (takeReturnToLanguageScreen()) router.push('/preferences/language');
    // Première utilisation : l'accueil se rouvre aussi après un changement de langue, tant qu'il n'est pas terminé.
    else if (shouldShowOnboarding()) router.push('/onboarding');
  }, []);

  // En-tête aux couleurs de l'app pour les écrans empilés (le thème de navigation par défaut est
  // blanc / noir pur).
  const headerOptions = {
    headerShown: true,
    headerStyle: { backgroundColor: theme.background },
    headerTintColor: theme.accent,
    headerTitleStyle: { color: theme.text },
    headerShadowVisible: false,
  } as const;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="onboarding" options={{ presentation: 'fullScreenModal', gestureEnabled: false }} />
      <Stack.Screen name="questionnaire" options={{ presentation: 'modal', headerShown: true, title: t('Questionnaire nutrition') }} />
      <Stack.Screen name="sport-questionnaire" options={{ presentation: 'modal', headerShown: true, title: t('Questionnaire sport') }} />
      <Stack.Screen name="sport-editor" options={{ ...headerOptions, presentation: 'modal', title: t('Éditer le programme') }} />
      <Stack.Screen name="preferences" />
      <Stack.Screen name="add-activity" options={{ ...headerOptions, presentation: 'modal', title: t('Autre activité') }} />
      <Stack.Screen name="courses" options={{ ...headerOptions, title: t('Liste de courses') }} />
      <Stack.Screen name="live-session" options={{ presentation: 'fullScreenModal', headerShown: false }} />
    </Stack>
  );
}
