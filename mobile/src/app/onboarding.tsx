import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChipSingleSelect } from '@/components/form-fields';
import { PressableFeedback } from '@/components/pressable-feedback';
import { SectionIcon, type IllustrationName } from '@/components/section-icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { msg, t, type LanguagePreference } from '@/i18n';
import { getLanguagePreference, setLanguagePreference } from '@/lib/language';
import { rescheduleIfPermitted } from '@/lib/notifications';
import { getActivePlanMeta } from '@/lib/nutrition-db';
import { completeOnboarding } from '@/lib/onboarding';
import { getActiveSportPlanMeta } from '@/lib/sport-db';
import { hasWasteSchedule } from '@/lib/waste-db';
import type { Href } from 'expo-router';

const LANGUAGE_OPTIONS: { value: LanguagePreference; label: string }[] = [
  { value: 'system', label: msg('Automatique') },
  { value: 'fr', label: 'Français' },
  { value: 'en', label: 'English' },
];

// Logo + nom (Design/Logo et nom Hojo.png), détouré ; la version sombre a le vert foncé éclairci.
const WORDMARK_LIGHT = require('@/assets/images/brand/wordmark-light.png');
const WORDMARK_DARK = require('@/assets/images/brand/wordmark-dark.png');

type Action = { label: string; href: Href; primary?: boolean };

/** Écran de première utilisation : choisir comment obtenir un plan nutrition et un programme sport. */
export default function OnboardingScreen() {
  const theme = useTheme();
  const colorScheme = useColorScheme();
  const [language, setLanguage] = useState<LanguagePreference>(getLanguagePreference);
  const [done, setDone] = useState({ nutrition: false, sport: false, waste: false });

  // Au retour d'un écran d'import, les cases se mettent à jour.
  useFocusEffect(
    useCallback(() => {
      setDone({ nutrition: getActivePlanMeta() !== null, sport: getActiveSportPlanMeta() !== null, waste: hasWasteSchedule() });
    }, []),
  );

  function chooseLanguage(next: LanguagePreference) {
    if (next === language) return;
    setLanguage(next);
    // Remonte la navigation (voir `_layout.tsx`), qui rouvre cet écran tant que l'accueil n'est pas terminé.
    setLanguagePreference(next);
    void rescheduleIfPermitted();
  }

  function finish() {
    completeOnboarding();
    router.dismissAll();
    router.replace('/');
  }

  const anythingDone = done.nutrition || done.sport || done.waste;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <Image
              source={colorScheme === 'dark' ? WORDMARK_DARK : WORDMARK_LIGHT}
              style={styles.wordmark}
              contentFit="contain"
              accessibilityLabel="Hojo"
            />
            <ThemedText type="title" style={styles.centered}>
              {t('Bienvenue')}
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.centered}>
              {t("Ton assistant du quotidien : repas, séances de sport et poubelles. Tout reste sur ton téléphone, sans compte. Commence par ce que tu veux suivre, tu pourras tout changer ensuite dans les Réglages.")}
            </ThemedText>
          </View>

          <ChipSingleSelect label="Langue" options={LANGUAGE_OPTIONS} value={language} onChange={chooseLanguage} />

          <Step
            icon="plate"
            title={t('Nutrition')}
            done={done.nutrition}
            description={t("Un plan de repas sur 7 ou 14 jours. Tu peux l'importer s'il existe déjà, ou le faire générer : l'app prépare une demande à coller dans une IA (ChatGPT, Claude…), puis tu importes le fichier qu'elle te renvoie.")}
            actions={[
              { label: t("Générer avec une IA (questionnaire)"), href: '/questionnaire', primary: !done.nutrition },
              { label: t("J'ai déjà un plan à importer"), href: '/preferences/nutrition?pick=1' },
            ]}
          />

          <Step
            icon="sport"
            title={t('Sport')}
            done={done.sport}
            description={t('Un programme de séances avec un mode « séance en direct ». Importe-en un, fais-le générer par une IA, ou crée-le toi-même exercice par exercice.')}
            actions={[
              { label: t('Générer avec une IA (questionnaire)'), href: '/sport-questionnaire', primary: !done.sport },
              { label: t("J'ai déjà un programme à importer"), href: '/preferences/sport?pick=1' },
              { label: t('Créer le programme à la main'), href: '/sport-editor' },
            ]}
          />

          <Step
            icon="bins"
            title={t('Poubelles')}
            done={done.waste}
            description={t('Un rappel la veille au soir pour sortir les bonnes poubelles. Indique simplement les jours de ramassage.')}
            actions={[{ label: t('Régler les jours de ramassage'), href: '/preferences/waste' }]}
          />

          <PressableFeedback onPress={finish} haptic="selection">
            <ThemedView type={anythingDone ? 'accent' : 'backgroundElement'} style={styles.finish}>
              <ThemedText type="link" themeColor={anythingDone ? 'accentOnColor' : 'textSecondary'}>
                {anythingDone ? t('Commencer') : t("Passer pour l'instant")}
              </ThemedText>
              <Ionicons name="arrow-forward" size={18} color={anythingDone ? theme.accentOnColor : theme.textSecondary} />
            </ThemedView>
          </PressableFeedback>
          {!anythingDone && (
            <ThemedText type="small" themeColor="textFaint" style={styles.centered}>
              {t('Tu retrouveras tout dans Réglages › Nutrition, Sport et Poubelles.')}
            </ThemedText>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function Step({
  icon,
  title,
  description,
  done,
  actions,
}: {
  icon: IllustrationName;
  title: string;
  description: string;
  done: boolean;
  actions: Action[];
}) {
  const theme = useTheme();
  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <View style={styles.cardHeader}>
        <SectionIcon name={icon} size={28} />
        <ThemedText type="smallBold" style={styles.cardTitle}>
          {title}
        </ThemedText>
        {done && (
          <View style={styles.doneBadge}>
            <Ionicons name="checkmark-circle" size={18} color={theme.accent} />
            <ThemedText type="small" themeColor="accent">
              {t('Prêt')}
            </ThemedText>
          </View>
        )}
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {description}
      </ThemedText>
      {actions.map((action) => (
        <PressableFeedback key={action.label} onPress={() => router.push(action.href)} haptic="selection">
          <ThemedView type={action.primary ? 'accent' : 'background'} style={[styles.action, !action.primary && { borderColor: theme.line, borderWidth: 1 }]}>
            <ThemedText type="link" themeColor={action.primary ? 'accentOnColor' : 'text'}>
              {action.label}
            </ThemedText>
          </ThemedView>
        </PressableFeedback>
      ))}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, alignItems: 'center' },
  scroll: { width: '100%' },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  hero: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingTop: Spacing.three,
    backgroundColor: 'transparent',
  },
  centered: { textAlign: 'center' },
  wordmark: { width: 260, aspectRatio: 780 / 266 },
  card: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: 'transparent',
  },
  cardTitle: { flex: 1 },
  doneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  action: {
    borderRadius: Spacing.two,
    paddingVertical: Spacing.two,
    alignItems: 'center',
  },
  finish: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
  },
});
