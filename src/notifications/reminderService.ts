import * as Notifications from 'expo-notifications';
import type { SQLiteDatabase } from 'expo-sqlite';

import { deleteRemindersByEventId, insertReminder, listRemindersByEventId } from '../data/reminderRepository';
import { generateId } from '../domain/id';
import { parseISODateLocal } from '../utils/date';
import { ensureAndroidNotificationChannelAsync, ensureNotificationPermissionsAsync } from './setup';

export async function cancelRemindersForEvent(
  db: SQLiteDatabase,
  eventId: string,
): Promise<void> {
  const reminders = await listRemindersByEventId(db, eventId);
  for (const r of reminders) {
    if (r.notification_id) {
      try {
        await Notifications.cancelScheduledNotificationAsync(r.notification_id);
      } catch (e) {
        // 忽略：系统可能已清理/取消该通知
        console.warn('cancelScheduledNotificationAsync failed', e);
      }
    }
  }
  await deleteRemindersByEventId(db, eventId);
}

export async function scheduleSingleReminderForEvent(
  db: SQLiteDatabase,
  params: {
    eventId: string;
    title: string;
    isAllDay: boolean;
    startAtISO: string | null;
    startDate: string | null; // YYYY-MM-DD
    minutesBefore: number;
  },
): Promise<void> {
  await ensureAndroidNotificationChannelAsync();
  await ensureNotificationPermissionsAsync();

  let baseStart: Date;
  if (params.isAllDay) {
    if (!params.startDate) {
      throw new Error('全天日程缺少 startDate');
    }
    baseStart = parseISODateLocal(params.startDate);
    baseStart.setHours(9, 0, 0, 0); // 默认 9:00 提醒基准
  } else {
    if (!params.startAtISO) {
      throw new Error('非全天日程缺少 startAt');
    }
    baseStart = new Date(params.startAtISO);
  }

  const fireAt = new Date(baseStart.getTime() - params.minutesBefore * 60 * 1000);
  const now = new Date();

  const notificationId =
    fireAt > now
      ? await Notifications.scheduleNotificationAsync({
          content: {
            title: '日程提醒',
            body: params.isAllDay
              ? params.title
              : `${params.title} · ${baseStart.toLocaleTimeString(undefined, {
                  hour: '2-digit',
                  minute: '2-digit',
                })}`,
            sound: true,
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.DATE,
            date: fireAt,
          },
        })
      : null;

  await insertReminder(db, {
    id: generateId('rem'),
    event_id: params.eventId,
    minutes_before: params.minutesBefore,
    fire_at: fireAt.toISOString(),
    notification_id: notificationId,
    created_at: new Date().toISOString(),
  });
}

