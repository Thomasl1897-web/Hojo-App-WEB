import Ionicons from '@expo/vector-icons/Ionicons';
import { router, type Href } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';

/**
 * Bouton « Retour » des en-têtes, pour le WEB. Ouvert directement sur une adresse (lien partagé, page rechargée),
 * l'écran n'a aucun historique derrière lui : le bouton par défaut n'apparaît pas et on resterait coincé, puisque
 * ces écrans n'ont pas la barre d'onglets. Sans historique, on rejoint `fallback`.
 */
export function WebBackButton({ fallback }: { fallback: Href }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={() => (router.canGoBack() ? router.back() : router.replace(fallback))}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel={t('Retour')}
      style={styles.button}>
      <Ionicons name="chevron-back" size={22} color={theme.accent} />
      <ThemedText type="small" style={{ color: theme.accent }}>
        {t('Retour')}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingRight: 12,
  },
});
