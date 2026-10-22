import { getSetting, setSetting } from '@/lib/settings-db';

type HapticsModule = typeof import('expo-haptics');

/**
 * `expo-haptics` est un module natif : un build qui ne le contient pas (Expo Go sur certaines versions, ancien
 * APK) ne doit pas planter. Chargé par un `require` protégé, comme les autres modules natifs optionnels.
 */
let haptics: HapticsModule | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  haptics = require('expo-haptics') as HapticsModule;
} catch {
  haptics = null;
}

const HAPTICS_KEY = 'haptics_enabled';

// Lu en base une fois puis gardé en mémoire : ces fonctions sont appelées à chaque toucher.
let cached: boolean | null = null;

/** Retour tactile activé (par défaut oui ; réglable dans Réglages › Apparence). */
export function isHapticsEnabled(): boolean {
  if (cached === null) cached = getSetting(HAPTICS_KEY) !== '0';
  return cached;
}

export function setHapticsEnabled(enabled: boolean) {
  cached = enabled;
  setSetting(HAPTICS_KEY, enabled ? '1' : '0');
}

/** Relit le réglage en base (après une restauration de sauvegarde). */
export function reloadHapticsPreference() {
  cached = null;
}

function play(action: (module: HapticsModule) => Promise<void>) {
  if (!haptics || !isHapticsEnabled()) return;
  try {
    action(haptics).catch(() => {});
  } catch {
    // Pas de moteur de vibration ou module absent : un retour tactile n'est jamais indispensable.
  }
}

/** Léger « clic » de sélection : changer d'onglet, choisir une puce, déplacer le doigt sur un graphique. */
export function hapticSelection() {
  play((module) => module.selectionAsync());
}

/** Petit choc : valider un geste (cocher un repas). */
export function hapticLight() {
  play((module) => module.impactAsync(module.ImpactFeedbackStyle.Light));
}

/** Réussite : série terminée, séance terminée. */
export function hapticSuccess() {
  play((module) => module.notificationAsync(module.NotificationFeedbackType.Success));
}

/** Attention : action destructive confirmée. */
export function hapticWarning() {
  play((module) => module.notificationAsync(module.NotificationFeedbackType.Warning));
}
