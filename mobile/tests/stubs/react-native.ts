// Bouchon minimal de `react-native` : seulement ce que la logique testée importe.
export const Platform = { OS: 'android' as const };

export const Appearance = {
  applied: 'unspecified' as string,
  setColorScheme(scheme: string) {
    this.applied = scheme;
  },
};

export const Vibration = { vibrate() {} };
