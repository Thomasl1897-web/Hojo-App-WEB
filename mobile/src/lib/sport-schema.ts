import { z } from 'zod';

import { t } from '@/i18n';
import { WEEKDAYS, type Weekday } from '@/lib/nutrition-schema';

export const exerciseSchema = z.object({
  name: z.string().min(1),
  sets: z.number().int().min(1),
  /** Texte libre : "8-12", "AMRAP", "30s", "échec"... pas toujours un nombre fixe. */
  reps: z.string().min(1),
  restSeconds: z.number().int().min(0),
  note: z.string().optional(),
  /** Identifiant de l'exercice dans le répertoire de l'app (facultatif ; sinon le nom est reconnu). */
  exerciseId: z.string().optional(),
});

export type Exercise = z.infer<typeof exerciseSchema>;

export const sportSessionSchema = z.object({
  /** Nom de la séance (ex: "Push", "Repos", "Cardio"). */
  sessionName: z.string().min(1),
  isRestDay: z.boolean(),
  exercises: z.array(exerciseSchema),
});

export type SportSession = z.infer<typeof sportSessionSchema>;

const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * Mode "fixe" : une séance précise associée à chaque jour de la semaine réel (ex: Push le
 * lundi). Toujours 7 jours — un programme de sport n'a pas besoin d'un cycle de 14 jours
 * comme la nutrition.
 */
export const fixedSportPlanSchema = z.object({
  type: z.literal('sport'),
  mode: z.literal('fixe'),
  name: z.string().min(1),
  preferredTime: z.string().regex(timeRegex, { error: () => t('Heure attendue au format HH:MM') }),
  days: z.array(sportSessionSchema.extend({ weekday: z.enum(WEEKDAYS) })).length(7),
});

export type FixedSportPlan = z.infer<typeof fixedSportPlanSchema>;

/**
 * Mode "continu" : un enchaînement de séances (ex: Push → Pull → Legs → Repos → ...) sans
 * jour attitré. La séance recommandée avance uniquement quand la précédente est marquée
 * faite, peu importe quel jour réel elle a eu lieu.
 */
export const continuousSportPlanSchema = z.object({
  type: z.literal('sport'),
  mode: z.literal('continu'),
  name: z.string().min(1),
  preferredTime: z.string().regex(timeRegex, { error: () => t('Heure attendue au format HH:MM') }),
  sequence: z.array(sportSessionSchema).min(1),
});

export type ContinuousSportPlan = z.infer<typeof continuousSportPlanSchema>;

export const sportPlanSchema = z.discriminatedUnion('mode', [fixedSportPlanSchema, continuousSportPlanSchema]);

export type SportPlan = z.infer<typeof sportPlanSchema>;

function extractJson(raw: string): string {
  let text = raw.trim();
  const fence = text.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/i);
  if (fence) text = fence[1].trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start !== -1 && end > start) text = text.slice(start, end + 1);
  return text;
}

export type SportParseResult =
  | { success: true; data: SportPlan; warnings: string[] }
  | { success: false; error: string };

function validateSessionConsistency(sessions: SportSession[], labelFor: (index: number) => string): string | null {
  for (let i = 0; i < sessions.length; i++) {
    const s = sessions[i];
    if (!s.isRestDay && s.exercises.length === 0) {
      return t('{label} n\'est pas marqué "repos" mais ne contient aucun exercice.', { label: labelFor(i) });
    }
    if (s.isRestDay && s.exercises.length > 0) {
      return t('{label} est marqué "repos" mais contient des exercices.', { label: labelFor(i) });
    }
  }
  return null;
}

export function parseSportPlan(raw: string): SportParseResult {
  let json: unknown;
  try {
    json = JSON.parse(extractJson(raw));
  } catch {
    return {
      success: false,
      error:
        t(
          "Le contenu n'est pas un JSON valide. Si l'assistant IA a tronqué sa réponse, redemande-lui le plan complet sous forme de fichier .json.",
        ),
    };
  }

  const result = sportPlanSchema.safeParse(json);
  if (!result.success) {
    const firstIssue = result.error.issues[0];
    const path = firstIssue.path.join('.');
    return {
      success: false,
      error: path ? t('Erreur sur "{path}" : {message}', { path, message: firstIssue.message }) : firstIssue.message,
    };
  }

  const plan = result.data;
  const warnings: string[] = [];

  if (plan.mode === 'fixe') {
    const seenWeekdays = new Set<Weekday>();
    const duplicate = plan.days.find((d) => {
      if (seenWeekdays.has(d.weekday)) return true;
      seenWeekdays.add(d.weekday);
      return false;
    });
    if (duplicate) {
      return { success: false, error: t('Le jour "{day}" apparaît plusieurs fois dans le plan.', { day: t(duplicate.weekday) }) };
    }
    const missing = WEEKDAYS.filter((w) => !seenWeekdays.has(w));
    if (missing.length) {
      return { success: false, error: t('Il manque un jour dans le plan : {days}.', { days: missing.map((day) => t(day)).join(', ') }) };
    }

    const error = validateSessionConsistency(plan.days, (i) => t('Le jour "{day}"', { day: t(plan.days[i].weekday) }));
    if (error) return { success: false, error };

    const restCount = plan.days.filter((d) => d.isRestDay).length;
    if (restCount === 0) {
      warnings.push(
        t(
          'Aucun jour de repos sur la semaine — le surentraînement augmente le risque de blessure, envisage de régénérer un plan avec au moins un jour de récupération.',
        ),
      );
    }
  } else {
    const error = validateSessionConsistency(plan.sequence, (i) => t('La séance #{number} ("{name}")', { number: i + 1, name: plan.sequence[i].sessionName }));
    if (error) return { success: false, error };

    const hasRest = plan.sequence.some((s) => s.isRestDay);
    if (!hasRest) {
      warnings.push(
        t("Aucune séance de repos dans l'enchaînement — envisage d'en ajouter une pour éviter le surentraînement."),
      );
    }
  }

  return { success: true, data: plan, warnings };
}
