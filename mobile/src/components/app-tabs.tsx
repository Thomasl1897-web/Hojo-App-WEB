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
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Barre d'onglets flottante, aux illustrations en couleur (comme sur la planche d'ambiance).
 * Faite maison avec les composants de navigation "headless" d'expo-router plutôt qu'avec la barre
 * native : celle-ci applique une teinte unie à ses icônes (une illustration deviendrait une
 * silhouette) et ne peut pas flotter. Le prix : plus de comportement natif de la barre.
 */
export default function AppTabs() {
  return (
    <Tabs>
      <TabSlot style={{ flex: 1 }} />
      <TabList asChild>
        <FloatingTabBar>
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
        </FloatingTabBar>
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

function FloatingTabBar(props: TabListProps) {
  const insets = useSafeAreaInsets();
  const theme = useTheme();

  return (
    <View {...props} style={[styles.container, { bottom: Math.max(insets.bottom, 8) + 8 }]}>
      <ThemedView type="backgroundElement" style={[styles.bar, { borderColor: theme.line }]}>
        {props.children}
      </ThemedView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: Spacing.three,
    right: Spacing.three,
    alignItems: 'center',
  },
  bar: {
    flexDirection: 'row',
    width: '100%',
    maxWidth: 520,
    borderRadius: 28,
    borderWidth: 1,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
    shadowColor: '#0A2A30',
    shadowOpacity: 0.14,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
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
