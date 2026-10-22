import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';

import { revealDelay } from '@/lib/reveal-delay';

/** Fait apparaître son contenu en glissant légèrement vers le haut, en cascade selon `index`. */
export function Reveal({ index = 0, style, children }: { index?: number; style?: StyleProp<ViewStyle>; children: ReactNode }) {
  const reduceMotion = useReducedMotion();
  return (
    <Animated.View entering={reduceMotion ? undefined : FadeInDown.delay(revealDelay(index)).duration(320)} style={style}>
      {children}
    </Animated.View>
  );
}
