import { router, type Href } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableFeedback } from '@/components/pressable-feedback';
import { t, msg } from '@/i18n';
import { MountainImage } from '@/components/mountain-image';
import { IconBadge, type BadgeIcon } from '@/components/section-icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';

type Section = { key: string; title: string; href: Href; icon: BadgeIcon };

const SECTIONS: Section[] = [
  { key: 'appearance', title: msg('Apparence'), href: '/preferences/appearance', icon: { vector: 'moon-outline' } },
  { key: 'notifications', title: msg('Notifications'), href: '/preferences/notifications', icon: { vector: 'notifications-outline' } },
  { key: 'nutrition', title: msg('Nutrition'), href: '/preferences/nutrition', icon: { illustration: 'plate' } },
  { key: 'waste', title: msg('Poubelles'), href: '/preferences/waste', icon: { illustration: 'bins' } },
  { key: 'sport', title: msg('Sport'), href: '/preferences/sport', icon: { illustration: 'sport' } },
  { key: 'statistics', title: msg('Statistiques'), href: '/preferences/statistics', icon: { illustration: 'checklist' } },
  { key: 'health', title: msg('Santé'), href: '/preferences/health', icon: { vector: 'heart-outline' } },
  { key: 'language', title: msg('Langue'), href: '/preferences/language', icon: { vector: 'language-outline' } },
  { key: 'backup', title: msg('Sauvegarde'), href: '/preferences/backup', icon: { vector: 'cloud-upload-outline' } },
];

export default function SettingsScreen() {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: BottomTabInset + Spacing.three }]}>
          <ThemedText type="title" style={styles.title}>
            {t('Réglages')}
          </ThemedText>

          {SECTIONS.map((section) => (
            <PressableFeedback key={section.key} onPress={() => router.push(section.href)}>
              <ThemedView type="backgroundElement" style={styles.row}>
                <IconBadge icon={section.icon} />
                <ThemedText type="smallBold" style={styles.rowTitle}>
                  {t(section.title)}
                </ThemedText>
                <ThemedText themeColor="textFaint" style={styles.chevron}>
                  ›
                </ThemedText>
              </ThemedView>
            </PressableFeedback>
          ))}

          <ThemedView type="backgroundElement" style={styles.mountainCard}>
            <MountainImage style={styles.mountainImage} align="right" />
            <ThemedText type="smallBold" style={styles.mountainText}>
              {t('Petits pas.')}
            </ThemedText>
            <ThemedText type="smallBold" style={styles.mountainText}>
              {t('Grands résultats.')}
            </ThemedText>
          </ThemedView>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    alignItems: 'center',
  },
  scrollView: {
    width: '100%',
  },
  scrollContent: {
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.four,
    gap: Spacing.two,
  },
  title: {
    marginTop: Spacing.four,
    marginBottom: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  rowTitle: {
    flex: 1,
  },
  mountainCard: {
    borderRadius: Spacing.three,
    overflow: 'hidden',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.four,
    marginTop: Spacing.two,
    justifyContent: 'center',
  },
  mountainImage: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  },
  mountainText: {
    fontSize: 15,
    lineHeight: 22,
  },
  chevron: {
    fontSize: 22,
    lineHeight: 26,
  },
});
