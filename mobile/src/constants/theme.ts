/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

/**
 * Palette "bleu-vert" tirée de la planche d'ambiance de l'utilisateur (anneau #1B6566, bouton
 * #236B71, barres #2D7987 / #66A793 / #EAB132, fond #ECF2F5). Les couples texte/fond et
 * barre/piste ont été vérifiés au contraste WCAG (4,5:1 pour le texte, 3:1 pour les graphiques),
 * ce qui a conduit à assombrir légèrement quelques teintes par rapport à la planche : le
 * texte discret, l'ambre d'avertissement, et les barres de glucides / lipides / fibres en mode
 * clair, sinon trop pâles sur leur piste.
 */
export const Colors = {
  light: {
    text: '#12353A',
    background: '#EDF3F5',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#E3EEF0',
    textSecondary: '#4A676D',
    textFaint: '#546D74',
    line: '#D9E5E8',
    lineSoft: '#E6EEF0',
    accent: '#1F6B70',
    accentWash: '#E3EFF0',
    accentLine: '#BCD7DA',
    /** Couleur de texte à utiliser SUR un fond "accent" (boutons pleins). */
    accentOnColor: '#FFFFFF',
    warn: '#8F6420',
    warnWash: '#FBF5EA',
    warnLine: '#E8D9BC',
    danger: '#B3392A',
    dangerWash: '#FBEFEC',
    dangerLine: '#EBC5BD',
    /** Une couleur par macro, pour que les barres se distinguent sans lire leur nom. */
    macroProtein: '#2D7987',
    macroCarbs: '#3F9078',
    macroFat: '#B47800',
    macroFiber: '#6A8896',
  },
  dark: {
    text: '#E6F0F2',
    background: '#0F1A1D',
    backgroundElement: '#172528',
    backgroundSelected: '#1D3136',
    textSecondary: '#9DB6BC',
    textFaint: '#7C969D',
    line: '#263B40',
    lineSoft: '#1D2F33',
    accent: '#5DB5BD',
    accentWash: '#15292D',
    accentLine: '#2A4A50',
    accentOnColor: '#0B1A1D',
    warn: '#D7A756',
    warnWash: '#2B2013',
    warnLine: '#4A3A20',
    danger: '#E27B6C',
    dangerWash: '#2D1815',
    dangerLine: '#5A2D26',
    macroProtein: '#5FB0C0',
    macroCarbs: '#86C5B0',
    macroFat: '#F0C25A',
    macroFiber: '#9DB4BD',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

/**
 * Espace supplémentaire à réserver en bas de chaque écran d'onglet. La barre d'onglets est ancrée sous le
 * contenu (elle ne le recouvre plus) : il n'y a rien à réserver, seule la marge habituelle reste.
 */
export const BottomTabInset = 0;
export const MaxContentWidth = 800;

/** Voile sombre derrière une fenêtre (calendrier, détail d'un repas), identique dans les deux thèmes. */
export const ModalOverlay = 'rgba(8, 20, 24, 0.45)';

/** Fond de l'écran de démarrage et de l'icône Android : celui du logo (doit rester égal à app.json). */
export const SPLASH_BACKGROUND = '#F2F3EE';
