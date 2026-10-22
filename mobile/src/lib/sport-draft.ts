import { t } from '@/i18n';
import { WEEKDAYS, type Weekday } from '@/lib/nutrition-schema';
import { parseSportPlan, type Exercise, type SportPlan } from '@/lib/sport-schema';

/**
 * Brouillon d'un programme de sport en cours d'édition à la main. Les nombres sont des TEXTES (ce que
 * l'utilisateur tape), validés seulement à l'enregistrement par `draftToPlan`.
 */
export type DraftExercise = {
  name: string;
  sets: string;
  reps: string;
  restSeconds: string;
  note?: string;
  exerciseId?: string;
};

export type DraftSession = {
  sessionName: string;
  isRestDay: boolean;
  exercises: DraftExercise[];
  /** Mode "fixe" uniquement. */
  weekday?: Weekday;
};

export type SportDraft = {
  name: string;
  mode: 'fixe' | 'continu';
  preferredTime: string;
  sessions: DraftSession[];
};

export function emptyExercise(): DraftExercise {
  return { name: '', sets: '3', reps: '8-12', restSeconds: '90' };
}

/** Programme vide : 7 jours de repos à compléter (fixe) ou une première séance à remplir (continu). */
export function newDraft(mode: 'fixe' | 'continu'): SportDraft {
  const base = { name: '', mode, preferredTime: '18:00' };
  if (mode === 'fixe') {
    return {
      ...base,
      sessions: WEEKDAYS.map((weekday) => ({ sessionName: 'Repos', isRestDay: true, exercises: [], weekday })),
    };
  }
  return { ...base, sessions: [{ sessionName: '', isRestDay: false, exercises: [emptyExercise()] }] };
}

export function planToDraft(plan: SportPlan): SportDraft {
  const toSession = (
    s: { sessionName: string; isRestDay: boolean; exercises: Exercise[] },
    weekday?: Weekday,
  ): DraftSession => ({
    sessionName: s.sessionName,
    isRestDay: s.isRestDay,
    weekday,
    exercises: s.exercises.map((e) => ({
      name: e.name,
      sets: String(e.sets),
      reps: e.reps,
      restSeconds: String(e.restSeconds),
      note: e.note,
      exerciseId: e.exerciseId,
    })),
  });
  return {
    name: plan.name,
    mode: plan.mode,
    preferredTime: plan.preferredTime,
    sessions: plan.mode === 'fixe' ? plan.days.map((d) => toSession(d, d.weekday)) : plan.sequence.map((s) => toSession(s)),
  };
}

export type DraftResult =
  | { success: true; plan: SportPlan; raw: string; warnings: string[] }
  | { success: false; error: string };

function parseWhole(text: string): number | null {
  return /^\d+$/.test(text.trim()) ? Number(text.trim()) : null;
}

/**
 * Valide le brouillon avec des messages précis (« Lundi, exercice 2 : … ») puis repasse par le même
 * `parseSportPlan` que l'import : un programme saisi à la main obéit exactement aux mêmes règles.
 */
export function draftToPlan(draft: SportDraft): DraftResult {
  const fail = (error: string): DraftResult => ({ success: false, error });

  if (!draft.name.trim()) return fail(t('Donne un nom au programme.'));
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(draft.preferredTime.trim())) {
    return fail(t("L'heure du rappel doit être au format HH:MM (par exemple 18:30)."));
  }

  const sessions = [];
  for (let i = 0; i < draft.sessions.length; i++) {
    const s = draft.sessions[i];
    const label = s.weekday ? t(s.weekday) : t('Séance {number}', { number: i + 1 });
    const sessionName = s.sessionName.trim() || (s.isRestDay ? t('Repos') : '');
    if (!sessionName) return fail(t('{label} : donne un nom à la séance.', { label }));

    const exercises = [];
    if (!s.isRestDay) {
      if (s.exercises.length === 0) {
        return fail(t('{label} : ajoute au moins un exercice, ou marque la séance comme jour de repos.', { label }));
      }
      for (let j = 0; j < s.exercises.length; j++) {
        const e = s.exercises[j];
        const where = t('{label}, exercice {number}', { label, number: j + 1 });
        if (!e.name.trim()) return fail(t('{where} : le nom est vide.', { where }));
        const sets = parseWhole(e.sets);
        if (sets === null || sets < 1) return fail(t('{where} : le nombre de séries doit être un entier d’au moins 1.', { where }));
        if (!e.reps.trim()) return fail(t('{where} : indique les répétitions (par exemple 8-12).', { where }));
        const rest = parseWhole(e.restSeconds);
        if (rest === null) return fail(t('{where} : le repos doit être un nombre de secondes (0 si aucun).', { where }));
        exercises.push({
          name: e.name.trim(),
          sets,
          reps: e.reps.trim(),
          restSeconds: rest,
          ...(e.note ? { note: e.note } : {}),
          ...(e.exerciseId ? { exerciseId: e.exerciseId } : {}),
        });
      }
    }
    sessions.push({ sessionName, isRestDay: s.isRestDay, exercises, weekday: s.weekday });
  }

  const base = { type: 'sport', mode: draft.mode, name: draft.name.trim(), preferredTime: draft.preferredTime.trim() };
  const raw = JSON.stringify(
    draft.mode === 'fixe'
      ? { ...base, days: sessions }
      : { ...base, sequence: sessions.map(({ weekday: _weekday, ...rest }) => rest) },
    null,
    2,
  );
  const parsed = parseSportPlan(raw);
  if (!parsed.success) return fail(parsed.error);
  return { success: true, plan: parsed.data, raw, warnings: parsed.warnings };
}
