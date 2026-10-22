import { Component, useEffect, useState, type ReactNode } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import { useTheme } from '@/hooks/use-theme';

/** Au-delà de ce rapport, l'anneau passe en ton d'avertissement (journée dépassée). */
const OVERFLOW_THRESHOLD = 1.1;

type GaugeProps = {
  ratio: number;
  size?: number;
  thickness?: number;
  children?: ReactNode;
};

/**
 * Anneau de progression. Dessiné en SVG (bouts d'arc arrondis) quand le build de l'app contient
 * `react-native-svg` ; sinon, un build de développement plus ancien l'affiche en simples vues
 * (voir `ViewsGauge`, bouts plats). Le SVG est tenté en premier et c'est le rendu lui-même qui
 * échoue si le module natif manque : une barrière d'erreur bascule alors sur les vues.
 */
export function CircularGauge(props: GaugeProps) {
  if (!SvgModule) return <ViewsGauge {...props} />;
  return (
    <SvgFallbackBoundary fallback={<ViewsGauge {...props} />}>
      <SvgGauge {...props} />
    </SvgFallbackBoundary>
  );
}

// Chargé avec un `require` protégé : dans un build qui ne contient pas le module natif, même son
// chargement peut échouer, et ce ne serait pas rattrapable par la barrière d'erreur (hors rendu).
export let SvgModule: typeof import('react-native-svg') | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  SvgModule = require('react-native-svg') as typeof import('react-native-svg');
} catch {
  SvgModule = null;
}
const AnimatedCircle = SvgModule ? Animated.createAnimatedComponent(SvgModule.Circle) : null;

export class SvgFallbackBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function SvgGauge({ ratio, size = 156, thickness = 16, children }: GaugeProps) {
  const theme = useTheme();
  const Svg = SvgModule!.default;
  const Circle = SvgModule!.Circle;
  const ProgressCircle = AnimatedCircle!;
  const [progress] = useState(() => new Animated.Value(0));
  const clamped = Math.max(0, Math.min(1, ratio));

  useEffect(() => {
    // strokeDashoffset n'est pas animable par le pilote natif : animation côté JS.
    Animated.timing(progress, { toValue: clamped, duration: 450, useNativeDriver: false }).start();
  }, [clamped, progress]);

  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const color = ratio > OVERFLOW_THRESHOLD ? theme.warn : theme.accent;
  const dashOffset = progress.interpolate({ inputRange: [0, 1], outputRange: [circumference, 0] });
  // À 0 %, un bout arrondi dessinerait un point : on le masque.
  const visibility = progress.interpolate({ inputRange: [0, 0.002, 1], outputRange: [0, 1, 1] });

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={styles.fill}>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke={theme.line} strokeWidth={thickness} fill="none" />
        <ProgressCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={thickness}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={dashOffset}
          opacity={visibility}
          // Départ à midi, sens horaire.
          rotation={-90}
          originX={size / 2}
          originY={size / 2}
        />
      </Svg>
      <View style={styles.center}>{children}</View>
    </View>
  );
}

/**
 * Version sans module natif : de simples vues (bouts d'arc plats). Principe : un cercle dont seuls
 * les bords haut et droit sont colorés dessine un arc de 180°. On en place deux, chacun masqué à
 * une moitié de l'anneau, et on les fait tourner : le premier remplit la moitié droite (0-50 %),
 * le second la gauche (50-100 %). Les angles ont été vérifiés visuellement de 0 à 100 %.
 */
function ViewsGauge({ ratio, size = 156, thickness = 16, children }: GaugeProps) {
  const theme = useTheme();
  const [progress] = useState(() => new Animated.Value(0));
  const clamped = Math.max(0, Math.min(1, ratio));

  useEffect(() => {
    Animated.timing(progress, { toValue: clamped, duration: 450, useNativeDriver: true }).start();
  }, [clamped, progress]);

  const color = ratio > OVERFLOW_THRESHOLD ? theme.warn : theme.accent;
  const half = size / 2;

  const rightRotation = progress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['-135deg', '45deg', '45deg'],
  });
  const leftRotation = progress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['45deg', '45deg', '225deg'],
  });
  // À 0 %, les arcs affleurent la jonction des deux moitiés : on les masque pour éviter un
  // filet parasite.
  const visibility = progress.interpolate({ inputRange: [0, 0.001, 1], outputRange: [0, 1, 1] });

  const arc = {
    position: 'absolute' as const,
    width: size,
    height: size,
    borderRadius: half,
    borderWidth: thickness,
    borderColor: 'transparent',
    borderTopColor: color,
    borderRightColor: color,
  };

  return (
    <View style={{ width: size, height: size }}>
      <View
        style={[
          styles.fill,
          { borderRadius: half, borderWidth: thickness, borderColor: theme.line },
        ]}
      />
      <Animated.View style={[styles.half, { left: half, width: half, height: size, opacity: visibility }]}>
        <Animated.View style={[arc, { left: -half, transform: [{ rotate: rightRotation }] }]} />
      </Animated.View>
      <Animated.View style={[styles.half, { left: 0, width: half, height: size, opacity: visibility }]}>
        <Animated.View style={[arc, { left: 0, transform: [{ rotate: leftRotation }] }]} />
      </Animated.View>
      <View style={styles.center}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    ...StyleSheet.absoluteFill,
  },
  half: {
    position: 'absolute',
    top: 0,
    overflow: 'hidden',
  },
  center: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
