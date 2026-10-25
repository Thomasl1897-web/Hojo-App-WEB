import Ionicons from '@expo/vector-icons/Ionicons';
import { TabList, Tabs, TabSlot, TabTrigger, type TabListProps, type TabTriggerSlotProps } from 'expo-router/ui';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { hapticSelection } from '@/lib/haptics';
import { t } from '@/i18n';
import { SectionIcon, type BadgeIcon } from '@/components/section-icon';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Barre d'onglets ancrée en bas de l'écran (pleine largeur, jusqu'au bord et sous la zone du geste système),
 * aux illustrations en couleur (comme sur la planche d'ambiance). Elle ne flotte plus : le contenu s'arrête
 * à son bord supérieur. Faite maison avec les composants de navigation "headless" d'expo-router plutôt
 * qu'avec la barre native : celle-ci applique une teinte unie à ses icônes (une illustration deviendrait une
 * silhouette). Le prix : plus de comportement natif de la barre.
 */
export default function AppTabs() {
  return (
    <Tabs>
      <TabSlot style={{ flex: 1 }} />
      <TabList asChild>
        <BottomTabBar>
          <TabTrigger name="index" href="/" asChild>
            <TabButton label="Aujourd'hui" icon={{ illustration: 'logo' }} />
          </TabTrigger>
          <TabTrigger name="nutrition" href="/nutrition" asChild>
            <TabButton label="Nutrition" icon={{ illustration: 'plate' }} />
          </TabTrigger>
          <TabTrigger name="sport" href="/sport" asChild>
            <TabButton label="Sport" icon={{ illustration: 'sport' }} />
          </TabTrigger>
          <TabTrigger name="settings" href="/settings" asChild>
            <TabButton label="Réglages" icon={{ vector: 'settings' }} />
          </TabTrigger>
        </BottomTabBar>
      </TabList>
    </Tabs>
  );
}

function TabButton({
  label,
  icon,
  isFocused,
  ...props
}: TabTriggerSlotProps & { label: string; icon: BadgeIcon }) {
  const theme = useTheme();
  const focused = Boolean(isFocused);
  const reduceMotion = useReducedMotion();
  const pop = useSharedValue(1);
  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.get() }] }));

  // Petit rebond de l'illustration quand l'onglet devient actif.
  useEffect(() => {
    if (focused && !reduceMotion) {
      pop.set(0.8);
      pop.set(withSpring(1, { damping: 8, stiffness: 220 }));
    }
  }, [focused, reduceMotion, pop]);

  return (
    <Pressable
      {...props}
      onPress={(event) => {
        if (!focused) hapticSelection();
        props.onPress?.(event);
      }}
      style={styles.tab} accessibilityRole="tab" accessibilityLabel={t(label)} accessibilityState={{ selected: focused }}>
      <Animated.View style={[styles.iconWrap, popStyle]}>
        {'illustration' in icon ? (
          <View style={focused ? undefined : styles.inactiveIcon}>
            <SectionIcon name={icon.illustration} size={34} />
          </View>
        ) : (
          <Ionicons name={icon.vector} size={28} color={focused ? theme.accent : theme.textFaint} />
        )}
      </Animated.View>
      <ThemedText
        type="small"
        themeColor={focused ? 'text' : 'textFaint'}
        style={[styles.label, focused && styles.labelFocused]}
        numberOfLines={1}>
        {t(label)}
      </ThemedText>
    </Pressable>
  );
}

function BottomTabBar(props: TabListProps) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  return (
    <View
      {...props}
      style={[
        styles.container,
        {
          backgroundColor: theme.backgroundElement,
          borderTopColor: theme.line,
          // Sous la barre : la zone du geste système (iPhone, Android à gestes), sinon un petit espace.
          paddingBottom: Math.max(insets.bottom, Spacing.one),
        },
      ]}>
      <View style={styles.bar}>{props.children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.one,
  },
  bar: {
    flexDirection: 'row',
    width: '100%',
    maxWidth: 520,
    paddingHorizontal: Spacing.two,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: Spacing.one,
  },
  iconWrap: {
    width: 56,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inactiveIcon: {
    opacity: 0.6,
    filter: [{ grayscale: 1 }],
  },
  label: {
    fontSize: 11,
    lineHeight: 14,
  },
  labelFocused: {
    fontWeight: '700',
  },
});
