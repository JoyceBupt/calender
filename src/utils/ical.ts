/**
 * iCalendar (RFC 5545) 格式序列化和反序列化工具
 */

import type { CalendarEvent, EventUpsertInput } from '../domain/event';
import { generateId } from '../domain/id';

/**
 * 将 Date 对象转换为 iCal 的 UTC 时间格式: YYYYMMDDTHHmmssZ
 */
function toICalDateTime(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  const h = String(date.getUTCHours()).padStart(2, '0');
  const min = String(date.getUTCMinutes()).padStart(2, '0');
  const s = String(date.getUTCSeconds()).padStart(2, '0');
  return `${y}${m}${d}T${h}${min}${s}Z`;
}

/**
 * 将 ISODate (YYYY-MM-DD) 转换为 iCal 的全天日期格式: YYYYMMDD
 */
function toICalDate(isoDate: string): string {
  return isoDate.replace(/-/g, '');
}

/**
 * 解析 iCal 日期时间格式
 * 支持: YYYYMMDD (全天) 或 YYYYMMDDTHHmmss / YYYYMMDDTHHmmssZ (时间)
 */
function parseICalDateTime(value: string): { date: Date; isAllDay: boolean } {
  // 移除可能的 VALUE=DATE: 前缀和时区信息
  const cleanValue = value.replace(/^[^:]*:/, '').trim();

  if (cleanValue.length === 8) {
    // 全天日期: YYYYMMDD
    const y = parseInt(cleanValue.slice(0, 4), 10);
    const m = parseInt(cleanValue.slice(4, 6), 10) - 1;
    const d = parseInt(cleanValue.slice(6, 8), 10);
    return { date: new Date(y, m, d), isAllDay: true };
  }

  // 时间格式: YYYYMMDDTHHmmss 或 YYYYMMDDTHHmmssZ
  const y = parseInt(cleanValue.slice(0, 4), 10);
  const m = parseInt(cleanValue.slice(4, 6), 10) - 1;
  const d = parseInt(cleanValue.slice(6, 8), 10);
  const h = parseInt(cleanValue.slice(9, 11), 10);
  const min = parseInt(cleanValue.slice(11, 13), 10);
  const s = parseInt(cleanValue.slice(13, 15), 10) || 0;

  if (cleanValue.endsWith('Z')) {
    return { date: new Date(Date.UTC(y, m, d, h, min, s)), isAllDay: false };
  }

  // 浮动时间：按本地时间解析（多数订阅/导入文件以此表达“当地时间”）
  return { date: new Date(y, m, d, h, min, s), isAllDay: false };
}

/**
 * 转义 iCal 文本字段中的特殊字符
 */
function escapeICalText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

/**
 * 反转义 iCal 文本
 */
function unescapeICalText(text: string): string {
  return text
    .replace(/\\n/g, '\n')
    .replace(/\\,/g, ',')
    .replace(/\\;/g, ';')
    .replace(/\\\\/g, '\\');
}

/**
 * 将单个事件序列化为 VEVENT 组件
 */
function eventToVEvent(event: CalendarEvent): string {
  const lines: string[] = [];
  lines.push('BEGIN:VEVENT');
  lines.push(`UID:${event.id}`);
  lines.push(`DTSTAMP:${toICalDateTime(new Date(event.createdAt))}`);

  if (event.isAllDay) {
    lines.push(`DTSTART;VALUE=DATE:${toICalDate(event.startDate)}`);
    lines.push(`DTEND;VALUE=DATE:${toICalDate(event.endDate)}`);
  } else {
    lines.push(`DTSTART:${toICalDateTime(new Date(event.startAt))}`);
    lines.push(`DTEND:${toICalDateTime(new Date(event.endAt))}`);
  }

  lines.push(`SUMMARY:${escapeICalText(event.title)}`);

  if (event.location) {
    lines.push(`LOCATION:${escapeICalText(event.location)}`);
  }

  if (event.notes) {
    lines.push(`DESCRIPTION:${escapeICalText(event.notes)}`);
  }

  lines.push('END:VEVENT');
  return lines.join('\r\n');
}

/**
 * 将事件列表导出为完整的 iCalendar 文件内容
 */
export function exportToICS(events: CalendarEvent[]): string {
  const lines: string[] = [];
  lines.push('BEGIN:VCALENDAR');
  lines.push('VERSION:2.0');
  lines.push('PRODID:-//CalendarApp//CalendarApp//EN');
  lines.push('CALSCALE:GREGORIAN');
  lines.push('METHOD:PUBLISH');

  for (const event of events) {
    lines.push(eventToVEvent(event));
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

/**
 * 解析 VEVENT 组件为 EventUpsertInput
 */
function parseVEvent(veventLines: string[]): EventUpsertInput | null {
  const props: Record<string, string> = {};

  for (const line of veventLines) {
    // 处理折行（以空格或 TAB 开头的行是续行）
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;

    const key = line.slice(0, colonIndex).toUpperCase();
    const value = line.slice(colonIndex + 1);

    // 提取基本属性名（去除参数，如 DTSTART;VALUE=DATE）
    const baseName = key.split(';')[0];
    props[baseName] = value;
    props[key] = value; // 也保存完整 key
  }

  const uid = props['UID'];
  const summary = props['SUMMARY'];
  if (!summary) return null;

  const title = unescapeICalText(summary);
  const notes = props['DESCRIPTION'] ? unescapeICalText(props['DESCRIPTION']) : null;
  const location = props['LOCATION'] ? unescapeICalText(props['LOCATION']) : null;

  // 解析开始时间
  const dtStartKey = Object.keys(props).find((k) => k.startsWith('DTSTART'));
  const dtEndKey = Object.keys(props).find((k) => k.startsWith('DTEND'));

  if (!dtStartKey) return null;

  const startResult = parseICalDateTime(props[dtStartKey]);

  const baseId = uid || generateId();

  if (startResult.isAllDay) {
    // 全天事件
    const startDate = startResult.date;
    let endDate = startDate;

    if (dtEndKey) {
      const endResult = parseICalDateTime(props[dtEndKey]);
      endDate = endResult.date;
    } else {
      // 没有 DTEND，默认为单天
      endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 1);
    }

    const formatDate = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

    return {
      id: baseId,
      title,
      notes,
      location,
      isAllDay: true,
      startDate: formatDate(startDate),
      endDate: formatDate(endDate),
    };
  } else {
    // 定时事件
    let endAt = new Date(startResult.date.getTime() + 60 * 60 * 1000); // 默认 1 小时

    if (dtEndKey) {
      const endResult = parseICalDateTime(props[dtEndKey]);
      endAt = endResult.date;
    }

    return {
      id: baseId,
      title,
      notes,
      location,
      isAllDay: false,
      startAt: startResult.date.toISOString(),
      endAt: endAt.toISOString(),
    };
  }
}

/**
 * 解析 iCalendar 文件内容，返回事件列表
 */
export function parseICS(content: string): EventUpsertInput[] {
  const events: EventUpsertInput[] = [];

  // 处理折行：以空格或 TAB 开头的行是续行
  const unfoldedContent = content.replace(/\r\n[ \t]/g, '');
  const lines = unfoldedContent.split(/\r?\n/);

  let inVEvent = false;
  let veventLines: string[] = [];

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (trimmedLine === 'BEGIN:VEVENT') {
      inVEvent = true;
      veventLines = [];
    } else if (trimmedLine === 'END:VEVENT') {
      inVEvent = false;
      const parsed = parseVEventWithRecurrence(veventLines);
      events.push(...parsed);
    } else if (inVEvent) {
      veventLines.push(trimmedLine);
    }
  }

  return events;
}

type ExpandParams =
  | {
      baseId: string;
      title: string;
      notes: string | null;
      location: string | null;
      isAllDay: true;
      start: Date; // inclusive
      end: Date; // exclusive
      rrule: string;
    }
  | {
      baseId: string;
      title: string;
      notes: string | null;
      location: string | null;
      isAllDay: false;
      start: Date;
      end: Date;
      rrule: string;
    };

function parseVEventWithRecurrence(veventLines: string[]): EventUpsertInput[] {
  // parseVEvent 内部会处理无 RRULE 的普通事件
  const props: Record<string, string> = {};
  for (const line of veventLines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;
    const key = line.slice(0, colonIndex).toUpperCase();
    const value = line.slice(colonIndex + 1);
    const baseName = key.split(';')[0];
    props[baseName] = value;
    props[key] = value;
  }

  const summary = props['SUMMARY'];
  if (!summary) return [];

  const uid = props['UID'];
  const title = unescapeICalText(summary);
  const notes = props['DESCRIPTION'] ? unescapeICalText(props['DESCRIPTION']) : null;
  const location = props['LOCATION'] ? unescapeICalText(props['LOCATION']) : null;
  const dtStartKey = Object.keys(props).find((k) => k.startsWith('DTSTART'));
  const dtEndKey = Object.keys(props).find((k) => k.startsWith('DTEND'));
  if (!dtStartKey) return [];

  const rrule = props['RRULE'];
  const startResult = parseICalDateTime(props[dtStartKey]);
  const baseId = uid || generateId();

  if (!rrule) {
    const single = parseVEvent(veventLines);
    return single ? [single] : [];
  }

  if (startResult.isAllDay) {
    const startDate = startResult.date;
    let endDate = startDate;
    if (dtEndKey) {
      const endResult = parseICalDateTime(props[dtEndKey]);
      endDate = endResult.date;
    } else {
      endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 1);
    }

    return expandRecurringEvents({
      baseId,
      title,
      notes,
      location,
      isAllDay: true,
      start: startDate,
      end: endDate,
      rrule,
    });
  }

  let endAt = new Date(startResult.date.getTime() + 60 * 60 * 1000);
  if (dtEndKey) {
    const endResult = parseICalDateTime(props[dtEndKey]);
    endAt = endResult.date;
  }

  return expandRecurringEvents({
    baseId,
    title,
    notes,
    location,
    isAllDay: false,
    start: startResult.date,
    end: endAt,
    rrule,
  });
}

function expandRecurringEvents(params: ExpandParams): EventUpsertInput[] {
  const rule: Record<string, string> = {};
  for (const part of params.rrule.split(';')) {
    const [k, v] = part.split('=');
    if (!k || !v) continue;
    rule[k.toUpperCase()] = v;
  }

  const freq = rule['FREQ']?.toUpperCase();
  if (freq !== 'DAILY' && freq !== 'WEEKLY') {
    // 其他频率暂不展开，退化为单个事件
    return [toSingleEventUpsert(params)];
  }

  const interval = Math.max(1, Number(rule['INTERVAL'] ?? 1) || 1);
  const countLimit = rule['COUNT'] ? Math.max(1, Number(rule['COUNT']) || 0) : null;
  const until = rule['UNTIL'] ? parseICalDateTime(rule['UNTIL']).date : null;

  const byDayRaw = rule['BYDAY'];
  const byDaySet = new Set<number>();
  if (freq === 'WEEKLY') {
    const tokens = byDayRaw ? byDayRaw.split(',') : [];
    if (tokens.length === 0) {
      byDaySet.add(params.start.getDay());
    } else {
      for (const t of tokens) {
        const day = t.trim().toUpperCase();
        const mapped =
          day === 'SU'
            ? 0
            : day === 'MO'
              ? 1
              : day === 'TU'
                ? 2
                : day === 'WE'
                  ? 3
                  : day === 'TH'
                    ? 4
                    : day === 'FR'
                      ? 5
                      : day === 'SA'
                        ? 6
                        : null;
        if (mapped != null) byDaySet.add(mapped);
      }
      if (byDaySet.size === 0) byDaySet.add(params.start.getDay());
    }
  }

  // 展开窗口：避免把“无限循环”导入成海量数据
  const now = new Date();
  const windowStart = new Date(now);
  windowStart.setDate(windowStart.getDate() - 30);
  windowStart.setHours(0, 0, 0, 0);
  const windowEnd = new Date(now);
  windowEnd.setDate(windowEnd.getDate() + 365);
  windowEnd.setHours(23, 59, 59, 999);

  const startFloor = new Date(params.start);
  startFloor.setHours(0, 0, 0, 0);

  const occurrences: EventUpsertInput[] = [];
  let produced = 0;

  const durationDays = params.isAllDay ? diffDaysBetween(params.start, params.end) : null;
  const durationMs = params.isAllDay ? null : params.end.getTime() - params.start.getTime();

  const weekStartMonday = (d: Date) => {
    const day = d.getDay();
    const diff = (day - 1 + 7) % 7; // 1=周一
    const out = new Date(d);
    out.setHours(0, 0, 0, 0);
    out.setDate(out.getDate() - diff);
    return out;
  };

  const baseWeek = weekStartMonday(startFloor).getTime();

  for (
    let cursor = new Date(windowStart);
    cursor <= windowEnd;
    cursor.setDate(cursor.getDate() + 1)
  ) {
    const dayFloor = new Date(cursor);
    dayFloor.setHours(0, 0, 0, 0);

    // 不生成 DTSTART 之前的实例
    if (dayFloor < startFloor) continue;

    if (freq === 'DAILY') {
      const diffDays = Math.floor((dayFloor.getTime() - startFloor.getTime()) / 86400000);
      if (diffDays % interval !== 0) continue;
    } else {
      if (!byDaySet.has(dayFloor.getDay())) continue;
      const week = weekStartMonday(dayFloor).getTime();
      const diffWeeks = Math.floor((week - baseWeek) / (7 * 86400000));
      if (diffWeeks % interval !== 0) continue;
    }

    // 对于定时事件，把时间拷贝到当天；对于全天事件直接使用日期
    const instanceStart = new Date(dayFloor);
    if (!params.isAllDay) {
      instanceStart.setHours(
        params.start.getHours(),
        params.start.getMinutes(),
        params.start.getSeconds(),
        params.start.getMilliseconds(),
      );
      if (instanceStart < params.start) continue;
    }

    if (until && instanceStart > until) break;

    if (params.isAllDay) {
      const id = `${params.baseId}#${formatISODate(dayFloor)}`;
      occurrences.push({
        id,
        title: params.title,
        notes: params.notes,
        location: params.location,
        isAllDay: true,
        startDate: formatISODate(dayFloor),
        endDate: formatISODate(addDays(dayFloor, durationDays!)),
      });
    } else {
      const id = `${params.baseId}#${instanceStart.toISOString()}`;
      const instanceEnd = new Date(instanceStart.getTime() + durationMs!);
      occurrences.push({
        id,
        title: params.title,
        notes: params.notes,
        location: params.location,
        isAllDay: false,
        startAt: instanceStart.toISOString(),
        endAt: instanceEnd.toISOString(),
      });
    }
    produced++;

    if (countLimit && produced >= countLimit) break;
  }

  return occurrences.length ? occurrences : [toSingleEventUpsert(params)];
}

function toSingleEventUpsert(params: ExpandParams): EventUpsertInput {
  if (params.isAllDay) {
    return {
      id: params.baseId,
      title: params.title,
      notes: params.notes,
      location: params.location,
      isAllDay: true,
      startDate: formatISODate(params.start),
      endDate: formatISODate(params.end),
    };
  }

  return {
    id: params.baseId,
    title: params.title,
    notes: params.notes,
    location: params.location,
    isAllDay: false,
    startAt: params.start.toISOString(),
    endAt: params.end.toISOString(),
  };
}

function addDays(date: Date, days: number): Date {
  const out = new Date(date);
  out.setDate(out.getDate() + days);
  return out;
}

function diffDaysBetween(start: Date, endExclusive: Date): number {
  const a = new Date(start);
  a.setHours(0, 0, 0, 0);
  const b = new Date(endExclusive);
  b.setHours(0, 0, 0, 0);
  return Math.max(1, Math.floor((b.getTime() - a.getTime()) / 86400000));
}

function formatISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
