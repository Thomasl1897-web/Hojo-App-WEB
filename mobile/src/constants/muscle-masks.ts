// Généré par scripts/make-muscle-masks.py — ne pas modifier à la main.
import type { MuscleGroup } from '@/lib/exercise-catalog';

/** Taille des images de la silhouette (identique pour tous les masques d'une même vue). */
export const MASK_WIDTH = 580;
export const MASK_HEIGHT = 1180;

export type MuscleView = 'front' | 'back';

type ViewMasks = { base: number; groups: Partial<Record<MuscleGroup, number>> };

export const MUSCLE_MASKS: Record<MuscleView, ViewMasks> = {
  front: {
    base: require('@/assets/images/muscles/front/base.png'),
    groups: {
      abs: require('@/assets/images/muscles/front/abs.png'),
      adductors: require('@/assets/images/muscles/front/adductors.png'),
      biceps: require('@/assets/images/muscles/front/biceps.png'),
      calves: require('@/assets/images/muscles/front/calves.png'),
      chest: require('@/assets/images/muscles/front/chest.png'),
      forearms: require('@/assets/images/muscles/front/forearms.png'),
      obliques: require('@/assets/images/muscles/front/obliques.png'),
      quads: require('@/assets/images/muscles/front/quads.png'),
      shoulders: require('@/assets/images/muscles/front/shoulders.png'),
      traps: require('@/assets/images/muscles/front/traps.png'),
    },
  },
  back: {
    base: require('@/assets/images/muscles/back/base.png'),
    groups: {
      calves: require('@/assets/images/muscles/back/calves.png'),
      forearms: require('@/assets/images/muscles/back/forearms.png'),
      glutes: require('@/assets/images/muscles/back/glutes.png'),
      hamstrings: require('@/assets/images/muscles/back/hamstrings.png'),
      lats: require('@/assets/images/muscles/back/lats.png'),
      lowerBack: require('@/assets/images/muscles/back/lowerBack.png'),
      obliques: require('@/assets/images/muscles/back/obliques.png'),
      shoulders: require('@/assets/images/muscles/back/shoulders.png'),
      traps: require('@/assets/images/muscles/back/traps.png'),
      triceps: require('@/assets/images/muscles/back/triceps.png'),
    },
  },
};
