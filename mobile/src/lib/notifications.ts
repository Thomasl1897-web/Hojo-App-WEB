import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';

import { t } from '@/i18n';
import { getCycleDayForDate } from '@/lib/date';
import type { Weekday } from '@/lib/nutrition-schema';
import { getActivePlanMeta, getAllMeals, type MealRow, type PlanMeta } from '@/lib/nutrition-db';
import { getActiveSportPlanMeta, getFixedTrainingWeekdays, type SportPlanMeta } from '@/lib/sport-db';
import { buildWasteReminders, formatBinList, WASTE_BIN_DEFS } from '@/lib/waste';
import { getWasteBins, getWasteReminderTime, hasWasteSchedule } from '@/lib/waste-db';

type NotificationsModule = typeof import('expo-notifications');

/**
 * Expo Go ne supporte plus expo-notifications depuis le SDK 53 : le simple import du module
 * y lève une erreur au lancement (et plus seulement un avertissement). On ne le charge donc
 * que dans un vrai build (development build ou store). Dans Expo Go, l'app démarre mais les
 * rappels sont désactivés — chaque fonction exportée ci-dessous sort tôt dans ce cas, ce qui
 * garantit que le cast ci-dessous n'est jamais déréférencé.
 */
export const NOTIFICATIONS_AVAILABLE = Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;

// require() et non import : un import statique serait évalué (et planterait) dans Expo Go.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const Notifications = (NOTIFICATIONS_AVAILABLE ? require('expo-notifications') : null) as NotificationsModule;

/**
 * Un cycle nutrition peut durer 7 ou 14 jours : un trigger "weekly" ne suffit pas pour
 * représenter un cycle de 14 jours (il ne connaît que la répétition à 7 jours). On programme
 * donc des notifications datées sur une fenêtre glissante, et on reprogramme à chaque
 * ouverture de l'app ou import de plan pour que la fenêtre avance avec le temps.
 *
 * 7 jours et pas 14 : iOS ne garde que 64 notifications locales en attente et jette
 * silencieusement le surplus. Sur 14 jours, un plan à 5 repas/jour en demandait 70 — au-delà
 * de la limite, donc des rappels perdus sans aucun signal. La fenêtre étant réapprovisionnée
 * à chaque ouverture de l'app, 7 jours suffisent largement.
 */
const SCHEDULING_WINDOW_DAYS = 7;

/**
 * Plafond volontairement sous la limite iOS de 64, pour ne jamais dépendre du silence
 * d'iOS quand un plan est plus dense que prévu (repas nombreux + séances de sport).
 */
const MAX_PENDING_NOTIFICATIONS = 60;

// expo-notifications weekday convention : 1 = dimanche ... 7 = samedi
const WEEKDAY_TO_TRIGGER_DAY: Record<Weekday, number> = {
  dimanche: 1,
  lundi: 2,
  mardi: 3,
  mercredi: 4,
  jeudi: 5,
  vendredi: 6,
  samedi: 7,
};

if (NOTIFICATIONS_AVAILABLE) {
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});
}

export async function ensureNotificationSetup() {
  if (!NOTIFICATIONS_AVAILABLE) return;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('meals', {
      name: t('Repas'),
      importance: Notifications.AndroidImportance.HIGH,
    });
    await Notifications.setNotificationChannelAsync('home', {
      name: t('Maison'),
      importance: Notifications.AndroidImportance.HIGH,
    });
    await Notifications.setNotificationChannelAsync('training', {
      name: t('Séances de sport'),
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
}

export type NotificationPermissionState = 'granted' | 'denied' | 'undetermined' | 'unavailable';

/**
 * "undetermined" = on peut encore demander ; "denied" = refusée définitivement, seul le
 * réglage système permet de la rétablir ; "unavailable" = Expo Go (module non chargé).
 */
export async function getNotificationPermissionState(): Promise<NotificationPermissionState> {
  if (!NOTIFICATIONS_AVAILABLE) return 'unavailable';
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return 'granted';
  return current.canAskAgain ? 'undetermined' : 'denied';
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!NOTIFICATIONS_AVAILABLE) return false;
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;

  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

/** Programme les repas du plus proche au plus lointain, dans la limite de `budget`. */
async function scheduleMealNotifications(meals: MealRow[], planMeta: PlanMeta, now: Date, budget: number) {
  const mealsByCycleDay = new Map<number, MealRow[]>();
  for (const meal of meals) {
    const list = mealsByCycleDay.get(meal.cycleDay) ?? [];
    list.push(meal);
    mealsByCycleDay.set(meal.cycleDay, list);
  }

  let scheduled = 0;

  for (let offset = 0; offset < SCHEDULING_WINDOW_DAYS; offset++) {
    const targetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    const cycleDay = getCycleDayForDate(planMeta.cycleStartDate, planMeta.cycleLengthDays, targetDate);
    const mealsThatDay = mealsByCycleDay.get(cycleDay);
    if (!mealsThatDay) continue;

    for (const meal of mealsThatDay) {
      if (scheduled >= budget) return scheduled;

      const [hour, minute] = meal.time.split(':').map(Number);
      const fireDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), hour, minute);
      if (fireDate.getTime() <= now.getTime()) continue;

      await Notifications.scheduleNotificationAsync({
        content: {
          title: `${meal.slotName} — ${meal.dishName}`,
          body: meal.ingredients.map((item) => `${item.name} (${item.quantity})`).join(', '),
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: fireDate,
          channelId: Platform.OS === 'android' ? 'meals' : undefined,
        },
      });
      scheduled++;
    }
  }

  return scheduled;
}

/**
 * Rappels de sport UNIQUEMENT pour le mode "fixe" (jour de semaine réel connu à l'avance).
 * En mode "continu", on ne sait pas à quelle date réelle tombera la prochaine séance
 * recommandée (elle dépend de quand l'utilisateur coche la précédente comme faite) — aucun
 * rappel automatique n'est programmé dans ce cas (limitation assumée, voir CLAUDE.md).
 */
async function scheduleSportFixedNotifications(planMeta: SportPlanMeta) {
  const trainingWeekdays = getFixedTrainingWeekdays();
  if (trainingWeekdays.length === 0) return 0;

  const [hour, minute] = planMeta.preferredTime.split(':').map(Number);

  for (const weekday of trainingWeekdays) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: t('Séance de sport'),
        body: t("C'est l'heure de t'entraîner."),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday: WEEKDAY_TO_TRIGGER_DAY[weekday],
        hour,
        minute,
        channelId: Platform.OS === 'android' ? 'training' : undefined,
      },
    });
  }

  return trainingWeekdays.length;
}

/** Fenêtre de programmation des rappels de poubelles (au plus un rappel par soir). */
const WASTE_WINDOW_DAYS = 14;

/**
 * Rappel de la veille au soir : un seul par soir, qui regroupe tous les sacs à sortir pour le
 * lendemain. Datés (et non hebdomadaires) parce que "une semaine sur deux" n'existe pas comme
 * déclencheur récurrent ; la fenêtre est reprogrammée à chaque ouverture de l'app.
 */
async function scheduleWasteNotifications(now: Date): Promise<number> {
  const reminders = buildWasteReminders(getWasteBins(), now, getWasteReminderTime(), WASTE_WINDOW_DAYS);
  const labelOf = new Map(WASTE_BIN_DEFS.map((def) => [def.id, t(def.reminderLabel)]));

  for (const reminder of reminders) {
    const labels = reminder.bins.map((bin) => labelOf.get(bin.id) ?? t('les poubelles'));
    await Notifications.scheduleNotificationAsync({
      content: {
        title: t('Poubelles demain'),
        body: t('Ce soir, sortir {bins}.', { bins: formatBinList(labels) }),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: reminder.fireDate,
        channelId: Platform.OS === 'android' ? 'home' : undefined,
      },
    });
  }
  return reminders.length;
}

/**
 * Notification de fin de repos pendant une séance en direct. Indispensable parce que le
 * chrono à l'écran ne suffit pas : si l'utilisateur verrouille son téléphone pendant le
 * repos, le JS est suspendu et aucune vibration ne partira au bon moment. Retourne
 * l'identifiant pour pouvoir l'annuler si le repos est écourté.
 */
export async function scheduleRestEndNotification(seconds: number): Promise<string | null> {
  if (!NOTIFICATIONS_AVAILABLE || seconds <= 0) return null;
  try {
    return await Notifications.scheduleNotificationAsync({
      content: { title: t('Repos terminé'), body: t('Série suivante.') },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds,
        repeats: false,
        channelId: Platform.OS === 'android' ? 'training' : undefined,
      },
    });
  } catch {
    // Pas de permission accordée : le chrono à l'écran reste utilisable, on n'interrompt
    // pas la séance pour autant.
    return null;
  }
}

export async function cancelScheduledNotification(id: string) {
  if (!NOTIFICATIONS_AVAILABLE) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    // Déjà déclenchée ou inconnue : rien à annuler.
  }
}

/**
 * Reprogramme TOUS les rappels (nutrition + sport). Annule d'abord tout, donc les deux
 * domaines doivent toujours être reprogrammés ENSEMBLE — sinon reprogrammer la nutrition
 * seule effacerait les rappels de sport déjà posés, et inversement.
 */
export async function rescheduleAllNotifications(nutritionPlan: PlanMeta | null, sportPlan: SportPlanMeta | null) {
  if (!NOTIFICATIONS_AVAILABLE) return;
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!nutritionPlan && !sportPlan && !hasWasteSchedule()) return;

  const now = new Date();

  // Le sport passe en premier : ses triggers hebdomadaires se répètent indéfiniment (7 au
  // maximum), alors que les repas sont datés et reprogrammés à chaque ouverture. En cas de
  // budget serré, mieux vaut sacrifier les repas les plus lointains qu'un rappel récurrent.
  let used = 0;
  if (sportPlan && sportPlan.mode === 'fixe') {
    used += await scheduleSportFixedNotifications(sportPlan);
  }
  // Les poubelles ensuite : très peu de rappels (un par soir de veille de ramassage), et plus
  // importants à ne pas rater qu'un repas lointain.
  used += await scheduleWasteNotifications(now);
  if (nutritionPlan) {
    await scheduleMealNotifications(getAllMeals(), nutritionPlan, now, MAX_PENDING_NOTIFICATIONS - used);
  }
}

/**
 * Reprogramme tous les rappels SI la permission est accordée (sinon ne fait rien). Utilisé par
 * les écrans de réglages après chaque modification d'une heure ou d'un jour : retourne vrai si
 * les rappels ont effectivement été reprogrammés, pour adapter le message affiché.
 */
export async function rescheduleIfPermitted(): Promise<boolean> {
  if ((await getNotificationPermissionState()) !== 'granted') return false;
  await rescheduleAllNotifications(getActivePlanMeta(), getActiveSportPlanMeta());
  return true;
}
