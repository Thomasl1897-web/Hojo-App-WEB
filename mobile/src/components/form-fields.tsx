import { ScrollView, StyleSheet, TextInput, type KeyboardTypeOptions } from 'react-native';

import { PressableFeedback } from '@/components/pressable-feedback';
import { SectionIcon, type IllustrationName } from '@/components/section-icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { t } from '@/i18n';
import { useTheme } from '@/hooks/use-theme';

export function FieldGroup({
  title,
  icon,
  children,
}: {
  title: string;
  /** Petite illustration devant le titre. */
  icon?: IllustrationName;
  children: React.ReactNode;
}) {
  return (
    <ThemedView style={styles.group}>
      <ThemedView style={styles.groupHeader}>
        {icon && <SectionIcon name={icon} size={24} />}
        <ThemedText type="smallBold">{t(title)}</ThemedText>
      </ThemedView>
      {children}
    </ThemedView>
  );
}

/** Petite pastille d'état (ex: "Jour de repos", "Séance"). */
export function Tier({ label, tone = 'accent' }: { label: string; tone?: 'accent' | 'warn' | 'neutral' }) {
  const theme = useTheme();
  const wash = tone === 'accent' ? theme.accentWash : tone === 'warn' ? theme.warnWash : theme.backgroundElement;
  const line = tone === 'accent' ? theme.accentLine : tone === 'warn' ? theme.warnLine : theme.line;
  const fg = tone === 'accent' ? theme.accent : tone === 'warn' ? theme.warn : theme.textSecondary;
  return (
    <ThemedView style={[styles.tier, { backgroundColor: wash, borderColor: line }]}>
      <ThemedText type="eyebrow" style={{ color: fg }}>
        {t(label)}
      </ThemedText>
    </ThemedView>
  );
}

export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  keyboardType?: KeyboardTypeOptions;
}) {
  const theme = useTheme();
  return (
    <ThemedView style={styles.field}>
      <ThemedText type="small" themeColor="textSecondary">
        {t(label)}
      </ThemedText>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={t(placeholder)}
        placeholderTextColor={theme.textSecondary}
        keyboardType={keyboardType}
        style={[
          styles.fieldInput,
          { color: theme.text, borderColor: theme.textSecondary, backgroundColor: theme.backgroundElement },
        ]}
      />
    </ThemedView>
  );
}

export function ChipSingleSelect<T extends string | number>({
  label,
  options,
  value,
  onChange,
  scrollable = false,
}: {
  /** Titre au-dessus des choix ; omis, la rangée de choix s'affiche seule. */
  label?: string;
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (value: T) => void;
  /** Une seule rangée qui défile horizontalement, plutôt que des lignes qui s'empilent. */
  scrollable?: boolean;
}) {
  const chips = options.map((option) => {
    const selected = value === option.value;
    return (
      <PressableFeedback haptic="selection" key={option.value} onPress={() => onChange(option.value)}>
        <ThemedView type={selected ? 'accent' : 'backgroundElement'} style={styles.chip}>
          <ThemedText type="small" themeColor={selected ? 'accentOnColor' : 'textSecondary'}>
            {t(option.label)}
          </ThemedText>
        </ThemedView>
      </PressableFeedback>
    );
  });

  return (
    <ThemedView style={styles.field}>
      {label ? (
        <ThemedText type="small" themeColor="textSecondary">
          {t(label)}
        </ThemedText>
      ) : null}
      {scrollable ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipScroll}>
          {chips}
        </ScrollView>
      ) : (
        <ThemedView style={styles.chipRow}>{chips}</ThemedView>
      )}
    </ThemedView>
  );
}

export function ChipMultiSelect<T extends string | number>({
  label,
  options,
  values,
  onToggle,
}: {
  label: string;
  options: { value: T; label: string }[];
  values: T[];
  onToggle: (value: T) => void;
}) {
  return (
    <ThemedView style={styles.field}>
      <ThemedText type="small" themeColor="textSecondary">
        {t(label)}
      </ThemedText>
      <ThemedView style={styles.chipRow}>
        {options.map((option) => {
          const selected = values.includes(option.value);
          return (
            <PressableFeedback haptic="selection" key={option.value} onPress={() => onToggle(option.value)}>
              <ThemedView type={selected ? 'accent' : 'backgroundElement'} style={styles.chip}>
                <ThemedText type="small" themeColor={selected ? 'accentOnColor' : 'textSecondary'}>
                  {t(option.label)}
                </ThemedText>
              </ThemedView>
            </PressableFeedback>
          );
        })}
      </ThemedView>
    </ThemedView>
  );
}

export function ToggleField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  const theme = useTheme();
  return (
    <PressableFeedback haptic="selection" onPress={() => onChange(!value)}>
      <ThemedView type="backgroundElement" style={styles.toggle}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.toggleText}>
          {t(label)}
        </ThemedText>
        <ThemedView
          style={[
            styles.toggleIndicator,
            { borderColor: theme.textSecondary },
            value && { backgroundColor: theme.accent, borderColor: theme.accent },
          ]}
        />
      </ThemedView>
    </PressableFeedback>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: Spacing.two,
    backgroundColor: 'transparent',
  },
  groupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: 'transparent',
  },
  field: {
    gap: Spacing.half,
    backgroundColor: 'transparent',
  },
  fieldInput: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    padding: Spacing.two,
    fontSize: 14,
  },
  chipScroll: {
    flexDirection: 'row',
    gap: Spacing.one,
    paddingRight: Spacing.three,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
    backgroundColor: 'transparent',
  },
  chip: {
    borderRadius: Spacing.five,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
  },
  tier: {
    alignSelf: 'flex-start',
    borderRadius: 99,
    borderWidth: 1,
    paddingVertical: 3,
    paddingHorizontal: Spacing.two,
  },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  toggleText: {
    flex: 1,
    marginRight: Spacing.two,
  },
  toggleIndicator: {
    width: 20,
    height: 20,
    borderRadius: Spacing.one,
    borderWidth: 2,
  },
});
