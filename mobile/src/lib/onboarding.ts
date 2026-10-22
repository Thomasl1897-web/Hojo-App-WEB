import { getActivePlanMeta } from '@/lib/nutrition-db';
import { getSetting, setSetting } from '@/lib/settings-db';
import { getActiveSportPlanMeta } from '@/lib/sport-db';

const ONBOARDING_KEY = 'onboarding_done';

/**
 * L'écran d'accueil ne s'affiche qu'à la toute première utilisation : ni terminé / passé auparavant, ni plan
 * déjà présent (une personne qui a déjà des données, par exemple après une mise à jour de l'app, ne doit pas
 * le revoir).
 */
export function shouldShowOnboarding(): boolean {
  if (getSetting(ONBOARDING_KEY) === '1') return false;
  return getActivePlanMeta() === null && getActiveSportPlanMeta() === null;
}

export function completeOnboarding() {
  setSetting(ONBOARDING_KEY, '1');
}
