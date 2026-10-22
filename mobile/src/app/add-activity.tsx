import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { PressableFeedback } from '@/components/pressable-feedback';
import { t, msg } from '@/i18n';
import { ChipSingleSelect, FieldGroup, TextField } from '@/components/form-fields';
import { PreferenceScreen } from '@/components/preference-screen';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { addDays, formatLongDate, parseDateString, toDateString } from '@/lib/date';
import { ACTIVITY_OTHER, ACTIVITY_PRESETS, parseActivityInput } from '@/lib/sport-activity';
import { addSportActivity, getSportActivity, updateSportActivity } from '@/lib/sport-db';

// Les valeurs sont les textes français d'origine ; le libellé affiché (et le nom enregistré) est traduit.
const CHOICES = [...ACTIVITY_PRESETS, ACTIVITY_OTHER].map((name) => ({ value: name as string, label: name }));

const WHEN_OPTIONS = [
  { value: 0, label: msg("Aujourd'hui") },
  { value: 1, label: msg('Hier') },
  { value: 2, label: msg('Avant-hier') },
];

/**
 * Le choix prédéfini qui correspond à un nom (écrit dans n'importe laquelle des deux langues),
 * "Autre" si le nom a été personnalisé.
 */
function choiceFor(name: string): string {
  return ACTIVITY_PRESETS.find((preset) => preset === name || t(preset) === name) ?? ACTIVITY_OTHER;
}

/**
 * Ajout d'une activité saisie à la main, ou — avec le paramètre `id` — correction d'une activité
 * déjà enregistrée (nom et durée ; sa date ne change pas). Choisir une activité prédéfinie
 * remplit le nom, qui reste un champ libre : on peut le préciser ou le remplacer
 * ("Sport collectif" -> "Football").
 */
export default function AddActivityScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const editId = params.id !== undefined && /^\d+$/.test(params.id) ? Number(params.id) : null;
  const [existing] = useState(() => (editId !== null ? getSportActivity(editId) : null));
  const isEditing = editId !== null;

  const [choice, setChoice] = useState<string>(() => (existing ? choiceFor(existing.name) : ACTIVITY_PRESETS[0]));
  const [name, setName] = useState<string>(() => existing?.name ?? t(ACTIVITY_PRESETS[0]));
  const [duration, setDuration] = useState(() => (existing?.durationMinutes != null ? String(existing.durationMinutes) : ''));
  const [daysAgo, setDaysAgo] = useState(0);
  const [error, setError] = useState<string | null>(null);

  function chooseActivity(next: string) {
    setChoice(next);
    setName(next === ACTIVITY_OTHER ? '' : t(next));
    setError(null);
  }

  function save() {
    const parsed = parseActivityInput(name, duration);
    if (!parsed.success) {
      setError(parsed.error);
      return;
    }
    if (editId !== null) {
      updateSportActivity(editId, parsed.data.name, parsed.data.durationMinutes);
    } else {
      addSportActivity(toDateString(addDays(new Date(), -daysAgo)), parsed.data.name, parsed.data.durationMinutes);
    }
    router.back();
  }

  if (isEditing && !existing) {
    return (
      <PreferenceScreen>
        <Stack.Screen options={{ title: t("Modifier l'activité") }} />
        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText type="smallBold">{t('Activité introuvable')}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {t('Elle a sans doute été supprimée entre-temps.')}
          </ThemedText>
        </ThemedView>
      </PreferenceScreen>
    );
  }

  return (
    <PreferenceScreen>
      <Stack.Screen options={{ title: isEditing ? t("Modifier l'activité") : t('Autre activité') }} />
      <ThemedView type="backgroundElement" style={styles.card}>
        <FieldGroup title={isEditing ? t('Activité') : t('Nouvelle activité')}>
          {!isEditing && (
            <ThemedText type="small" themeColor="textSecondary">
              {t('Une activité saisie ici compte dans ta série de semaines, comme une séance de ton programme.')}
            </ThemedText>
          )}
          {isEditing && existing && (
            <ThemedText type="small" themeColor="textSecondary">
              {t('Faite le {date}.', { date: formatLongDate(parseDateString(existing.date)) })}
            </ThemedText>
          )}

          <ChipSingleSelect label="Type d'activité" options={CHOICES} value={choice} onChange={chooseActivity} />

          <TextField
            label="Nom (tu peux le préciser ou le remplacer)"
            value={name}
            onChangeText={setName}
            placeholder="ex : Football, Course en forêt, Escalade"
          />

          <TextField
            label="Durée en minutes (facultatif)"
            value={duration}
            onChangeText={setDuration}
            placeholder="ex : 45"
            keyboardType="number-pad"
          />

          {!isEditing && <ChipSingleSelect label="Quand" options={WHEN_OPTIONS} value={daysAgo} onChange={setDaysAgo} />}

          {error && (
            <ThemedText type="small" themeColor="danger">
              {error}
            </ThemedText>
          )}

          <PressableFeedback onPress={save}>
            <ThemedView type="accent" style={styles.button}>
              <ThemedText type="link" themeColor="accentOnColor">
                {t('Enregistrer')}
              </ThemedText>
            </ThemedView>
          </PressableFeedback>
        </FieldGroup>
      </ThemedView>

      <ThemedText type="small" themeColor="textFaint" style={styles.hint}>
        {t('Tu retrouveras tous tes entraînements dans Réglages › Statistiques.')}
      </ThemedText>
    </PreferenceScreen>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
  },
  button: {
    borderRadius: Spacing.two,
    paddingVertical: Spacing.two,
    alignItems: 'center',
  },
  hint: {
    textAlign: 'center',
  },
});
