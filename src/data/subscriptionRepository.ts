import type { SQLiteDatabase } from 'expo-sqlite';

import type { Subscription, SubscriptionEvent } from '../domain/subscription';
import type { EventUpsertInput } from '../domain/event';
import { generateId } from '../domain/id';
import { parseISODateLocal } from '../utils/date';

type SubscriptionRow = {
  id: string;
  name: string;
  url: string;
  color: string;
  last_synced_at: string | null;
  created_at: string;
};

type SubscriptionEventRow = {
  id: string;
  subscription_id: string;
  uid: string;
  title: string;
  notes: string | null;
  location: string | null;
  is_all_day: number;
  start_at: string | null;
  end_at: string | null;
  start_date: string | null;
  end_date: string | null;
};

function mapSubscriptionRow(row: SubscriptionRow): Subscription {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    color: row.color,
    lastSyncedAt: row.last_synced_at,
    createdAt: row.created_at,
  };
}

function mapSubscriptionEventRow(row: SubscriptionEventRow): SubscriptionEvent {
  const base = {
    id: row.id,
    subscriptionId: row.subscription_id,
    uid: row.uid,
    title: row.title,
    notes: row.notes,
    location: row.location,
  };

  if (row.is_all_day === 1) {
    return {
      ...base,
      isAllDay: true,
      startDate: row.start_date!,
      endDate: row.end_date!,
    };
  }

  return {
    ...base,
    isAllDay: false,
    startAt: row.start_at!,
    endAt: row.end_at!,
  };
}

export async function listSubscriptions(db: SQLiteDatabase): Promise<Subscription[]> {
  const rows = await db.getAllAsync<SubscriptionRow>(
    'SELECT * FROM subscriptions ORDER BY created_at DESC',
  );
  return rows.map(mapSubscriptionRow);
}

export async function getSubscriptionById(
  db: SQLiteDatabase,
  id: string,
): Promise<Subscription | null> {
  const row = await db.getFirstAsync<SubscriptionRow>(
    'SELECT * FROM subscriptions WHERE id = ?',
    id,
  );
  return row ? mapSubscriptionRow(row) : null;
}

export async function createSubscription(
  db: SQLiteDatabase,
  input: { name: string; url: string; color?: string },
): Promise<Subscription> {
  const id = generateId();
  const now = new Date().toISOString();
  const color = input.color || '#6366F1';

  await db.runAsync(
    `INSERT INTO subscriptions (id, name, url, color, created_at) VALUES (?, ?, ?, ?, ?)`,
    id,
    input.name.trim(),
    input.url.trim(),
    color,
    now,
  );

  return {
    id,
    name: input.name.trim(),
    url: input.url.trim(),
    color,
    lastSyncedAt: null,
    createdAt: now,
  };
}

export async function deleteSubscription(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('DELETE FROM subscriptions WHERE id = ?', id);
}

export async function updateSubscriptionSyncTime(
  db: SQLiteDatabase,
  id: string,
): Promise<void> {
  const now = new Date().toISOString();
  await db.runAsync(
    'UPDATE subscriptions SET last_synced_at = ? WHERE id = ?',
    now,
    id,
  );
}

export async function clearSubscriptionEvents(
  db: SQLiteDatabase,
  subscriptionId: string,
): Promise<void> {
  await db.runAsync(
    'DELETE FROM subscription_events WHERE subscription_id = ?',
    subscriptionId,
  );
}

export async function insertSubscriptionEvents(
  db: SQLiteDatabase,
  subscriptionId: string,
  events: EventUpsertInput[],
): Promise<void> {
  for (const event of events) {
    const id = generateId();

    if (event.isAllDay) {
      await db.runAsync(
        `INSERT INTO subscription_events
         (id, subscription_id, uid, title, notes, location, is_all_day, start_date, end_date)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        id,
        subscriptionId,
        event.id,
        event.title,
        event.notes ?? null,
        event.location ?? null,
        1,
        event.startDate,
        event.endDate,
      );
    } else {
      await db.runAsync(
        `INSERT INTO subscription_events
         (id, subscription_id, uid, title, notes, location, is_all_day, start_at, end_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        id,
        subscriptionId,
        event.id,
        event.title,
        event.notes ?? null,
        event.location ?? null,
        0,
        event.startAt,
        event.endAt,
      );
    }
  }
}

export async function listSubscriptionEventsInDateRange(
  db: SQLiteDatabase,
  rangeStartDate: string,
  rangeEndDateExclusive: string,
): Promise<(SubscriptionEvent & { color: string })[]> {
  const rangeStartUtc = parseISODateLocal(rangeStartDate).toISOString();
  const rangeEndUtc = parseISODateLocal(rangeEndDateExclusive).toISOString();

  const rows = await db.getAllAsync<SubscriptionEventRow & { color: string }>(
    `
    SELECT se.*, s.color FROM subscription_events se
    JOIN subscriptions s ON se.subscription_id = s.id
    WHERE
      (se.is_all_day = 1 AND se.start_date < ? AND se.end_date > ?)
      OR
      (se.is_all_day = 0 AND se.start_at < ? AND se.end_at > ?)
    ORDER BY
      se.is_all_day DESC,
      COALESCE(se.start_at, se.start_date) ASC
    `,
    rangeEndDateExclusive,
    rangeStartDate,
    rangeEndUtc,
    rangeStartUtc,
  );

  return rows.map((row) => ({
    ...mapSubscriptionEventRow(row),
    color: row.color,
  }));
}
