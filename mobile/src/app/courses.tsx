import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableFeedback } from '@/components/pressable-feedback';
import { t } from '@/i18n';
import { ChipSingleSelect, Tier } from '@/components/form-fields';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getCycleDayForDate } from '@/lib/date';
import {
  formatQuantity,
  groupShoppingItems,
  parseCustomItemInput,
  type ShoppingItem,
} from '@/lib/nutrition-courses';
import {
  clearShoppingChecks,
  getActivePlanMeta,
  getCourseWeeks,
  getShoppingItems,
  setShoppingItemChecked,
} from '@/lib/nutrition-db';
import {
  addCustomItem,
  deleteCheckedCustomItems,
  deleteCustomItem,
  getCustomItems,
  setCustomItemChecked,
  type CustomShoppingItem,
} from '@/lib/shopping-db';

export default function CoursesScreen() {
  const theme = useTheme();
  const [hasPlan, setHasPlan] = useState(false);
  const [weeks, setWeeks] = useState<number[]>([]);
  const [week, setWeek] = useState<number | null>(null);
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [customItems, setCustomItems] = useState<CustomShoppingItem[]>([]);
  const [newName, setNewName] = useState('');
  const [newQuantity, setNewQuantity] = useState('');

  const load = useCallback(() => {
    const meta = getActivePlanMeta();
    setHasPlan(meta !== null);
    setCustomItems(getCustomItems());
    const availableWeeks = getCourseWeeks();
    setWeeks(availableWeeks);

    // Au premier affichage, on ouvre la semaine du cycle dans laquelle on se trouve.
    setWeek((current) => {
      if (current !== null && availableWeeks.includes(current)) return current;
      if (availableWeeks.length === 0) return null;
      const cycleDay = meta ? getCycleDayForDate(meta.cycleStartDate, meta.cycleLengthDays) : 1;
      const currentWeek = Math.ceil(cycleDay / 7);
      return availableWeeks.includes(currentWeek) ? currentWeek : availableWeeks[0];
    });
  }, []);

  useFocusEffect(load);

  const loadItems = useCallback((selectedWeek: number | null) => {
    setItems(selectedWeek === null ? [] : getShoppingItems(selectedWeek));
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadItems(week);
    }, [loadItems, week]),
  );

  function toggleItem(item: ShoppingItem) {
    setShoppingItemChecked(item.id, !item.checked);
    setItems((prev) => prev.map((other) => (other.id === item.id ? { ...other, checked: !item.checked } : other)));
  }

  function uncheckAll() {
    if (week === null) return;
    clearShoppingChecks(week);
    setItems((prev) => prev.map((item) => ({ ...item, checked: false })));
  }

  function addItem() {
    const parsed = parseCustomItemInput(newName, newQuantity);
    if (!parsed) return;
    addCustomItem(parsed.name, parsed.quantity);
    setNewName('');
    setNewQuantity('');
    setCustomItems(getCustomItems());
  }

  function toggleCustomItem(item: CustomShoppingItem) {
    setCustomItemChecked(item.id, !item.checked);
    setCustomItems(getCustomItems());
  }

  function removeCustomItem(item: CustomShoppingItem) {
    deleteCustomItem(item.id);
    setCustomItems(getCustomItems());
  }

  function removeCheckedCustomItems() {
    deleteCheckedCustomItems();
    setCustomItems(getCustomItems());
  }

  const sections = groupShoppingItems(items);
  const checkedCount = items.filter((item) => item.checked).length;
  const weekOptions = weeks.map((value) => ({ value, label: t('Semaine {number}', { number: value }) }));
  const hasCheckedCustom = customItems.some((item) => item.checked);
  const canAdd = newName.trim().length > 0;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled">
          <ThemedView style={styles.addRow}>
            <TextInput
              value={newName}
              onChangeText={setNewName}
              onSubmitEditing={addItem}
              returnKeyType="done"
              placeholder={t('Ajouter un article (ex : Lessive)')}
              placeholderTextColor={theme.textSecondary}
              maxLength={80}
              style={[
                styles.input,
                styles.nameInput,
                { color: theme.text, borderColor: theme.line, backgroundColor: theme.backgroundElement },
              ]}
            />
            <TextInput
              value={newQuantity}
              onChangeText={setNewQuantity}
              onSubmitEditing={addItem}
              returnKeyType="done"
              placeholder={t('Qté')}
              placeholderTextColor={theme.textSecondary}
              maxLength={30}
              style={[
                styles.input,
                styles.quantityInput,
                { color: theme.text, borderColor: theme.line, backgroundColor: theme.backgroundElement },
              ]}
            />
            <PressableFeedback onPress={addItem} disabled={!canAdd}>
              <ThemedView type="accent" style={[styles.addButton, !canAdd && styles.addButtonDisabled]}>
                <ThemedText type="link" themeColor="accentOnColor">
                  {t('Ajouter')}
                </ThemedText>
              </ThemedView>
            </PressableFeedback>
          </ThemedView>

          {customItems.length > 0 && (
            <ThemedView style={styles.section}>
              <ThemedView style={styles.sectionHeader}>
                <ThemedText type="eyebrow" themeColor="textFaint">
                  {t('Mes ajouts')}
                </ThemedText>
                {hasCheckedCustom && (
                  <PressableFeedback onPress={removeCheckedCustomItems}>
                    <ThemedText type="small" themeColor="accent">
                      {t('Supprimer les articles cochés')}
                    </ThemedText>
                  </PressableFeedback>
                )}
              </ThemedView>
              <ThemedView type="backgroundElement" style={styles.card}>
                {customItems.map((item, index) => (
                  <ThemedView
                    key={item.id}
                    style={[
                      styles.row,
                      index > 0 && { borderTopWidth: 1, borderTopColor: theme.lineSoft },
                    ]}>
                    <PressableFeedback onPress={() => toggleCustomItem(item)} style={styles.rowMain}>
                      <ThemedView
                        style={[
                          styles.checkbox,
                          { borderColor: theme.textSecondary },
                          item.checked && { backgroundColor: theme.accent, borderColor: theme.accent },
                        ]}
                      />
                      <ThemedText
                        type="smallBold"
                        style={[styles.customName, item.checked && styles.strikethrough, item.checked && { opacity: 0.45 }]}>
                        {item.name}
                      </ThemedText>
                      {item.quantity && (
                        <ThemedText type="data" themeColor="textSecondary" style={styles.quantity}>
                          {item.quantity}
                        </ThemedText>
                      )}
                    </PressableFeedback>
                    <PressableFeedback
                      onPress={() => removeCustomItem(item)}
                      hitSlop={Spacing.two}
                      accessibilityLabel={t('Supprimer {name}', { name: item.name })}>
                      <ThemedText type="small" themeColor="textFaint">
                        ✕
                      </ThemedText>
                    </PressableFeedback>
                  </ThemedView>
                ))}
              </ThemedView>
            </ThemedView>
          )}

          {!hasPlan && (
            <ThemedText type="small" themeColor="textFaint">
              {t('Pas de plan nutrition importé : seuls tes ajouts apparaissent ici.')}
            </ThemedText>
          )}

          {hasPlan && weeks.length === 0 && (
            <ThemedText type="small" themeColor="textFaint">
              {t('Ce plan ne contient pas de liste de courses : seuls tes ajouts apparaissent ici.')}
            </ThemedText>
          )}

          {weeks.length > 1 && (
            <ChipSingleSelect label="Courses de la…" options={weekOptions} value={week} onChange={setWeek} />
          )}

          {items.length > 0 && (
            <ThemedView style={styles.progressRow}>
              <ThemedText type="small" themeColor="textSecondary">
                {t('{checked} / {total} articles du plan', { checked: checkedCount, total: items.length })}
              </ThemedText>
              {checkedCount > 0 && (
                <PressableFeedback onPress={uncheckAll}>
                  <ThemedText type="small" themeColor="accent">
                    {t('Tout décocher')}
                  </ThemedText>
                </PressableFeedback>
              )}
            </ThemedView>
          )}

          {sections.map((section) => (
            <ThemedView key={section.key} style={styles.section}>
              <ThemedText type="eyebrow" themeColor="textFaint">
                {section.title}
              </ThemedText>
              <ThemedView type="backgroundElement" style={styles.card}>
                {section.items.map((item, index) => (
                  <PressableFeedback key={item.id} onPress={() => toggleItem(item)}>
                    <ThemedView
                      style={[
                        styles.row,
                        index > 0 && { borderTopWidth: 1, borderTopColor: theme.lineSoft },
                        item.checked && { opacity: 0.45 },
                      ]}>
                      <ThemedView
                        style={[
                          styles.checkbox,
                          { borderColor: theme.textSecondary },
                          item.checked && { backgroundColor: theme.accent, borderColor: theme.accent },
                        ]}
                      />
                      <ThemedView style={styles.rowText}>
                        <ThemedText type="smallBold" style={item.checked && styles.strikethrough}>
                          {item.name}
                        </ThemedText>
                        {item.needsFreezing && <Tier label="À congeler" tone="warn" />}
                      </ThemedView>
                      <ThemedText type="data" themeColor="textSecondary" style={styles.quantity}>
                        {formatQuantity(item)}
                      </ThemedText>
                    </ThemedView>
                  </PressableFeedback>
                ))}
              </ThemedView>
            </ThemedView>
          ))}
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
    padding: Spacing.four,
    gap: Spacing.three,
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: 'transparent',
  },
  input: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.two,
    fontSize: 14,
  },
  nameInput: {
    flex: 1,
  },
  quantityInput: {
    width: 64,
  },
  addButton: {
    borderRadius: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
  },
  addButtonDisabled: {
    opacity: 0.4,
  },
  card: {
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    gap: Spacing.one,
  },
  section: {
    gap: Spacing.one,
    backgroundColor: 'transparent',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: 'transparent',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
  },
  rowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  rowText: {
    flex: 1,
    gap: Spacing.half,
    alignItems: 'flex-start',
    backgroundColor: 'transparent',
  },
  customName: {
    flex: 1,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: Spacing.one,
    borderWidth: 2,
  },
  quantity: {
    fontSize: 14,
  },
  strikethrough: {
    textDecorationLine: 'line-through',
  },
});
