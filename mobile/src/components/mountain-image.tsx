import { Image, type ImageStyle } from 'expo-image';
import type { StyleProp } from 'react-native';
import { useColorScheme } from 'react-native';

/**
 * Paysage de montagne de la planche d'ambiance, en deux variantes déjà préparées avec une
 * transparence progressive pour se poser sur n'importe quel fond sans bord visible :
 * - `banner` : fondu en haut ET en bas (bande décorative au milieu d'un écran) ;
 * - `footer` : fondu en haut seulement, le bas reste plein (posé juste au-dessus de la barre
 *   d'onglets, en bas d'écran).
 * Très pâle par nature, il est atténué en mode sombre pour ne pas y faire une tache claire.
 */
export function MountainImage({
  variant = 'banner',
  style,
  align = 'center',
}: {
  variant?: 'banner' | 'footer';
  style?: StyleProp<ImageStyle>;
  align?: 'center' | 'right' | 'left' | 'bottom';
}) {
  const scheme = useColorScheme();
  return (
    <Image
      source={
        variant === 'footer'
          ? require('@/assets/images/mountain-footer.png')
          : require('@/assets/images/mountain-banner.png')
      }
      style={[{ opacity: scheme === 'dark' ? 0.28 : 1 }, style]}
      contentFit="cover"
      contentPosition={align}
      pointerEvents="none"
    />
  );
}
