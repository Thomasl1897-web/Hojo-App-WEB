import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, StyleSheet } from 'react-native';

import { PressableFeedback } from '@/components/pressable-feedback';
import { t, tp, msg } from '@/i18n';
import { FieldGroup, Tier } from '@/components/form-fields';
import { PreferenceScreen } from '@/components/preference-screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatLongDate, parseDateString } from '@/lib/date';
import { formatDuration } from '@/lib/sport-activity';
import { deleteSportActivity, getAllSportActivities, getCompletionHistory } from '@/lib/sport-db';
import {
  breakdownByActivity,
  buildHistory,
  filterHistory,
  groupByMonth,
  summarizeHistory,
  type HistoryActivity,
  type HistoryEntry,
  type HistoryFilter,
} from '@/lib/sport-history';

const PAGE_SIZE = 40;

const EMPTY_MESSAGES: Record<HistoryFilter, string> = {
  all: msg('Aucun entraînement enregistré'),
  program: msg("Aucune séance de ton programme terminée pour l'instant"),
  activity: msg("Aucune autre activité saisie à la main pour l'instant"),
};

function Tile({
  label,
  value,
  selected,
  onPress,
}: {
  label: string;
  value: number;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <PressableFeedback onPress={onPress} style={styles.tilePressable} accessibilityRole="button" accessibilityState={{ selected }}>
      <ThemedView type={selected ? 'accent' : 'backgroundSelected'} style={styles.tile}>
        <ThemedText type="eyebrow" themeColor={selected ? 'accentOnColor' : 'textFaint'}>
          {label}
        </ThemedText>
        <ThemedText type="data" themeColor={selected ? 'accentOnColor' : 'text'} style={styles.tileValue}>
          {value}
        </ThemedText>
      </ThemedView>
    </PressableFeedback>
  );
}

export default function StatisticsScreen() {
  const theme = useTheme();
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [activities, setActivities] = useState<HistoryActivity[]>([]);
  const [filter, setFilter] = useState<HistoryFilter>('all');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const load = useCallback(() => {
    const allActivities = getAllSportActivities();
    setActivities(allActivities);
    setEntries(buildHistory(getCompletionHistory(), allActivities));
  }, []);
  useFocusEffect(load);

  // Retoucher la tuile déjà choisie annule le filtre ; changer de filtre repart du début de la liste.
  function toggleFilter(next: HistoryFilter) {
    setFilter((current) => (current === next ? 'all' : next));
    setVisibleCount(PAGE_SIZE);
  }

  function confirmDelete(entry: HistoryEntry) {
    if (entry.activityId === null) return;
    const activityId = entry.activityId;
    Alert.alert(t('Supprimer cette activité ?'), `${entry.title} · ${formatLongDate(parseDateString(entry.date))}`, [
      { text: t('Annuler'), style: 'cancel' },
      {
        text: t('Supprimer'),
        style: 'destructive',
        onPress: () => {
          deleteSportActivity(activityId);
          load();
        },
      },
    ]);
  }

  const today = new Date();
  const totals = summarizeHistory(entries, today);
  const filtered = filterHistory(entries, filter);
  const filteredThisMonth = summarizeHistory(filtered, today).thisMonth;
  const breakdown = breakdownByActivity(activities);
  const months = groupByMonth(filtered.slice(0, visibleCount));
  const remaining = filtered.length - visibleCount;

  if (entries.length === 0) {
    return (
      <PreferenceScreen>
        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText type="smallBold">{t(EMPTY_MESSAGES.all)}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {t('Les séances de ton programme terminées et les activités ajoutées à la main apparaîtront ici.')}
          </ThemedText>
        </ThemedView>
      </PreferenceScreen>
    );
  }

  return (
    <PreferenceScreen>
      <ThemedView type="backgroundElement" style={styles.card}>
        <FieldGroup title="Vue d'ensemble" icon="checklist">
          <ThemedView style={styles.tiles}>
            <Tile label="Total" value={totals.total} selected={filter === 'all'} onPress={() => toggleFilter('all')} />
            <Tile
              label="Programme"
              value={totals.program}
              selected={filter === 'program'}
              onPress={() => toggleFilter('program')}
            />
            <Tile
              label="Autres"
              value={totals.activities}
              selected={filter === 'activity'}
              onPress={() => toggleFilter('activity')}
            />
          </ThemedView>
          <ThemedText type="small" themeColor="textSecondary">
            {tp(filteredThisMonth, 'Ce mois-ci : {count} entraînement', 'Ce mois-ci : {count} entraînements')}
          </ThemedText>
          <ThemedText type="small" themeColor="textFaint">
            {t("Touche une tuile pour filtrer l'historique, une activité pour la modifier.")}
          </ThemedText>
        </FieldGroup>
      </ThemedView>

      {filter !== 'program' && breakdown.length > 0 && (
        <ThemedView type="backgroundElement" style={styles.card}>
          <FieldGroup title="Autres activités">
            {breakdown.map((item) => (
              <ThemedView key={item.name} style={styles.breakdownRow}>
                <ThemedText type="small" style={styles.breakdownName}>
                  {item.name}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {tp(item.count, '{count} fois', '{count} fois')}{item.minutes > 0 ? ` · ${formatDuration(item.minutes)}` : ''}
                </ThemedText>
              </ThemedView>
            ))}
          </FieldGroup>
        </ThemedView>
      )}

      {filtered.length === 0 && (
        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText type="small" themeColor="textSecondary">
            {t(EMPTY_MESSAGES[filter])}
          </ThemedText>
        </ThemedView>
      )}

      {months.map((month) => (
        <ThemedView key={month.key} style={styles.section}>
          <ThemedText type="eyebrow" themeColor="textFaint">
            {month.title}
          </ThemedText>
          <ThemedView type="backgroundElement" style={styles.card}>
            {month.entries.map((entry, index) => (
              <ThemedView
                key={entry.key}
                style={[styles.row, index > 0 && { borderTopWidth: 1, borderTopColor: theme.lineSoft }]}>
                <PressableFeedback
                  style={styles.rowText}
                  disabled={entry.activityId === null || entry.imported}
                  onPress={() =>
                    entry.activityId !== null &&
                    router.push({ pathname: '/add-activity', params: { id: String(entry.activityId) } })
                  }
                  accessibilityLabel={entry.activityId !== null && !entry.imported ? t('Modifier {name}', { name: entry.title }) : undefined}>
                  <ThemedText type="smallBold">{entry.title}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {formatLongDate(parseDateString(entry.date))}
                    {entry.durationMinutes !== null ? ` · ${formatDuration(entry.durationMinutes)}` : ''}
                  </ThemedText>
                </PressableFeedback>
                {entry.kind === 'program' ? (
                  <Tier label="Programme" tone="accent" />
                ) : entry.imported ? (
                  <Tier label="Importé" tone="neutral" />
                ) : (
                  <>
                    <Tier label="Autre" tone="neutral" />
                    <PressableFeedback
                      onPress={() => confirmDelete(entry)}
                      hitSlop={Spacing.two}
                      accessibilityLabel={t('Supprimer {name}', { name: entry.title })}>
                      <ThemedText type="small" themeColor="textFaint">
                        ✕
                      </ThemedText>
                    </PressableFeedback>
                  </>
                )}
              </ThemedView>
            ))}
          </ThemedView>
        </ThemedView>
      ))}

      {remaining > 0 && (
        <PressableFeedback onPress={() => setVisibleCount((count) => count + PAGE_SIZE)}>
          <ThemedText type="small" themeColor="accent" style={styles.moreLink}>
            {tp(remaining, 'Voir plus ({count} restant)', 'Voir plus ({count} restants)')}
          </ThemedText>
        </PressableFeedback>
      )}
    </PreferenceScreen>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    gap: Spacing.two,
  },
  section: {
    gap: Spacing.one,
    backgroundColor: 'transparent',
  },
  tiles: {
    flexDirection: 'row',
    gap: Spacing.two,
    backgroundColor: 'transparent',
  },
  tilePressable: {
    flex: 1,
  },
  tile: {
    borderRadius: Spacing.two,
    padding: Spacing.two,
    gap: Spacing.half,
  },
  tileValue: {
    fontSize: 22,
    lineHeight: 28,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.two,
    backgroundColor: 'transparent',
  },
  breakdownName: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.two,
  },
  rowText: {
    flex: 1,
    gap: Spacing.half,
    backgroundColor: 'transparent',
  },
  moreLink: {
    textAlign: 'center',
    paddingVertical: Spacing.two,
  },
});
