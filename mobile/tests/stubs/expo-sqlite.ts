// Bouchon d'`expo-sqlite` : la même API synchrone, au-dessus du SQLite intégré à Node.
// La base est en mémoire et neuve à chaque exécution ; `resetDatabase()` la vide entre deux tests.
import { DatabaseSync } from 'node:sqlite';

type Param = string | number | null;

class StubDatabase {
  private raw = new DatabaseSync(':memory:');

  execSync(sql: string) {
    this.raw.exec(sql);
  }

  runSync(sql: string, ...params: Param[]) {
    const result = this.raw.prepare(sql).run(...params);
    return { changes: Number(result.changes), lastInsertRowId: Number(result.lastInsertRowid) };
  }

  getAllSync<T>(sql: string, ...params: Param[]): T[] {
    return this.raw.prepare(sql).all(...params) as T[];
  }

  getFirstSync<T>(sql: string, ...params: Param[]): T | null {
    return (this.raw.prepare(sql).get(...params) as T | undefined) ?? null;
  }

  withTransactionSync(task: () => void) {
    this.raw.exec('BEGIN');
    try {
      task();
      this.raw.exec('COMMIT');
    } catch (error) {
      this.raw.exec('ROLLBACK');
      throw error;
    }
  }

  /** Spécifique aux tests : supprime toutes les tables (schéma compris). */
  dropEverything() {
    const tables = this.getAllSync<{ name: string }>("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'");
    for (const { name } of tables) this.raw.exec(`DROP TABLE IF EXISTS ${name}`);
    this.raw.exec('PRAGMA user_version = 0');
  }
}

const shared = new StubDatabase();

export function openDatabaseSync(_name: string) {
  return shared;
}
