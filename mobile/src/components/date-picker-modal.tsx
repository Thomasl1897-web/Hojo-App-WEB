import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { t } from '@/i18n';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ModalOverlay, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { buildMonthGrid, daysBetween, isSameDay, shiftMonth } from '@/lib/calendar';
import { formatMonthYear, weekdayName } from '@/lib/date';
import { WEEKDAYS } from '@/lib/nutrition-schema';


/**
 * Calendrier en fenêtre : on choisit un jour dans un mois à la fois. Les jours à plus de
 * `maxDaysBack` / `maxDaysAhead` d'aujourd'hui sont grisés et non sélectionnables, et les flèches
 * de mois s'arrêtent là où il n'y a plus rien à choisir.
 */
export function DatePickerModal({
  visible,
  selected,
  today,
  maxDaysBack,
  maxDaysAhead,
  onSelect,
  onClose,
}: {
  visible: boolean;
  selected: Date;
  today: Date;
  maxDaysBack: number;
  maxDaysAhead: number;
  onSelect: (date: Date) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* Un appui dans la carte ne doit pas fermer la fenêtre */}
        <Pressable onPress={() => {}} style={styles.cardWrapper}>
          {/* Contenu monté seulement à l'ouverture : le mois affiché repart du jour sélectionné */}
          {visible && (
            <Calendar
              selected={selected}
              today={today}
              maxDaysBack={maxDaysBack}
              maxDaysAhead={maxDaysAhead}
              onSelect={onSelect}
              onClose={onClose}
            />
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** Initiales des jours, du lundi au dimanche, dans la langue courante (L M M J V S D / M T W T F S S). */
function WEEKDAY_INITIALS(): string[] {
  return WEEKDAYS.map((day) => weekdayName(day).charAt(0).toUpperCase());
}

function Calendar({
  selected,
  today,
  maxDaysBack,
  maxDaysAhead,
  onSelect,
  onClose,
}: {
  selected: Date;
  today: Date;
  maxDaysBack: number;
  maxDaysAhead: number;
  onSelect: (date: Date) => void;
  onClose: () => void;
}) {
  const theme = useTheme();
  const [month, setMonth] = useState({ year: selected.getFullYear(), monthIndex: selected.getMonth() });

  const weeks = buildMonthGrid(month.year, month.monthIndex);
  const isSelectable = (date: Date) => {
    const offset = daysBetween(today, date);
    return offset >= -maxDaysBack && offset <= maxDaysAhead;
  };

  const lastOfMonth = new Date(month.year, month.monthIndex + 1, 0);
  const firstOfMonth = new Date(month.year, month.monthIndex, 1);
  const canGoBack = isSelectable(lastOfMonth) && daysBetween(today, firstOfMonth) > -maxDaysBack;
  const canGoForward = daysBetween(today, lastOfMonth) < maxDaysAhead;

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <View style={styles.header}>
        <Pressable
          onPress={() => setMonth(shiftMonth(month.year, month.monthIndex, -1))}
          disabled={!canGoBack}
          hitSlop={Spacing.two}
          accessibilityLabel={t('Mois précédent')}>
          <Ionicons name="chevron-back" size={22} color={canGoBack ? theme.accent : theme.line} />
        </Pressable>
        <ThemedText type="smallBold">{formatMonthYear(firstOfMonth)}</ThemedText>
        <Pressable
          onPress={() => setMonth(shiftMonth(month.year, month.monthIndex, 1))}
          disabled={!canGoForward}
          hitSlop={Spacing.two}
          accessibilityLabel={t('Mois suivant')}>
          <Ionicons name="chevron-forward" size={22} color={canGoForward ? theme.accent : theme.line} />
        </Pressable>
      </View>

      <View style={styles.weekRow}>
        {WEEKDAY_INITIALS().map((initial, index) => (
          <ThemedText key={index} type="eyebrow" themeColor="textFaint" style={styles.cell}>
            {initial}
          </ThemedText>
        ))}
      </View>

      {weeks.map((week, weekIndex) => (
        <View key={weekIndex} style={styles.weekRow}>
          {week.map((date, dayIndex) => {
            if (!date) return <View key={dayIndex} style={styles.cell} />;
            const isSelected = isSameDay(date, selected);
            const isToday = isSameDay(date, today);
            const selectable = isSelectable(date);
            return (
              <Pressable
                key={dayIndex}
                style={styles.cell}
                disabled={!selectable}
                onPress={() => onSelect(date)}
                accessibilityLabel={`${date.getDate()}`}>
                <View
                  style={[
                    styles.day,
                    isToday && !isSelected && { borderWidth: 1.5, borderColor: theme.accent },
                    isSelected && { backgroundColor: theme.accent },
                  ]}>
                  <ThemedText
                    type="small"
                    themeColor={isSelected ? 'accentOnColor' : selectable ? 'text' : 'textFaint'}
                    style={!selectable && styles.disabled}>
                    {date.getDate()}
                  </ThemedText>
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}

      <View style={styles.footer}>
        <Pressable onPress={() => onSelect(today)} hitSlop={Spacing.two}>
          <ThemedText type="small" themeColor="accent">
            {t("Aujourd'hui")}
          </ThemedText>
        </Pressable>
        <Pressable onPress={onClose} hitSlop={Spacing.two}>
          <ThemedText type="small" themeColor="textSecondary">
            {t('Fermer')}
          </ThemedText>
        </Pressable>
      </View>
    </ThemedView>
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
  cardWrapper: {
    width: '100%',
    maxWidth: 360,
  },
  card: {
    borderRadius: Spacing.four,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: Spacing.two,
  },
  weekRow: {
    flexDirection: 'row',
  },
  cell: {
    width: `${100 / 7}%`,
    alignItems: 'center',
    textAlign: 'center',
    paddingVertical: 2,
  },
  day: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.4,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: Spacing.three,
  },
});
