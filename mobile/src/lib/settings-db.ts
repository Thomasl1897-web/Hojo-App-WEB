import { Appearance } from 'react-native';

import { db } from '@/lib/database';

export type ThemePreference = 'system' | 'light' | 'dark';

/**
 * Réglages de l'utilisateur (clé/valeur). Comme l'historique sport, cette table est EXCLUE de
 * la réinitialisation de database.ts : ce sont des choix personnels qui doivent survivre à un
 * réimport de plan ou à un changement de schéma.
 */
export function initSettingsSchema() {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}

export function getSetting(key: string): string | null {
  return db.getFirstSync<{ value: string }>('SELECT value FROM app_settings WHERE key = ?', key)?.value ?? null;
}

export function setSetting(key: string, value: string) {
  db.runSync('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)', key, value);
}

export function deleteSetting(key: string) {
  db.runSync('DELETE FROM app_settings WHERE key = ?', key);
}

const THEME_KEY = 'theme_preference';

export const SPORT_REMINDER_TIME_KEY = 'sport_reminder_time';

export function getThemePreference(): ThemePreference {
  const stored = getSetting(THEME_KEY);
  return stored === 'light' || stored === 'dark' ? stored : 'system';
}

/** Applique le thème choisi à toute l'app ("system" = suivre le réglage du téléphone). */
export function applyThemePreference(preference: ThemePreference) {
  // react-native-web n'a pas `setColorScheme` : sur le web, le thème suit le navigateur.
  Appearance.setColorScheme?.(preference === 'system' ? 'unspecified' : preference);
}

export function setThemePreference(preference: ThemePreference) {
  setSetting(THEME_KEY, preference);
  applyThemePreference(preference);
}
