import type { SQLiteDatabase } from 'expo-sqlite';

export type ReminderRow = {
  id: string;
  event_id: string;
  minutes_before: number;
  fire_at: string;
  notification_id: string | null;
  created_at: string;
};

export async function listRemindersByEventId(
  db: SQLiteDatabase,
  eventId: string,
): Promise<ReminderRow[]> {
  return db.getAllAsync<ReminderRow>(
    'SELECT * FROM reminders WHERE event_id = ? ORDER BY minutes_before ASC',
    eventId,
  );
}

export async function deleteRemindersByEventId(
  db: SQLiteDatabase,
  eventId: string,
): Promise<void> {
  await db.runAsync('DELETE FROM reminders WHERE event_id = ?', eventId);
}

export async function insertReminder(
  db: SQLiteDatabase,
  row: ReminderRow,
): Promise<void> {
  await db.runAsync(
    `
      INSERT INTO reminders (
        id, event_id, minutes_before, fire_at, notification_id, created_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `,
    row.id,
    row.event_id,
    row.minutes_before,
    row.fire_at,
    row.notification_id,
    row.created_at,
  );
}

