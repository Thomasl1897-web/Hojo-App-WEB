import { db } from '@/lib/database';

export type CustomShoppingItem = {
  id: number;
  name: string;
  /** Texte libre ("2", "1 paquet"), vide si non précisé. */
  quantity: string | null;
  checked: boolean;
};

/**
 * Articles ajoutés à la main (ex : "Lessive"), indépendants du plan nutrition. Comme les autres
 * données saisies par l'utilisateur, la table est EXCLUE de la réinitialisation de database.ts :
 * un réimport de plan ou un changement de schéma ne doit pas effacer sa liste perso.
 */
export function initShoppingSchema() {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS shopping_custom_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      quantity TEXT,
      checked INTEGER NOT NULL DEFAULT 0
    );
  `);
}

export function getCustomItems(): CustomShoppingItem[] {
  return db
    .getAllSync<{ id: number; name: string; quantity: string | null; checked: number }>(
      'SELECT id, name, quantity, checked FROM shopping_custom_items ORDER BY id ASC',
    )
    .map((row) => ({ id: row.id, name: row.name, quantity: row.quantity, checked: row.checked === 1 }));
}

export function addCustomItem(name: string, quantity: string | null) {
  db.runSync('INSERT INTO shopping_custom_items (name, quantity, checked) VALUES (?, ?, 0)', name, quantity);
}

export function setCustomItemChecked(id: number, checked: boolean) {
  db.runSync('UPDATE shopping_custom_items SET checked = ? WHERE id = ?', checked ? 1 : 0, id);
}

export function deleteCustomItem(id: number) {
  db.runSync('DELETE FROM shopping_custom_items WHERE id = ?', id);
}

export function deleteCheckedCustomItems() {
  db.runSync('DELETE FROM shopping_custom_items WHERE checked = 1');
}
