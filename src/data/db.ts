import type { SQLiteDatabase } from 'expo-sqlite';

const DATABASE_VERSION = 2;

export async function migrateDbIfNeeded(db: SQLiteDatabase) {
  await db.execAsync('PRAGMA foreign_keys = ON;');

  const result = await db.getFirstAsync<{ user_version: number }>(
    'PRAGMA user_version',
  );
  const currentDbVersion = result?.user_version ?? 0;

  if (currentDbVersion >= DATABASE_VERSION) {
    return;
  }

  if (currentDbVersion === 0) {
    await db.execAsync(`
      PRAGMA journal_mode = 'wal';

      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL,
        notes TEXT,
        location TEXT,
        is_all_day INTEGER NOT NULL,
        start_at TEXT,
        end_at TEXT,
        start_date TEXT,
        end_date TEXT,
        timezone TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        CHECK (
          (is_all_day = 1 AND start_date IS NOT NULL AND end_date IS NOT NULL AND start_at IS NULL AND end_at IS NULL)
          OR
          (is_all_day = 0 AND start_at IS NOT NULL AND end_at IS NOT NULL)
        )
      );

      CREATE INDEX IF NOT EXISTS idx_events_start_date ON events(start_date);
      CREATE INDEX IF NOT EXISTS idx_events_end_date ON events(end_date);
      CREATE INDEX IF NOT EXISTS idx_events_start_at ON events(start_at);
      CREATE INDEX IF NOT EXISTS idx_events_end_at ON events(end_at);

      CREATE TABLE IF NOT EXISTS reminders (
        id TEXT PRIMARY KEY NOT NULL,
        event_id TEXT NOT NULL,
        minutes_before INTEGER NOT NULL,
        fire_at TEXT NOT NULL,
        notification_id TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_reminders_event_id ON reminders(event_id);
    `);
  }

  if (currentDbVersion < 2) {
    await db.execAsync(`
      -- 订阅源表
      CREATE TABLE IF NOT EXISTS subscriptions (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        url TEXT NOT NULL,
        color TEXT NOT NULL DEFAULT '#6366F1',
        last_synced_at TEXT,
        created_at TEXT NOT NULL
      );

      -- 订阅事件表（只读，每次同步时重建）
      CREATE TABLE IF NOT EXISTS subscription_events (
        id TEXT PRIMARY KEY NOT NULL,
        subscription_id TEXT NOT NULL,
        uid TEXT NOT NULL,
        title TEXT NOT NULL,
        notes TEXT,
        location TEXT,
        is_all_day INTEGER NOT NULL,
        start_at TEXT,
        end_at TEXT,
        start_date TEXT,
        end_date TEXT,
        FOREIGN KEY(subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_sub_events_subscription_id ON subscription_events(subscription_id);
      CREATE INDEX IF NOT EXISTS idx_sub_events_start_date ON subscription_events(start_date);
      CREATE INDEX IF NOT EXISTS idx_sub_events_start_at ON subscription_events(start_at);
    `);
  }

  await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION}`);
}
