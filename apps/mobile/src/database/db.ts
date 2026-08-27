import * as SQLite from 'expo-sqlite';

let databasePromise: Promise<SQLite.SQLiteDatabase> | undefined;

export function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  databasePromise ??= SQLite.openDatabaseAsync('pos.db');
  return databasePromise;
}

export async function initializeDatabase(): Promise<void> {
  const db = await getDatabase();
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;

    CREATE TABLE IF NOT EXISTS local_products (
      server_id INTEGER PRIMARY KEY NOT NULL,
      name TEXT NOT NULL,
      stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
      price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS local_history (
      uuid TEXT PRIMARY KEY NOT NULL,
      product_id INTEGER NOT NULL,
      sold_quantity INTEGER NOT NULL CHECK (sold_quantity > 0),
      price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
      created_at TEXT NOT NULL,
      note TEXT,
      sync_status TEXT NOT NULL DEFAULT 'pending'
        CHECK (sync_status IN ('pending', 'synced')),
      synced_at TEXT,
      FOREIGN KEY (product_id) REFERENCES local_products(server_id)
    );

    CREATE INDEX IF NOT EXISTS idx_local_history_pending
      ON local_history(sync_status, created_at);
  `);
  // Reset satu kali untuk menghapus seed/demo lama dari perangkat yang sudah
  // pernah menjalankan aplikasi. Data baru setelah ini tidak ikut terhapus.
  const version = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  if ((version?.user_version ?? 0) < 2) {
    await db.withTransactionAsync(async () => {
      await db.runAsync('DELETE FROM local_history');
      await db.runAsync('DELETE FROM local_products');
      await db.execAsync('PRAGMA user_version = 2');
    });
  }
  if ((version?.user_version ?? 0) < 3) {
    const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(local_products)');
    const names = new Set(columns.map((column) => column.name));
    if (!names.has('category')) await db.execAsync(`ALTER TABLE local_products ADD COLUMN category TEXT NOT NULL DEFAULT 'Produk'`);
    if (!names.has('image_url')) await db.execAsync('ALTER TABLE local_products ADD COLUMN image_url TEXT');
    await db.execAsync('PRAGMA user_version = 3');
  }
  if ((version?.user_version ?? 0) < 4) {
    const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(local_products)');
    const names = new Set(columns.map((column) => column.name));
    if (!names.has('owner_id')) await db.execAsync(`ALTER TABLE local_products ADD COLUMN owner_id TEXT NOT NULL DEFAULT ''`);
    if (!names.has('is_active')) await db.execAsync(`ALTER TABLE local_products ADD COLUMN is_active INTEGER NOT NULL DEFAULT 0`);
    await db.execAsync(`CREATE INDEX IF NOT EXISTS idx_local_products_owner_active ON local_products(owner_id, is_active, name)`);
    await db.execAsync('PRAGMA user_version = 4');
  }
  if ((version?.user_version ?? 0) < 5) {
    const columns = await db.getAllAsync<{ name: string }>('PRAGMA table_info(local_history)');
    if (!columns.some((column) => column.name === 'owner_id')) {
      await db.execAsync(`ALTER TABLE local_history ADD COLUMN owner_id TEXT NOT NULL DEFAULT ''`);
    }
    await db.execAsync(`CREATE INDEX IF NOT EXISTS idx_local_history_owner_pending ON local_history(owner_id, sync_status, created_at)`);
    await db.execAsync('PRAGMA user_version = 5');
  }
}
