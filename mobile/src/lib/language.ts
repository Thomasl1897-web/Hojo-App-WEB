import { detectSystemLanguage, setLanguage, type LanguagePreference } from '@/i18n';
import { getSetting, setSetting } from '@/lib/settings-db';

const LANGUAGE_KEY = 'language_preference';

export function getLanguagePreference(): LanguagePreference {
  const stored = getSetting(LANGUAGE_KEY);
  return stored === 'fr' || stored === 'en' ? stored : 'system';
}

/** Applique la préférence (« system » = langue du téléphone). Sans effet si rien ne change. */
export function applyLanguagePreference(preference: LanguagePreference = getLanguagePreference()) {
  setLanguage(preference === 'system' ? detectSystemLanguage() : preference);
}

export function setLanguagePreference(preference: LanguagePreference) {
  setSetting(LANGUAGE_KEY, preference);
  applyLanguagePreference(preference);
}

// Changer de langue remonte toute la navigation (voir `_layout.tsx`) : l'écran de choix de la langue
// demande alors à y revenir, sinon l'utilisateur se retrouverait sur le premier onglet.
let returnToLanguageScreen = false;

export function requestReturnToLanguageScreen() {
  returnToLanguageScreen = true;
}

/** Vrai une seule fois après une demande de retour sur l'écran de langue. */
export function takeReturnToLanguageScreen(): boolean {
  const requested = returnToLanguageScreen;
  returnToLanguageScreen = false;
  return requested;
}
