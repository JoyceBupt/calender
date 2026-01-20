import * as Notifications from 'expo-notifications';
import type { SQLiteDatabase } from 'expo-sqlite';

export async function resetAllData(db: SQLiteDatabase): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    // ignore
  }

  await db.execAsync(`
    DELETE FROM subscription_events;
    DELETE FROM subscriptions;
    DELETE FROM reminders;
    DELETE FROM events;
    VACUUM;
  `);
}

