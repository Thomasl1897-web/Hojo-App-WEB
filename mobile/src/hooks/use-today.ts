import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { getTodayDateString } from '@/lib/date';

/**
 * Date du jour (AAAA-MM-JJ), mise à jour quand le jour change réellement :
 * - à minuit pile si l'app reste ouverte à l'écran (minuterie réglée sur le prochain minuit) ;
 * - au retour de l'app au premier plan, car la minuterie ne tourne pas pendant que le téléphone
 *   est verrouillé ou l'app en arrière-plan (JS suspendu).
 * Sans ça, "Aujourd'hui" continuait d'afficher la veille jusqu'au prochain changement d'écran.
 */
export function useToday(): string {
  const [today, setToday] = useState(getTodayDateString);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const refresh = () => setToday(getTodayDateString());

    const scheduleNextMidnight = () => {
      const now = new Date();
      // 1 s après minuit : évite de se réveiller une milliseconde trop tôt et de relire la veille.
      const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1);
      timer = setTimeout(() => {
        refresh();
        scheduleNextMidnight();
      }, nextMidnight.getTime() - now.getTime());
    };
    scheduleNextMidnight();

    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      refresh();
      // La minuterie a pu dériver ou être suspendue : on la recale.
      if (timer) clearTimeout(timer);
      scheduleNextMidnight();
    });

    return () => {
      if (timer) clearTimeout(timer);
      subscription.remove();
    };
  }, []);

  return today;
}
