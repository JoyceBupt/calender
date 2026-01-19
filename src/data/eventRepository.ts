import type { SQLiteDatabase } from 'expo-sqlite';

import type { CalendarEvent, EventUpsertInput } from '../domain/event';
import { addDaysISODateLocal, parseISODateLocal } from '../utils/date';

type EventRow = {
  id: string;
  title: string;
  notes: string | null;
  location: string | null;
  is_all_day: number;
  start_at: string | null;
  end_at: string | null;
  start_date: string | null;
  end_date: string | null;
  timezone: string | null;
  created_at: string;
  updated_at: string;
};

function mapEventRow(row: EventRow): CalendarEvent {
  const base = {
    id: row.id,
    title: row.title,
    notes: row.notes,
    location: row.location,
    timezone: row.timezone,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };

  if (row.is_all_day === 1) {
    if (!row.start_date || !row.end_date) {
      throw new Error(`events(${row.id}) 缺少 start_date/end_date`);
    }
    return {
      ...base,
      isAllDay: true,
      startDate: row.start_date,
      endDate: row.end_date,
    };
  }

  if (!row.start_at || !row.end_at) {
    throw new Error(`events(${row.id}) 缺少 start_at/end_at`);
  }

  return {
    ...base,
    isAllDay: false,
    startAt: row.start_at,
    endAt: row.end_at,
  };
}

export async function getEventById(
  db: SQLiteDatabase,
  id: string,
): Promise<CalendarEvent | null> {
  const row = await db.getFirstAsync<EventRow>(
    'SELECT * FROM events WHERE id = ?',
    id,
  );
  return row ? mapEventRow(row) : null;
}

export async function upsertEvent(
  db: SQLiteDatabase,
  input: EventUpsertInput,
): Promise<void> {
  const now = new Date().toISOString();
  const existing = await getEventById(db, input.id);
  const createdAt = existing?.createdAt ?? now;

  const common = {
    id: input.id,
    title: input.title.trim(),
    notes: input.notes ?? null,
    location: input.location ?? null,
    timezone: input.timezone ?? null,
  };

  if (input.isAllDay) {
    await db.runAsync(
      `
        INSERT INTO events (
          id, title, notes, location, is_all_day,
          start_at, end_at, start_date, end_date, timezone,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          title = excluded.title,
          notes = excluded.notes,
          location = excluded.location,
          is_all_day = excluded.is_all_day,
          start_at = excluded.start_at,
          end_at = excluded.end_at,
          start_date = excluded.start_date,
          end_date = excluded.end_date,
          timezone = excluded.timezone,
          updated_at = excluded.updated_at
      `,
      common.id,
      common.title,
      common.notes,
      common.location,
      1,
      null,
      null,
      input.startDate,
      input.endDate,
      common.timezone,
      createdAt,
      now,
    );
    return;
  }

  await db.runAsync(
    `
      INSERT INTO events (
        id, title, notes, location, is_all_day,
        start_at, end_at, start_date, end_date, timezone,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        notes = excluded.notes,
        location = excluded.location,
        is_all_day = excluded.is_all_day,
        start_at = excluded.start_at,
        end_at = excluded.end_at,
        start_date = excluded.start_date,
        end_date = excluded.end_date,
        timezone = excluded.timezone,
        updated_at = excluded.updated_at
    `,
    common.id,
    common.title,
    common.notes,
    common.location,
    0,
    input.startAt,
    input.endAt,
    null,
    null,
    common.timezone,
    createdAt,
    now,
  );
}

export async function deleteEvent(db: SQLiteDatabase, id: string): Promise<void> {
  await db.runAsync('DELETE FROM events WHERE id = ?', id);
}

export async function listEventsInDateRange(
  db: SQLiteDatabase,
  rangeStartDate: string,
  rangeEndDateExclusive: string,
): Promise<CalendarEvent[]> {
  const rangeStartUtc = parseISODateLocal(rangeStartDate).toISOString();
  const rangeEndUtc = parseISODateLocal(rangeEndDateExclusive).toISOString();

  const rows = await db.getAllAsync<EventRow>(
    `
      SELECT * FROM events
      WHERE
        (is_all_day = 1 AND start_date < ? AND end_date > ?)
        OR
        (is_all_day = 0 AND start_at < ? AND end_at > ?)
      ORDER BY
        is_all_day DESC,
        COALESCE(start_at, start_date) ASC
    `,
    rangeEndDateExclusive,
    rangeStartDate,
    rangeEndUtc,
    rangeStartUtc,
  );

  return rows.map(mapEventRow);
}

export async function listEventsForDate(
  db: SQLiteDatabase,
  isoDate: string,
): Promise<CalendarEvent[]> {
  return listEventsInDateRange(db, isoDate, addDaysISODateLocal(isoDate, 1));
}

/**
 * 获取所有事件（用于导出）
 */
export async function listAllEvents(db: SQLiteDatabase): Promise<CalendarEvent[]> {
  const rows = await db.getAllAsync<EventRow>(
    `
      SELECT * FROM events
      ORDER BY
        is_all_day DESC,
        COALESCE(start_at, start_date) ASC
    `,
  );

  return rows.map(mapEventRow);
}
