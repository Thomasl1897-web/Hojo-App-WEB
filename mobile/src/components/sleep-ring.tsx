import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { SvgFallbackBoundary, SvgModule } from '@/components/circular-gauge';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

/** Dégradé de l'anneau de sommeil : bleu vers mauve (identique en thème clair et sombre, lisible sur les deux). */
export const SLEEP_BLUE = '#4F8EF7';
export const SLEEP_PURPLE = '#9B6BF2';

type Props = {
  /** Score de 0 à 100, ou null quand il n'y a pas de nuit à montrer. */
  score: number | null;
  size?: number;
  thickness?: number;
  /** Taille du chiffre au centre. */
  fontSize?: number;
};

/**
 * Anneau du score de sommeil (bleu → mauve). Dessiné en SVG avec bouts arrondis ; sans le module natif
 * (ancien APK, Expo Go), un simple cercle mauve avec le chiffre (voir `ViewsSleepRing`).
 */
export function SleepRing(props: Props) {
  if (!SvgModule) return <ViewsSleepRing {...props} />;
  return (
    <SvgFallbackBoundary fallback={<ViewsSleepRing {...props} />}>
      <SvgSleepRing {...props} />
    </SvgFallbackBoundary>
  );
}

function Center({ score, size, fontSize }: { score: number | null; size: number; fontSize: number }) {
  const theme = useTheme();
  return (
    <View style={styles.center}>
      {score === null ? (
        <Ionicons name="moon" size={Math.round(size * 0.38)} color={theme.textFaint} />
      ) : (
        <ThemedText type="data" style={{ fontSize, lineHeight: fontSize + 4, fontWeight: '700' }}>
          {score}
        </ThemedText>
      )}
    </View>
  );
}

function SvgSleepRing({ score, size = 46, thickness = 5, fontSize = 15 }: Props) {
  const theme = useTheme();
  const { default: Svg, Circle, Defs, LinearGradient, Stop } = SvgModule!;
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const ratio = score === null ? 0 : Math.max(0, Math.min(1, score / 100));

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={styles.fill}>
        <Defs>
          <LinearGradient id="sleepGradient" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={SLEEP_BLUE} />
            <Stop offset="1" stopColor={SLEEP_PURPLE} />
          </LinearGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke={theme.line} strokeWidth={thickness} fill="none" />
        {ratio > 0 && (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="url(#sleepGradient)"
            strokeWidth={thickness}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={circumference * (1 - ratio)}
            rotation={-90}
            originX={size / 2}
            originY={size / 2}
          />
        )}
      </Svg>
      <Center score={score} size={size} fontSize={fontSize} />
    </View>
  );
}

function ViewsSleepRing({ score, size = 46, thickness = 5, fontSize = 15 }: Props) {
  const theme = useTheme();
  return (
    <View style={{ width: size, height: size }}>
      <View
        style={[
          styles.fill,
          { borderRadius: size / 2, borderWidth: thickness, borderColor: score === null ? theme.line : SLEEP_PURPLE },
        ]}
      />
      <Center score={score} size={size} fontSize={fontSize} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    ...StyleSheet.absoluteFill,
  },
  center: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
