import { useSyncExternalStore } from 'react';

import { en } from '@/i18n/en';

/**
 * Traduction « à la gettext » : le texte FRANÇAIS sert de clé. `t("Réglages")` renvoie le texte
 * tel quel en français, et sa traduction en anglais (dictionnaire `en.ts`) en anglais. Un texte
 * sans traduction s'affiche en français plutôt que de disparaître, et le test `tests/i18n.test.ts`
 * vérifie qu'aucun texte du code n'en manque. Les textes saisis par l'utilisateur (noms de repas,
 * d'exercices…) passent par `t` sans danger : ils n'ont pas d'entrée et restent inchangés.
 *
 * Les paramètres s'écrivent `{nom}` dans le texte : `t("{count} repas", { count: 3 })`.
 */
export type Language = 'fr' | 'en';
export type LanguagePreference = 'system' | Language;

let current: Language = 'fr';
const listeners = new Set<() => void>();

export function getLanguage(): Language {
  return current;
}

export function setLanguage(language: Language) {
  if (language === current) return;
  current = language;
  listeners.forEach((listener) => listener());
}

/** Langue du téléphone : anglais sauf si le téléphone est en français. */
export function detectSystemLanguage(): Language {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale.toLowerCase();
    return locale.startsWith('fr') ? 'fr' : 'en';
  } catch {
    return 'fr';
  }
}

type Params = Record<string, string | number>;

function interpolate(text: string, params?: Params): string {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) => (name in params ? String(params[name]) : match));
}

/** Traduit un texte français dans la langue courante. */
export function t(source: string, params?: Params): string {
  const text = current === 'en' ? (en[source] ?? source) : source;
  return interpolate(text, params);
}

/**
 * Pluriel : `one` (français : 0 ou 1 ; anglais : exactement 1) ou `other`. `{count}` est fourni
 * automatiquement. Les deux formes sont des textes français à traduire comme les autres.
 */
export function tp(count: number, one: string, other: string, params?: Params): string {
  const singular = current === 'fr' ? count < 2 : count === 1;
  return t(singular ? one : other, { count, ...params });
}

/**
 * Marque un texte à traduire sans le traduire tout de suite (constantes de module, listes de
 * choix) : à traduire au moment de l'afficher avec `t(valeur)`. L'extraction du test le repère.
 */
export function msg(source: string): string {
  return source;
}

/** Virgule en français, point en anglais. */
export function decimalSeparator(): string {
  return current === 'fr' ? ',' : '.';
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Langue courante, avec réaffichage du composant quand elle change. */
export function useLanguage(): Language {
  return useSyncExternalStore(subscribe, getLanguage, getLanguage);
}
