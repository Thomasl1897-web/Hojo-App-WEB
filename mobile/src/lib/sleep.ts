import { toDateString } from '@/lib/date';

/**
 * Sommeil importé de Health Connect. Health Connect ne fournit PAS de « score de sommeil » (celui de
 * Google / Fitbit ou de Garmin reste dans leur application) : seulement les nuits et, selon la montre, leurs
 * phases. Hojo calcule donc son propre score de 0 à 100 (voir `computeSleepScore`), annoncé comme tel à l'écran.
 */

/** Codes des phases de Health Connect (`SleepStageType` de react-native-health-connect, vérifiés par un test). */
export const STAGE = { AWAKE: 1, SLEEPING: 2, OUT_OF_BED: 3, LIGHT: 4, DEEP: 5, REM: 6, AWAKE_IN_BED: 7 } as const;

export type SleepStageSpan = { stage: number; startTime: string; endTime: string };

export type RawSleep = { id: string; startTime: string; endTime: string; stages: SleepStageSpan[] };

export type SleepNight = {
  /** Jour de réveil (AAAA-MM-JJ, jour local). */
  date: string;
  asleepMinutes: number;
  deepMinutes: number;
  remMinutes: number;
  lightMinutes: number;
  awakeMinutes: number;
  /** Du coucher au lever. */
  inBedMinutes: number;
  /** Vrai si la montre a détaillé le sommeil profond / paradoxal (sinon seule la durée est connue). */
  hasStages: boolean;
  score: number;
};

/** Un enregistrement plus court n'est pas une nuit (sieste, somnolence captée par une montre). */
export const MIN_NIGHT_MINUTES = 90;

/** Durée de sommeil visée (7 h 30) : le score de durée est maximal à partir de là. */
const TARGET_ASLEEP_MINUTES = 450;
/** Au-delà de 10 h, le score de durée diminue un peu. */
const LONG_SLEEP_MINUTES = 600;
/** Sans phases, la qualité est inconnue : le score est plafonné pour ne pas promettre plus que ce qu'on sait. */
const NO_STAGES_CAP = 90;

type Totals = Omit<SleepNight, 'date' | 'score'>;

function minutesBetween(start: string, end: string): number {
  const a = new Date(start).getTime();
  const b = new Date(end).getTime();
  return Number.isNaN(a) || Number.isNaN(b) || b <= a ? 0 : (b - a) / 60_000;
}

/** Part du temps de sommeil dans la fourchette idéale : 1 dedans, décroît vers 0 de part et d'autre. */
function rangeScore(share: number, low: number, high: number): number {
  if (share >= low && share <= high) return 1;
  if (share < low) return Math.max(0, share / low);
  return Math.max(0, 1 - (share - high) / high);
}

/**
 * Score de 0 à 100 :
 * - durée (50 points) : proportionnelle jusqu'à 7 h 30 de sommeil effectif, légèrement réduite au-delà de 10 h ;
 * - phases (30 points) : sommeil profond (idéal 13-23 %) et paradoxal (idéal 20-25 %), 15 points chacun ;
 * - continuité (20 points) : sommeil effectif ÷ temps passé au lit, plein à 90 % et plus, nul à 70 %.
 *   Phases et continuité comptent à proportion de la durée (une nuit de 4 h ne peut pas être « bonne »).
 * Sans phases, seule la durée est connue : score = durée ramenée sur 100, plafonné à 90.
 */
export function computeSleepScore(totals: Totals): number {
  const asleep = Math.max(0, totals.asleepMinutes);
  let duration = Math.min(asleep / TARGET_ASLEEP_MINUTES, 1) * 50;
  if (asleep > LONG_SLEEP_MINUTES) duration -= Math.min((asleep - LONG_SLEEP_MINUTES) / 120, 1) * 10;

  if (!totals.hasStages || asleep === 0) {
    return Math.round(Math.max(0, Math.min(NO_STAGES_CAP, (duration / 50) * NO_STAGES_CAP)));
  }

  const stages = (rangeScore(totals.deepMinutes / asleep, 0.13, 0.23) + rangeScore(totals.remMinutes / asleep, 0.2, 0.25)) * 15;
  const efficiency = totals.inBedMinutes > 0 ? asleep / totals.inBedMinutes : 1;
  const continuity = Math.max(0, Math.min(1, (efficiency - 0.7) / 0.2)) * 20;
  // Une nuit courte ne peut pas être « de bonne qualité » : phases et continuité comptent à proportion de la durée.
  const adequacy = Math.min(asleep / TARGET_ASLEEP_MINUTES, 1);
  return Math.round(Math.max(0, Math.min(100, duration + (stages + continuity) * adequacy)));
}

function summarizeOne(session: RawSleep): Totals | null {
  const inBed = minutesBetween(session.startTime, session.endTime);
  if (inBed < MIN_NIGHT_MINUTES) return null;

  let deep = 0;
  let rem = 0;
  let light = 0;
  let awake = 0;
  for (const span of session.stages) {
    const minutes = minutesBetween(span.startTime, span.endTime);
    if (span.stage === STAGE.DEEP) deep += minutes;
    else if (span.stage === STAGE.REM) rem += minutes;
    else if (span.stage === STAGE.LIGHT || span.stage === STAGE.SLEEPING) light += minutes;
    else if (span.stage === STAGE.AWAKE || span.stage === STAGE.OUT_OF_BED || span.stage === STAGE.AWAKE_IN_BED) awake += minutes;
  }
  const hasStages = deep + rem > 0;
  if (session.stages.length === 0) {
    return { asleepMinutes: inBed, deepMinutes: 0, remMinutes: 0, lightMinutes: inBed, awakeMinutes: 0, inBedMinutes: inBed, hasStages: false };
  }
  const asleep = deep + rem + light;
  return { asleepMinutes: asleep, deepMinutes: deep, remMinutes: rem, lightMinutes: light, awakeMinutes: awake, inBedMinutes: inBed, hasStages };
}

/**
 * Regroupe les enregistrements par jour de réveil (jour local de la fin) : plusieurs morceaux la même nuit
 * (réveil prolongé, deux applications) s'additionnent ; les enregistrements trop courts sont ignorés.
 * Résultat trié du plus récent au plus ancien.
 */
export function summarizeSleep(sessions: RawSleep[]): SleepNight[] {
  const byDate = new Map<string, Totals>();
  for (const session of sessions) {
    const end = new Date(session.endTime);
    if (Number.isNaN(end.getTime())) continue;
    const totals = summarizeOne(session);
    if (!totals) continue;
    const date = toDateString(end);
    const known = byDate.get(date);
    byDate.set(
      date,
      known
        ? {
            asleepMinutes: known.asleepMinutes + totals.asleepMinutes,
            deepMinutes: known.deepMinutes + totals.deepMinutes,
            remMinutes: known.remMinutes + totals.remMinutes,
            lightMinutes: known.lightMinutes + totals.lightMinutes,
            awakeMinutes: known.awakeMinutes + totals.awakeMinutes,
            inBedMinutes: known.inBedMinutes + totals.inBedMinutes,
            hasStages: known.hasStages || totals.hasStages,
          }
        : totals,
    );
  }
  return [...byDate.entries()]
    .map(([date, totals]) => ({
      date,
      ...totals,
      asleepMinutes: Math.round(totals.asleepMinutes),
      deepMinutes: Math.round(totals.deepMinutes),
      remMinutes: Math.round(totals.remMinutes),
      lightMinutes: Math.round(totals.lightMinutes),
      awakeMinutes: Math.round(totals.awakeMinutes),
      inBedMinutes: Math.round(totals.inBedMinutes),
      score: computeSleepScore(totals),
    }))
    .sort((a, b) => b.date.localeCompare(a.date));
}

/** « 7 h 32 » (même écriture en français et en anglais). */
export function formatSleepDuration(minutes: number): string {
  const rounded = Math.max(0, Math.round(minutes));
  const h = Math.floor(rounded / 60);
  const m = rounded % 60;
  return `${h} h ${String(m).padStart(2, '0')}`;
}

/** Mention affichée sous le score. */
export function sleepScoreLabel(score: number): 'Excellent' | 'Bon' | 'Moyen' | 'Court' {
  if (score >= 85) return 'Excellent';
  if (score >= 70) return 'Bon';
  if (score >= 50) return 'Moyen';
  return 'Court';
}
