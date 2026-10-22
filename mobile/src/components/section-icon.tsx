import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

/**
 * Petites illustrations tirées de la planche de design (découpées sur fond transparent), à
 * utiliser en TOUT PETIT comme icônes de pages et de sections.
 */
const ILLUSTRATIONS = {
  logo: require('@/assets/images/icons/logo.png'),
  plate: require('@/assets/images/icons/plate.png'),
  sport: require('@/assets/images/icons/sport.png'),
  basket: require('@/assets/images/icons/basket.png'),
  bins: require('@/assets/images/icons/bins.png'),
  checklist: require('@/assets/images/icons/checklist.png'),
} as const;

export type IllustrationName = keyof typeof ILLUSTRATIONS;

export function SectionIcon({ name, size = 28 }: { name: IllustrationName; size?: number }) {
  return <Image source={ILLUSTRATIONS[name]} style={{ width: size, height: size }} contentFit="contain" />;
}

export type BadgeIcon = { illustration: IllustrationName } | { vector: ComponentProps<typeof Ionicons>['name'] };

/** Pastille ronde d'une rubrique : une illustration, ou à défaut une icône au trait. */
export function IconBadge({ icon, size = 44 }: { icon: BadgeIcon; size?: number }) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.badge,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: 'transparent',
        },
      ]}>
      {'illustration' in icon ? (
        <SectionIcon name={icon.illustration} size={Math.round(size * 0.62)} />
      ) : (
        <Ionicons name={icon.vector} size={Math.round(size * 0.5)} color={theme.accent} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
