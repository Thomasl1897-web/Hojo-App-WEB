import { Ionicons } from '@expo/vector-icons';
import { StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeOut, useReducedMotion } from 'react-native-reanimated';

import { useTheme } from '@/hooks/use-theme';

/** Case à cocher dont la coche apparaît en fondu (sobre, sans rebond). Le toucher est géré par le parent. */
export function AnimatedCheckbox({ checked, size = 30 }: { checked: boolean; size?: number }) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();

  return (
    <Animated.View
      style={[
        styles.box,
        { width: size, height: size, borderColor: checked ? theme.accent : theme.textFaint },
        checked && { backgroundColor: theme.accent },
      ]}>
      {checked && (
        <Animated.View
          entering={reduceMotion ? undefined : FadeIn.duration(160)}
          exiting={reduceMotion ? undefined : FadeOut.duration(100)}>
          <Ionicons name="checkmark" size={size * 0.55} color={theme.accentOnColor} />
        </Animated.View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  box: {
    borderRadius: 9,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
