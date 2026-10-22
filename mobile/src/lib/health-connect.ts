/**
 * Accès à Health Connect (Android) : la couche qui parle au module natif. Tout le reste de la
 * synchronisation (health-sync.ts) ne dépend que de l'interface `HealthSource`, pour pouvoir être
 * testé sans téléphone.
 *
 * Le module est chargé par un `require` protégé : un build qui ne le contient pas (ancien APK, Expo Go,
 * iOS) ne plante pas, `getHealthStatus()` répond simplement « indisponible dans cette version ».
 */
import type { RawSleep } from '@/lib/sleep';

import { Platform } from 'react-native';

type Native = typeof import('react-native-health-connect');

let native: Native | null = null;
try {
  if (Platform.OS !== 'android') throw new Error('Health Connect existe seulement sur Android');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  native = require('react-native-health-connect') as Native;
} catch {
  native = null;
}

export type HealthStatus =
  /** iPhone : Health Connect n'existe que sur Android (Apple Santé n'est pas géré). */
  | 'unsupported_platform'
  /** Pas de module natif dans ce build (Expo Go, ancien APK, iOS). */
  | 'unavailable_build'
  /** Health Connect n'est pas installé sur le téléphone. */
  | 'not_installed'
  /** Health Connect est installé mais doit être mis à jour. */
  | 'update_required'
  | 'ready';

export type RawSession = {
  id: string;
  startTime: string;
  endTime: string;
  /** Code Health Connect du type d'exercice. */
  exerciseType: number;
  title?: string;
};

export type DayTotals = { steps: number; activeKcal: number };

/** Ce dont la synchronisation a besoin ; la vraie implémentation est `nativeHealthSource`. */
export type HealthSource = {
  status(): Promise<HealthStatus>;
  hasAccess(): Promise<boolean>;
  requestAccess(): Promise<boolean>;
  readSessions(since: Date, until: Date): Promise<RawSession[]>;
  /** Calories actives sur un intervalle, null si la source ne les donne pas. */
  activeKcalBetween(start: string, end: string): Promise<number | null>;
  /** Pas et calories actives d'une journée locale entière. */
  dayTotals(dayStart: Date, dayEnd: Date): Promise<DayTotals>;
  /** La lecture du sommeil est une permission à part (ajoutée après coup) : elle peut manquer. */
  hasSleepAccess(): Promise<boolean>;
  /** Nuits enregistrées entre deux dates (liste vide si la permission manque). */
  readSleep(since: Date, until: Date): Promise<RawSleep[]>;
};

const READ_PERMISSIONS = [
  { accessType: 'read', recordType: 'ExerciseSession' },
  { accessType: 'read', recordType: 'Steps' },
  { accessType: 'read', recordType: 'ActiveCaloriesBurned' },
] as const;

const SLEEP_PERMISSION = { accessType: 'read', recordType: 'SleepSession' } as const;

function hasAllPermissions(granted: { accessType?: string; recordType?: string }[]): boolean {
  return READ_PERMISSIONS.every((needed) =>
    granted.some((permission) => permission.recordType === needed.recordType && permission.accessType === needed.accessType),
  );
}

const MAX_SESSIONS = 1000;

export const nativeHealthSource: HealthSource = {
  async status() {
    if (Platform.OS !== 'android') return 'unsupported_platform';
    if (!native) return 'unavailable_build';
    try {
      const sdk = await native.getSdkStatus();
      if (sdk === native.SdkAvailabilityStatus.SDK_AVAILABLE) {
        await native.initialize();
        return 'ready';
      }
      return sdk === native.SdkAvailabilityStatus.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED ? 'update_required' : 'not_installed';
    } catch {
      return 'unavailable_build';
    }
  },

  async hasAccess() {
    if (!native) return false;
    try {
      return hasAllPermissions(await native.getGrantedPermissions());
    } catch {
      return false;
    }
  },

  async requestAccess() {
    if (!native) return false;
    try {
      // Le sommeil est demandé en même temps, mais le refuser ne bloque pas le reste.
      const granted = await native.requestPermission([...READ_PERMISSIONS, SLEEP_PERMISSION]);
      return hasAllPermissions(granted);
    } catch {
      return false;
    }
  },

  async hasSleepAccess() {
    if (!native) return false;
    try {
      const granted = await native.getGrantedPermissions();
      return granted.some((permission) => permission.recordType === 'SleepSession' && permission.accessType === 'read');
    } catch {
      return false;
    }
  },

  async readSleep(since, until) {
    if (!native) return [];
    const nights: RawSleep[] = [];
    let pageToken: string | undefined;
    do {
      const page = await native.readRecords('SleepSession', {
        timeRangeFilter: { operator: 'between', startTime: since.toISOString(), endTime: until.toISOString() },
        pageSize: 100,
        pageToken,
      });
      for (const record of page.records) {
        if (!record.metadata?.id) continue;
        nights.push({
          id: record.metadata.id,
          startTime: record.startTime,
          endTime: record.endTime,
          stages: (record.stages ?? []).map((stage) => ({ stage: stage.stage, startTime: stage.startTime, endTime: stage.endTime })),
        });
      }
      pageToken = page.pageToken;
    } while (pageToken && nights.length < MAX_SESSIONS);
    return nights;
  },

  async readSessions(since, until) {
    if (!native) return [];
    const sessions: RawSession[] = [];
    let pageToken: string | undefined;
    do {
      const page = await native.readRecords('ExerciseSession', {
        timeRangeFilter: { operator: 'between', startTime: since.toISOString(), endTime: until.toISOString() },
        pageSize: 200,
        pageToken,
      });
      for (const record of page.records) {
        if (!record.metadata?.id) continue;
        sessions.push({
          id: record.metadata.id,
          startTime: record.startTime,
          endTime: record.endTime,
          exerciseType: record.exerciseType,
          title: record.title,
        });
      }
      pageToken = page.pageToken;
    } while (pageToken && sessions.length < MAX_SESSIONS);
    return sessions;
  },

  async activeKcalBetween(start, end) {
    if (!native) return null;
    try {
      const result = await native.aggregateRecord({
        recordType: 'ActiveCaloriesBurned',
        timeRangeFilter: { operator: 'between', startTime: start, endTime: end },
      });
      return Math.round(result.ACTIVE_CALORIES_TOTAL.inKilocalories);
    } catch {
      return null;
    }
  },

  async dayTotals(dayStart, dayEnd) {
    if (!native) return { steps: 0, activeKcal: 0 };
    const timeRangeFilter = { operator: 'between' as const, startTime: dayStart.toISOString(), endTime: dayEnd.toISOString() };
    let steps = 0;
    let activeKcal = 0;
    try {
      steps = (await native.aggregateRecord({ recordType: 'Steps', timeRangeFilter })).COUNT_TOTAL ?? 0;
    } catch {
      steps = 0;
    }
    try {
      activeKcal = (await native.aggregateRecord({ recordType: 'ActiveCaloriesBurned', timeRangeFilter })).ACTIVE_CALORIES_TOTAL.inKilocalories ?? 0;
    } catch {
      activeKcal = 0;
    }
    return { steps, activeKcal };
  },
};

/** Ouvre l'écran des réglages de Health Connect (retirer l'accès, voir les sources de données). */
export function openHealthConnectSettings() {
  try {
    native?.openHealthConnectSettings();
  } catch {
    // Sans le module natif, il n'y a rien à ouvrir.
  }
}
