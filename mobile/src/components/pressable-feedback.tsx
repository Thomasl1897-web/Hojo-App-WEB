import { forwardRef } from 'react';
import { Pressable, type GestureResponderEvent, type PressableProps, type View } from 'react-native';
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { hapticLight, hapticSelection, hapticSuccess } from '@/lib/haptics';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Retour tactile à l'appui : `selection` (clic léger), `light` (petit choc), `success` (réussite). */
export type PressHaptic = 'selection' | 'light' | 'success';

const HAPTICS: Record<PressHaptic, () => void> = {
  selection: hapticSelection,
  light: hapticLight,
  success: hapticSuccess,
};

type Props = PressableProps & {
  /** Échelle atteinte pendant l'appui (1 = aucune animation). */
  pressedScale?: number;
  haptic?: PressHaptic;
};

/**
 * Un `Pressable` qui s'enfonce légèrement sous le doigt (et revient avec un petit rebond), avec en option un
 * retour tactile. Remplace `Pressable` pour les boutons, tuiles et cartes cliquables ; PAS pour un fond de
 * fenêtre (qui ne doit pas bouger). Sans animation si l'utilisateur a réduit les animations du téléphone.
 */
export const PressableFeedback = forwardRef<View, Props>(function PressableFeedback(
  { pressedScale = 0.97, haptic, onPress, onPressIn, onPressOut, style, ...rest },
  ref,
) {
  const scale = useSharedValue(1);
  const reduceMotion = useReducedMotion();
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  return (
    <AnimatedPressable
      {...rest}
      ref={ref}
      style={[typeof style === 'function' ? undefined : style, animatedStyle]}
      onPressIn={(event: GestureResponderEvent) => {
        if (!reduceMotion) scale.set(withTiming(pressedScale, { duration: 90 }));
        onPressIn?.(event);
      }}
      onPressOut={(event: GestureResponderEvent) => {
        if (!reduceMotion) scale.set(withSpring(1, { damping: 14, stiffness: 260 }));
        onPressOut?.(event);
      }}
      onPress={(event: GestureResponderEvent) => {
        if (haptic) HAPTICS[haptic]();
        onPress?.(event);
      }}
    />
  );
});
