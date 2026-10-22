import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { ChipSingleSelect, FieldGroup, TextField, ToggleField } from '@/components/form-fields';
import { PreferenceScreen } from '@/components/preference-screen';
import { PressableFeedback } from '@/components/pressable-feedback';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { t } from '@/i18n';
import { savePlanSource } from '@/lib/backup';
import { weekdayName } from '@/lib/date';
import { rescheduleIfPermitted } from '@/lib/notifications';
import { draftToPlan, emptyExercise, newDraft, planToDraft, type DraftExercise, type DraftSession, type SportDraft } from '@/lib/sport-draft';
import { getSportPlanForEdit, saveEditedSportPlan } from '@/lib/sport-db';

/** Éditeur de programme sport : modifier le programme actif, ou en créer un de zéro. */
export default function SportEditorScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ mode?: string }>();
  const [existing] = useState(getSportPlanForEdit);
  const [draft, setDraft] = useState<SportDraft | null>(() => {
    if (existing) return planToDraft(existing);
    return params.mode === 'fixe' || params.mode === 'continu' ? newDraft(params.mode) : null;
  });
  const [open, setOpen] = useState<Set<number>>(() => new Set(draft?.mode === 'continu' ? [0] : []));
  const [error, setError] = useState<string | null>(null);
  // Options repliées d'un exercice (superset, tempo, RIR, alternative), par « séance-exercice ».
  const [detailsOpen, setDetailsOpen] = useState<Set<string>>(() => new Set());

  if (!draft) {
    return (
      <PreferenceScreen>
        <FieldGroup title="Type de programme">
          <ThemedText type="small" themeColor="textSecondary">
            {t('Séances fixes : une séance précise pour chaque jour de la semaine. Flux continu : un enchaînement de séances qui avance quand tu en termines une, sans jour attitré.')}
          </ThemedText>
          <ChipSingleSelect
            options={[
              { value: 'fixe', label: 'Séances fixes' },
              { value: 'continu', label: 'Flux continu' },
            ]}
            value={null}
            onChange={(mode) => {
              const next = newDraft(mode);
              setDraft(next);
              setOpen(new Set(mode === 'continu' ? [0] : []));
            }}
          />
        </FieldGroup>
      </PreferenceScreen>
    );
  }

  function update(change: (current: SportDraft) => SportDraft) {
    setDraft((current) => (current ? change(current) : current));
    setError(null);
  }

  function updateSession(index: number, change: (session: DraftSession) => DraftSession) {
    update((d) => ({ ...d, sessions: d.sessions.map((s, i) => (i === index ? change(s) : s)) }));
  }

  function updateExercise(sessionIndex: number, exerciseIndex: number, change: (exercise: DraftExercise) => DraftExercise) {
    updateSession(sessionIndex, (s) => ({
      ...s,
      exercises: s.exercises.map((e, i) => (i === exerciseIndex ? change(e) : e)),
    }));
  }

  function move<T>(list: T[], from: number, to: number): T[] {
    if (to < 0 || to >= list.length) return list;
    const copy = [...list];
    [copy[from], copy[to]] = [copy[to], copy[from]];
    return copy;
  }

  function toggleOpen(index: number) {
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  async function save() {
    if (!draft) return;
    const result = draftToPlan(draft);
    if (!result.success) {
      setError(result.error);
      return;
    }
    saveEditedSportPlan(result.plan);
    savePlanSource('sport', result.raw);
    await rescheduleIfPermitted();
    const warning = result.warnings.length ? `\n\n⚠️ ${result.warnings.join(' ')}` : '';
    Alert.alert(t('Programme enregistré'), t('« {name} » est à jour.', { name: result.plan.name }) + warning, [
      { text: 'OK', onPress: () => router.back() },
    ]);
  }

  const isFixed = draft.mode === 'fixe';

  return (
    <PreferenceScreen>
      <ThemedView type="backgroundElement" style={styles.card}>
        <FieldGroup title="Programme">
          <TextField label="Nom du programme" value={draft.name} onChangeText={(name) => update((d) => ({ ...d, name }))} placeholder="ex : Prise de masse" />
          <TextField
            label="Heure du rappel (HH:MM)"
            value={draft.preferredTime}
            onChangeText={(preferredTime) => update((d) => ({ ...d, preferredTime }))}
            placeholder="18:00"
          />
          <ThemedText type="small" themeColor="textFaint">
            {isFixed ? t('Séances fixes') : t('Flux continu')}
            {existing ? '' : ` — ${t('choisi à la création')}`}
          </ThemedText>
        </FieldGroup>
      </ThemedView>

      {draft.sessions.map((session, sessionIndex) => {
        const expanded = open.has(sessionIndex);
        const title = isFixed ? weekdayName(session.weekday ?? '') : t('Séance {number}', { number: sessionIndex + 1 });
        return (
          <ThemedView key={sessionIndex} type="backgroundElement" style={styles.card}>
            <PressableFeedback onPress={() => toggleOpen(sessionIndex)} style={styles.sessionHeader}>
              <View style={styles.sessionTitle}>
                <ThemedText type="smallBold">{title}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
                  {session.isRestDay
                    ? t('Repos')
                    : `${session.sessionName || t('Sans nom')} · ${t('{count} exercices', { count: session.exercises.length })}${session.optional ? ` · ${t('facultative')}` : ''}`}
                </ThemedText>
              </View>
              <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={20} color={theme.textSecondary} />
            </PressableFeedback>

            {expanded && (
              <View style={styles.sessionBody}>
                <TextField
                  label="Nom de la séance"
                  value={session.sessionName}
                  onChangeText={(sessionName) => updateSession(sessionIndex, (s) => ({ ...s, sessionName }))}
                  placeholder="ex : Push, Jambes"
                />
                <ToggleField
                  label="Jour de repos"
                  value={session.isRestDay}
                  onChange={(isRestDay) =>
                    updateSession(sessionIndex, (s) => ({
                      ...s,
                      isRestDay,
                      exercises: isRestDay ? [] : s.exercises.length ? s.exercises : [emptyExercise()],
                      sessionName: isRestDay && !s.sessionName ? 'Repos' : s.sessionName,
                    }))
                  }
                />
                {!isFixed && !session.isRestDay && (
                  <ToggleField
                    label="Séance facultative (hors enchaînement)"
                    value={Boolean(session.optional)}
                    onChange={(optional) => updateSession(sessionIndex, (s) => ({ ...s, optional }))}
                  />
                )}

                {!session.isRestDay &&
                  session.exercises.map((exercise, exerciseIndex) => {
                    const detailsKey = `${sessionIndex}-${exerciseIndex}`;
                    const showDetails = detailsOpen.has(detailsKey);
                    const summary = [
                      exercise.superset ? t('Superset {label}', { label: exercise.superset }) : null,
                      exercise.tempo ? t('Tempo {tempo}', { tempo: exercise.tempo }) : null,
                      exercise.rir ? t('RIR {rir}', { rir: exercise.rir }) : null,
                      exercise.alternative ? t('alternative') : null,
                    ]
                      .filter(Boolean)
                      .join(' · ');
                    const setField = (field: 'superset' | 'tempo' | 'rir' | 'alternative') => (value: string) =>
                      updateExercise(sessionIndex, exerciseIndex, (e) => ({ ...e, [field]: value }));
                    return (
                    <View key={exerciseIndex} style={[styles.exercise, { borderColor: theme.line }]}>
                      <TextField
                        label={t('Exercice {number}', { number: exerciseIndex + 1 })}
                        value={exercise.name}
                        // Le nom change : l'identifiant du répertoire ne vaut plus, le nom sera reconnu de nouveau.
                        onChangeText={(name) => updateExercise(sessionIndex, exerciseIndex, (e) => ({ ...e, name, exerciseId: undefined }))}
                        placeholder="ex : Développé couché"
                      />
                      <View style={styles.row}>
                        <View style={styles.cell}>
                          <TextField
                            label="Séries"
                            value={exercise.sets}
                            onChangeText={(sets) => updateExercise(sessionIndex, exerciseIndex, (e) => ({ ...e, sets }))}
                            placeholder="3"
                            keyboardType="number-pad"
                          />
                        </View>
                        <View style={styles.cell}>
                          <TextField
                            label="Répétitions"
                            value={exercise.reps}
                            onChangeText={(reps) => updateExercise(sessionIndex, exerciseIndex, (e) => ({ ...e, reps }))}
                            placeholder="8-12"
                          />
                        </View>
                        <View style={styles.cell}>
                          <TextField
                            label="Repos (s)"
                            value={exercise.restSeconds}
                            onChangeText={(restSeconds) => updateExercise(sessionIndex, exerciseIndex, (e) => ({ ...e, restSeconds }))}
                            placeholder="90"
                            keyboardType="number-pad"
                          />
                        </View>
                      </View>
                      <PressableFeedback
                        onPress={() =>
                          setDetailsOpen((current) => {
                            const next = new Set(current);
                            if (next.has(detailsKey)) next.delete(detailsKey);
                            else next.add(detailsKey);
                            return next;
                          })
                        }>
                        <ThemedText type="small" themeColor="accent">
                          {`${showDetails ? '▾' : '▸'} ${t('Options : superset, tempo, RIR, alternative')}${summary && !showDetails ? ` (${summary})` : ''}`}
                        </ThemedText>
                      </PressableFeedback>
                      {showDetails && (
                        <>
                          <ThemedText type="small" themeColor="textFaint">
                            {t('Superset : donne la même lettre ou le même numéro à des exercices qui se suivent pour les enchaîner en alternant les séries ; mets le repos sur le dernier.')}
                          </ThemedText>
                          <View style={styles.row}>
                            <View style={styles.cell}>
                              <TextField label="Superset" value={exercise.superset ?? ''} onChangeText={setField('superset')} placeholder="ex : 5" />
                            </View>
                            <View style={styles.cell}>
                              <TextField label="Tempo" value={exercise.tempo ?? ''} onChangeText={setField('tempo')} placeholder="3-0-1" />
                            </View>
                            <View style={styles.cell}>
                              <TextField label="RIR" value={exercise.rir ?? ''} onChangeText={setField('rir')} placeholder="1-2" />
                            </View>
                          </View>
                          <TextField
                            label="Alternative"
                            value={exercise.alternative ?? ''}
                            onChangeText={setField('alternative')}
                            placeholder="ex : Pompes pieds surélevés"
                          />
                        </>
                      )}
                      <View style={styles.actions}>
                        <IconAction
                          icon="arrow-up"
                          label={t('Monter')}
                          disabled={exerciseIndex === 0}
                          onPress={() => updateSession(sessionIndex, (s) => ({ ...s, exercises: move(s.exercises, exerciseIndex, exerciseIndex - 1) }))}
                        />
                        <IconAction
                          icon="arrow-down"
                          label={t('Descendre')}
                          disabled={exerciseIndex === session.exercises.length - 1}
                          onPress={() => updateSession(sessionIndex, (s) => ({ ...s, exercises: move(s.exercises, exerciseIndex, exerciseIndex + 1) }))}
                        />
                        <IconAction
                          icon="trash-outline"
                          label={t("Supprimer l'exercice")}
                          onPress={() => updateSession(sessionIndex, (s) => ({ ...s, exercises: s.exercises.filter((_, i) => i !== exerciseIndex) }))}
                        />
                      </View>
                    </View>
                    );
                  })}

                {!session.isRestDay && (
                  <PressableFeedback
                    onPress={() => updateSession(sessionIndex, (s) => ({ ...s, exercises: [...s.exercises, emptyExercise()] }))}>
                    <ThemedText type="link">{`＋ ${t('Ajouter un exercice')}`}</ThemedText>
                  </PressableFeedback>
                )}

                {!isFixed && (
                  <View style={styles.actions}>
                    <IconAction
                      icon="arrow-up"
                      label={t('Monter la séance')}
                      disabled={sessionIndex === 0}
                      onPress={() => {
                        update((d) => ({ ...d, sessions: move(d.sessions, sessionIndex, sessionIndex - 1) }));
                        setOpen(new Set());
                      }}
                    />
                    <IconAction
                      icon="arrow-down"
                      label={t('Descendre la séance')}
                      disabled={sessionIndex === draft.sessions.length - 1}
                      onPress={() => {
                        update((d) => ({ ...d, sessions: move(d.sessions, sessionIndex, sessionIndex + 1) }));
                        setOpen(new Set());
                      }}
                    />
                    <IconAction
                      icon="trash-outline"
                      label={t('Supprimer la séance')}
                      disabled={draft.sessions.length === 1}
                      onPress={() => {
                        update((d) => ({ ...d, sessions: d.sessions.filter((_, i) => i !== sessionIndex) }));
                        setOpen(new Set());
                      }}
                    />
                  </View>
                )}
              </View>
            )}
          </ThemedView>
        );
      })}

      {!isFixed && (
        <PressableFeedback
          onPress={() => {
            update((d) => ({ ...d, sessions: [...d.sessions, { sessionName: '', isRestDay: false, exercises: [emptyExercise()] }] }));
            setOpen(new Set([draft.sessions.length]));
          }}>
          <ThemedView type="backgroundElement" style={styles.button}>
            <ThemedText type="link">{`＋ ${t('Ajouter une séance')}`}</ThemedText>
          </ThemedView>
        </PressableFeedback>
      )}

      {existing && (
        <ThemedText type="small" themeColor="textFaint">
          {t("Renommer un exercice le sépare de son historique de charges : garde le même nom pour continuer la courbe.")}
        </ThemedText>
      )}

      {error && (
        <ThemedText type="small" themeColor="danger">
          {error}
        </ThemedText>
      )}

      <PressableFeedback onPress={save} haptic="success">
        <ThemedView type="accent" style={styles.button}>
          <ThemedText type="link" themeColor="accentOnColor">
            {t('Enregistrer le programme')}
          </ThemedText>
        </ThemedView>
      </PressableFeedback>
    </PreferenceScreen>
  );
}

function IconAction({
  icon,
  label,
  onPress,
  disabled,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const theme = useTheme();
  return (
    <PressableFeedback
      onPress={onPress}
      disabled={disabled}
      haptic="selection"
      hitSlop={Spacing.two}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.iconAction, disabled && styles.disabled]}>
      <Ionicons name={icon} size={20} color={theme.textSecondary} />
    </PressableFeedback>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  sessionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  sessionTitle: {
    flex: 1,
    gap: 2,
    backgroundColor: 'transparent',
  },
  sessionBody: {
    gap: Spacing.two,
    paddingTop: Spacing.two,
  },
  exercise: {
    gap: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  cell: {
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.three,
  },
  iconAction: {
    padding: Spacing.one,
  },
  disabled: {
    opacity: 0.3,
  },
  button: {
    borderRadius: Spacing.two,
    paddingVertical: Spacing.two,
    alignItems: 'center',
  },
});
