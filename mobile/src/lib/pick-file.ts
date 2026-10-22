import type { DocumentPickerAsset } from 'expo-document-picker';
import { File } from 'expo-file-system';
import { Platform } from 'react-native';

/**
 * Texte d'un fichier choisi avec le sélecteur de documents. Sur le web, `expo-file-system` ne sait pas lire un
 * fichier (`File` n'y est qu'une coquille vide) : le navigateur donne directement le fichier choisi.
 */
export async function readPickedText(asset: DocumentPickerAsset): Promise<string> {
  if (Platform.OS === 'web') {
    if (asset.file) return asset.file.text();
    return (await fetch(asset.uri)).text();
  }
  return new File(asset.uri).text();
}

/** Web seulement : fait télécharger `content` par le navigateur sous le nom `fileName`. */
export function downloadTextFile(fileName: string, content: string, mimeType = 'application/json') {
  const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
