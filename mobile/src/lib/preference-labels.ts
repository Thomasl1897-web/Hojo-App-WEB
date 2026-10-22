import { msg } from '@/i18n';
import type { NotificationPermissionState } from '@/lib/notifications';
import type { ThemePreference } from '@/lib/settings-db';

/** Libellés partagés entre les écrans de réglages et le résumé de la liste des Paramètres. */
export const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'system', label: msg('Automatique') },
  { value: 'light', label: msg('Clair') },
  { value: 'dark', label: msg('Sombre') },
];

export const PERMISSION_LABELS: Record<NotificationPermissionState, { label: string; tone: 'accent' | 'warn' | 'neutral' }> = {
  granted: { label: msg('Autorisées'), tone: 'accent' },
  undetermined: { label: msg('Pas encore autorisées'), tone: 'warn' },
  denied: { label: msg('Refusées'), tone: 'warn' },
  unavailable: { label: msg('Indisponibles dans Expo Go'), tone: 'neutral' },
};
