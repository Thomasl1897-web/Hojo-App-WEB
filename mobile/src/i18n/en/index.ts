import { date } from '@/i18n/en/date';
import { healthConnect } from '@/i18n/en/health-connect';
import { heatmap } from '@/i18n/en/heatmap';
import { libBasic } from '@/i18n/en/lib-basic';
import { libPlans } from '@/i18n/en/lib-plans';
import { muscles } from '@/i18n/en/muscles';
import { prompts } from '@/i18n/en/prompts';
import { ui } from '@/i18n/en/ui';

/** Dictionnaire français → anglais (voir `i18n/index.ts`), assemblé à partir des fichiers du dossier. */
export const en: Record<string, string> = {
  ...date,
  ...healthConnect,
  ...heatmap,
  ...libBasic,
  ...libPlans,
  ...muscles,
  ...prompts,
  ...ui,
};
