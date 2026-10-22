import { useEffect } from 'react';

type KeepAwakeModule = typeof import('expo-keep-awake');

/**
 * `expo-keep-awake` est un module natif : un build de développement antérieur à son ajout ne le
 * contient pas, et son chargement y lève une erreur. On le charge donc avec un `require` protégé
 * (même principe que `expo-notifications`) : sans lui, l'écran peut s'éteindre, rien ne plante.
 */
let keepAwake: KeepAwakeModule | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  keepAwake = require('expo-keep-awake') as KeepAwakeModule;
} catch {
  keepAwake = null;
}

const TAG = 'live-session';

/** Garde l'écran allumé tant que le composant est affiché (séance en direct). */
export function useSessionKeepAwake() {
  useEffect(() => {
    if (!keepAwake) return;
    const awake = keepAwake;
    awake.activateKeepAwakeAsync(TAG).catch(() => {});
    return () => {
      awake.deactivateKeepAwake(TAG).catch(() => {});
    };
  }, []);
}
