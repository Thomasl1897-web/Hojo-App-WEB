// Résolution des modules pour les tests (Node exécute le TypeScript directement, sans dépendance) :
//   - l'alias `@/…` du projet pointe vers src/ ;
//   - les modules natifs d'Expo / React Native sont remplacés par des bouchons (tests/stubs) ;
//   - les imports sans extension sont complétés (.ts / .tsx).
import { existsSync } from 'node:fs';
import { dirname, join, resolve as resolvePath } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, '..', 'src');

const STUBS = {
  'expo-sqlite': join(here, 'stubs', 'expo-sqlite.ts'),
  'react-native': join(here, 'stubs', 'react-native.ts'),
  'expo-constants': join(here, 'stubs', 'expo-constants.ts'),
};

function withExtension(path) {
  for (const candidate of [path, `${path}.ts`, `${path}.tsx`, join(path, 'index.ts')]) {
    if (existsSync(candidate) && /\.tsx?$/.test(candidate)) return candidate;
  }
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  if (STUBS[specifier]) {
    return { url: pathToFileURL(STUBS[specifier]).href, shortCircuit: true };
  }
  if (specifier.startsWith('@/')) {
    const file = withExtension(join(src, specifier.slice(2)));
    if (file) return { url: pathToFileURL(file).href, shortCircuit: true };
  }
  if (specifier.startsWith('.') && context.parentURL?.startsWith('file:')) {
    const base = resolvePath(dirname(fileURLToPath(context.parentURL)), specifier);
    const file = withExtension(base);
    if (file) return { url: pathToFileURL(file).href, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
