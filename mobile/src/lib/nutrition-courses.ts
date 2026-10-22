import { decimalSeparator, msg, t, tp } from '@/i18n';
import type { FoodCategory } from '@/lib/nutrition-schema';

export type ShoppingItem = {
  id: number;
  foodId: string;
  name: string;
  category: FoodCategory;
  grams: number | null;
  units: number | null;
  isPantry: boolean;
  needsFreezing: boolean;
  checked: boolean;
};

export type ShoppingSection = {
  key: string;
  title: string;
  items: ShoppingItem[];
};

/** Rayons dans l'ordre d'un parcours de supermarché ; chaque rayon regroupe des catégories. */
const AISLES: { key: string; title: string; categories: FoodCategory[] }[] = [
  { key: 'produce', title: msg('Fruits et légumes'), categories: ['legume', 'fruit'] },
  { key: 'protein', title: msg('Viandes, poissons, œufs'), categories: ['proteine'] },
  { key: 'dairy', title: msg('Produits laitiers'), categories: ['produit_laitier'] },
  { key: 'starch', title: msg('Féculents'), categories: ['feculent'] },
  { key: 'fat', title: msg('Matières grasses'), categories: ['matiere_grasse'] },
  { key: 'grocery', title: msg('Épicerie'), categories: ['liant_structurel', 'epice_ou_bouillon', 'autre'] },
];

export const PANTRY_SECTION_TITLE = msg('Garde-manger — à vérifier');

/** "1,5 kg", "500 g", "6 unités" — jamais de décimales parasites (1.2000000000000002). */
export function formatQuantity(item: Pick<ShoppingItem, 'grams' | 'units'>): string {
  if (item.units !== null) {
    return tp(item.units, '{count} unité', '{count} unités');
  }
  if (item.grams !== null) {
    if (item.grams < 1000) return `${Math.round(item.grams)} g`;
    const kilograms = Number((item.grams / 1000).toFixed(2));
    return `${String(kilograms).replace('.', decimalSeparator())} kg`;
  }
  return '';
}

/**
 * Regroupe par rayon, avec le garde-manger à part en dernier (ce qu'on a probablement déjà,
 * à vérifier plutôt qu'à acheter). Dans un rayon, tri alphabétique.
 */
export function groupShoppingItems(items: ShoppingItem[]): ShoppingSection[] {
  const byName = (a: ShoppingItem, b: ShoppingItem) => a.name.localeCompare(b.name, 'fr');
  const sections: ShoppingSection[] = [];

  const toBuy = items.filter((item) => !item.isPantry);
  for (const aisle of AISLES) {
    const inAisle = toBuy.filter((item) => aisle.categories.includes(item.category)).sort(byName);
    if (inAisle.length > 0) sections.push({ key: aisle.key, title: t(aisle.title), items: inAisle });
  }

  const pantry = items.filter((item) => item.isPantry).sort(byName);
  if (pantry.length > 0) sections.push({ key: 'pantry', title: t(PANTRY_SECTION_TITLE), items: pantry });

  return sections;
}

const MAX_CUSTOM_NAME_LENGTH = 80;
const MAX_CUSTOM_QUANTITY_LENGTH = 30;

/**
 * Nettoie la saisie d'un article perso : espaces superflus retirés, nom obligatoire (sinon
 * null = rien à ajouter), quantité facultative. Les longueurs sont plafonnées pour qu'une saisie
 * collée par erreur ne casse pas la mise en page.
 */
export function parseCustomItemInput(
  name: string,
  quantity: string,
): { name: string; quantity: string | null } | null {
  const cleanName = name.replace(/\s+/g, ' ').trim().slice(0, MAX_CUSTOM_NAME_LENGTH);
  if (cleanName.length === 0) return null;
  const cleanQuantity = quantity.replace(/\s+/g, ' ').trim().slice(0, MAX_CUSTOM_QUANTITY_LENGTH);
  return { name: cleanName, quantity: cleanQuantity.length > 0 ? cleanQuantity : null };
}
