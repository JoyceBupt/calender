export type ISODate = string; // YYYY-MM-DD（本地日期）
export type ISODateTime = string; // ISO 8601（UTC）

export type CalendarEventBase = {
  id: string;
  title: string;
  notes: string | null;
  location: string | null;
  timezone: string | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
};

export type AllDayEvent = CalendarEventBase & {
  isAllDay: true;
  startDate: ISODate;
  endDate: ISODate; // 结束日期（不含），对齐 RFC5545 DTEND 语义
};

export type TimedEvent = CalendarEventBase & {
  isAllDay: false;
  startAt: ISODateTime;
  endAt: ISODateTime;
};

export type CalendarEvent = AllDayEvent | TimedEvent;

export type EventUpsertInput =
  | {
      id: string;
      title: string;
      notes?: string | null;
      location?: string | null;
      timezone?: string | null;
      isAllDay: true;
      startDate: ISODate;
      endDate: ISODate;
    }
  | {
      id: string;
      title: string;
      notes?: string | null;
      location?: string | null;
      timezone?: string | null;
      isAllDay: false;
      startAt: ISODateTime;
      endAt: ISODateTime;
    };

