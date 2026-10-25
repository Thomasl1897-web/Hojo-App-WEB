import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { StyleSheet, useColorScheme } from 'react-native';

import { ThemedView } from '@/components/themed-view';

const BACKGROUND = require('@/assets/images/workout-background.jpg');

/**
 * Fond de l'écran de séance en direct : brume et montagnes (Design/workout_background_*.png), calées en bas
 * et recadrées pour remplir n'importe quel écran (une seule image suffit, les deux fichiers de la planche sont
 * le même dessin à deux tailles d'iPhone). L'image est claire : en thème sombre elle est presque effacée (10 %) pour
 * laisser le texte clair lisible, comme la montagne de l'écran Aujourd'hui.
 */
export function SessionScreen({ children }: { children: ReactNode }) {
  const dark = useColorScheme() === 'dark';
  return (
    <ThemedView style={styles.container}>
      <Image
        source={BACKGROUND}
        style={[styles.background, { opacity: dark ? 0.1 : 1 }]}
        contentFit="cover"
        contentPosition="bottom"
        accessible={false}
      />
      {children}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  background: {
    ...StyleSheet.absoluteFill,
  },
});
