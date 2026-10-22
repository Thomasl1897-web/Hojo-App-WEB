import { setLanguage } from '@/i18n';
import { db } from '@/lib/database';
import { initHealthSchema } from '@/lib/health-db';
import { initNutritionSchema } from '@/lib/nutrition-db';
import { initSportSchema } from '@/lib/sport-db';
import { initBackupSchema } from '@/lib/backup';
import { initWasteSchema } from '@/lib/waste-db';
import { initSettingsSchema } from '@/lib/settings-db';
import { initShoppingSchema } from '@/lib/shopping-db';

/** Repart d'une base vide avec tous les schémas de l'app (comme au premier lancement). */
export function freshDatabase() {
  // Les tests de logique vérifient les messages en français, quelle que soit la langue de la machine.
  setLanguage('fr');
  (db as unknown as { dropEverything(): void }).dropEverything();
  initSettingsSchema();
  initNutritionSchema();
  initSportSchema();
  initWasteSchema();
  initShoppingSchema();
  initBackupSchema();
  initHealthSchema();
}
