import Ionicons from '@expo/vector-icons/Ionicons';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { PressableFeedback } from '@/components/pressable-feedback';
import { SleepRing } from '@/components/sleep-ring';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ModalOverlay, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';
import { formatLongDate, parseDateString } from '@/lib/date';
import { formatSleepDuration, sleepScoreLabel, type SleepNight } from '@/lib/sleep';

/**
 * Détail de la dernière nuit, ouvert en touchant l'anneau de l'écran Aujourd'hui. Sans nuit à montrer, la fenêtre
 * explique d'où vient le score et mène à la connexion de Health Connect.
 */
export function SleepModal({
  visible,
  night,
  connected,
  onClose,
  onConnect,
}: {
  visible: boolean;
  night: SleepNight | null;
  connected: boolean;
  onClose: () => void;
  onConnect: () => void;
}) {
  const theme = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable onPress={() => {}} style={styles.wrapper}>
          <ThemedView type="backgroundElement" style={styles.card}>
            <View style={styles.header}>
              <ThemedText type="eyebrow" themeColor="accent">
                {t('Sommeil')}
              </ThemedText>
              <Pressable onPress={onClose} hitSlop={Spacing.three} accessibilityLabel={t('Fermer')}>
                <Ionicons name="close" size={24} color={theme.textSecondary} />
              </Pressable>
            </View>

            {night ? (
              <>
                <View style={styles.hero}>
                  <SleepRing score={night.score} size={120} thickness={12} fontSize={38} />
                  <ThemedText type="subtitle">{t(sleepScoreLabel(night.score))}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {t('Nuit du réveil du {date}', { date: formatLongDate(parseDateString(night.date)) })}
                  </ThemedText>
                </View>

                <Row label={t('Sommeil')} value={formatSleepDuration(night.asleepMinutes)} />
                {night.hasStages && (
                  <>
                    <Row label={t('Profond')} value={formatSleepDuration(night.deepMinutes)} />
                    <Row label={t('Paradoxal (REM)')} value={formatSleepDuration(night.remMinutes)} />
                    <Row label={t('Léger')} value={formatSleepDuration(night.lightMinutes)} />
                    <Row label={t('Éveillé')} value={formatSleepDuration(night.awakeMinutes)} />
                  </>
                )}
                <Row label={t('Au lit')} value={formatSleepDuration(night.inBedMinutes)} />
                {!night.hasStages && (
                  <ThemedText type="small" themeColor="textFaint">
                    {t("Ta montre n'a pas détaillé les phases de sommeil : le score ne repose que sur la durée.")}
                  </ThemedText>
                )}
              </>
            ) : (
              <View style={styles.hero}>
                <SleepRing score={null} size={96} thickness={10} />
                <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
                  {connected
                    ? t("Aucune nuit récente dans Health Connect. Porte ta montre cette nuit : le score apparaîtra après la synchronisation. Si tu viens de mettre à jour l'app, autorise aussi la lecture du sommeil dans Réglages › Santé.")
                    : t('Connecte Health Connect (Réglages › Santé) pour voir ton sommeil ici : durée, phases et un score sur 100.')}
                </ThemedText>
                {!connected && (
                  <PressableFeedback onPress={onConnect}>
                    <ThemedView type="accent" style={styles.button}>
                      <ThemedText type="link" themeColor="accentOnColor">
                        {t('Ouvrir les réglages Santé')}
                      </ThemedText>
                    </ThemedView>
                  </PressableFeedback>
                )}
              </View>
            )}

            <ThemedText type="small" themeColor="textFaint">
              {t("Ce score sur 100 est calculé par Hojo (durée, sommeil profond et paradoxal, continuité). Ce n'est pas le score de Google, Fitbit ou Garmin.")}
            </ThemedText>
          </ThemedView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="data">{value}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: ModalOverlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.four,
  },
  wrapper: {
    width: '100%',
    maxWidth: 380,
  },
  card: {
    borderRadius: Spacing.four,
    padding: Spacing.four,
    gap: Spacing.two,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  hero: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
  centered: {
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  button: {
    borderRadius: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    alignItems: 'center',
  },
});
