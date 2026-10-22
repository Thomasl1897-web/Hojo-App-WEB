// Bouchon d'`expo-constants` : l'app tourne dans un development build (pas dans Expo Go).
export const ExecutionEnvironment = { StoreClient: 'storeClient', Standalone: 'standalone', Bare: 'bare' } as const;

export default {
  executionEnvironment: ExecutionEnvironment.Standalone,
};
