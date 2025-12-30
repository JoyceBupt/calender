import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { CalendarEvent } from '../domain/event';
import { addDaysISODateLocal, getTodayISODateLocal, parseISODateLocal } from '../utils/date';

const HOUR_HEIGHT = 56;
const PX_PER_MINUTE = HOUR_HEIGHT / 60;
export const WEEK_TIME_GUTTER_WIDTH = 44;
const MIN_EVENT_HEIGHT = 16;
const EVENT_HORIZONTAL_GAP = 4;

type TimedBlock = {
  id: string;
  title: string;
  dayIndex: number;
  startMinutes: number;
  endMinutes: number;
  column: number;
  columnCount: number;
  displayStart: Date;
  displayEnd: Date;
};

function formatTime(date: Date): string {
  return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function layoutTimedBlocks(blocks: Omit<TimedBlock, 'column' | 'columnCount'>[]): TimedBlock[] {
  const sorted = [...blocks].sort((a, b) => {
    if (a.startMinutes !== b.startMinutes) return a.startMinutes - b.startMinutes;
    return b.endMinutes - a.endMinutes;
  });

  const clusters: Omit<TimedBlock, 'column' | 'columnCount'>[][] = [];
  let current: Omit<TimedBlock, 'column' | 'columnCount'>[] = [];
  let currentEnd = -Infinity;

  for (const block of sorted) {
    if (current.length === 0 || block.startMinutes < currentEnd) {
      current.push(block);
      currentEnd = Math.max(currentEnd, block.endMinutes);
    } else {
      clusters.push(current);
      current = [block];
      currentEnd = block.endMinutes;
    }
  }
  if (current.length) clusters.push(current);

  const result: TimedBlock[] = [];

  for (const cluster of clusters) {
    const columnEnds: number[] = [];
    let maxColumns = 0;
    const assigned: TimedBlock[] = [];

    for (const block of cluster) {
      let column = columnEnds.findIndex((end) => end <= block.startMinutes);
      if (column === -1) {
        column = columnEnds.length;
        columnEnds.push(block.endMinutes);
      } else {
        columnEnds[column] = block.endMinutes;
      }
      maxColumns = Math.max(maxColumns, columnEnds.length);
      assigned.push({ ...block, column, columnCount: 1 });
    }

    result.push(...assigned.map((b) => ({ ...b, columnCount: maxColumns })));
  }

  return result;
}

function clampEventsToWeekDays(
  weekStart: string,
  events: CalendarEvent[],
): { days: string[]; allDayByDay: Record<string, CalendarEvent[]>; timedBlocks: TimedBlock[] } {
  const days = Array.from({ length: 7 }).map((_, i) => addDaysISODateLocal(weekStart, i));
  const allDayByDay: Record<string, CalendarEvent[]> = Object.fromEntries(days.map((d) => [d, []]));

  const timedBlocksRaw: Omit<TimedBlock, 'column' | 'columnCount'>[] = [];

  // 全天事件：按天分桶（最小可用，后续可升级为跨天横条）
  for (const event of events) {
    if (!event.isAllDay) continue;
    for (const day of days) {
      if (day >= event.startDate && day < event.endDate) {
        allDayByDay[day]?.push(event);
      }
    }
  }

  // 非全天事件：按天裁剪生成段
  for (const event of events) {
    if (event.isAllDay) continue;
    const eventStart = new Date(event.startAt);
    const eventEnd = new Date(event.endAt);

    for (let dayIndex = 0; dayIndex < days.length; dayIndex++) {
      const isoDate = days[dayIndex];
      const dayStart = parseISODateLocal(isoDate);
      const dayEnd = parseISODateLocal(addDaysISODateLocal(isoDate, 1));

      const startMs = Math.max(eventStart.getTime(), dayStart.getTime());
      const endMs = Math.min(eventEnd.getTime(), dayEnd.getTime());
      if (endMs <= startMs) continue;

      const displayStart = new Date(startMs);
      const displayEnd = new Date(endMs);
      const startMinutes = (startMs - dayStart.getTime()) / 60000;
      const endMinutes = (endMs - dayStart.getTime()) / 60000;

      timedBlocksRaw.push({
        id: event.id,
        title: event.title,
        dayIndex,
        startMinutes,
        endMinutes,
        displayStart,
        displayEnd,
      });
    }
  }

  // 同一天内才需要做重叠分列：按 dayIndex 分组
  const timedBlocks: TimedBlock[] = [];
  for (let dayIndex = 0; dayIndex < days.length; dayIndex++) {
    const dayBlocks = timedBlocksRaw.filter((b) => b.dayIndex === dayIndex);
    timedBlocks.push(...layoutTimedBlocks(dayBlocks));
  }

  return { days, allDayByDay, timedBlocks };
}

export function WeekTimeline({
  weekStart,
  selectedDate,
  events,
  onSelectDate,
  onPressEvent,
}: {
  weekStart: string;
  selectedDate: string;
  events: CalendarEvent[];
  onSelectDate: (isoDate: string) => void;
  onPressEvent: (eventId: string) => void;
}) {
  const scrollRef = useRef<ScrollView>(null);
  const [gridWidth, setGridWidth] = useState(0);

  const { days, allDayByDay, timedBlocks } = useMemo(
    () => clampEventsToWeekDays(weekStart, events),
    [events, weekStart],
  );

  const today = getTodayISODateLocal();
  const todayIndex = days.indexOf(today);
  const showNow = todayIndex !== -1;

  const nowMinutes = useMemo(() => {
    if (!showNow) return null;
    const now = new Date();
    const dayStart = parseISODateLocal(today);
    return (now.getTime() - dayStart.getTime()) / 60000;
  }, [showNow, today]);

  const dayColumnWidth = gridWidth > 0 ? gridWidth / 7 : 0;

  useEffect(() => {
    const targetMinutes = showNow ? nowMinutes ?? 8 * 60 : 8 * 60;
    const y = Math.max(0, targetMinutes * PX_PER_MINUTE - 120);
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y, animated: false });
    });
  }, [nowMinutes, showNow, weekStart]);

  return (
    <View style={styles.container}>
      <View style={styles.allDayRow}>
        <View style={{ width: WEEK_TIME_GUTTER_WIDTH }} />
        <View style={styles.allDayGrid}>
          {days.map((d) => {
            const list = allDayByDay[d] ?? [];
            const shown = list.slice(0, 2);
            const more = Math.max(0, list.length - shown.length);
            const isSelected = d === selectedDate;
            return (
              <Pressable
                key={d}
                style={[styles.allDayCell, isSelected ? styles.selectedDayCell : null]}
                onPress={() => onSelectDate(d)}
              >
                {shown.map((e) => (
                  <Pressable
                    key={`${d}:${e.id}`}
                    style={styles.allDayChip}
                    onPress={() => onPressEvent(e.id)}
                  >
                    <Text style={styles.allDayChipText} numberOfLines={1}>
                      {e.title}
                    </Text>
                  </Pressable>
                ))}
                {more > 0 ? (
                  <Text style={styles.allDayMore}>+{more}</Text>
                ) : (
                  <View style={{ height: 16 }} />
                )}
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.gridContainer}>
        <ScrollView ref={scrollRef} style={styles.scroll}>
          <View style={styles.gridRow}>
            <View style={styles.timeGutter}>
              {Array.from({ length: 24 }).map((_, h) => (
                <View key={h} style={styles.hourLabelRow}>
                  <Text style={styles.hourText}>{h}</Text>
                </View>
              ))}
            </View>

            <View
              style={styles.weekGrid}
              onLayout={(e) => setGridWidth(e.nativeEvent.layout.width)}
            >
              <View style={styles.dayColumns} pointerEvents="box-none">
                {days.map((d, idx) => (
                  <Pressable
                    key={d}
                    style={[
                      styles.dayColumn,
                      idx === 0 ? styles.dayColumnFirst : null,
                      d === selectedDate ? styles.selectedDayColumn : null,
                    ]}
                    onPress={() => onSelectDate(d)}
                  />
                ))}
              </View>

              {Array.from({ length: 24 }).map((_, h) => (
                <View
                  key={h}
                  style={[styles.hourLine, { top: h * HOUR_HEIGHT }]}
                  pointerEvents="none"
                />
              ))}

              {showNow && nowMinutes != null && dayColumnWidth > 0 ? (
                <View
                  style={[
                    styles.nowLine,
                    {
                      top: Math.max(0, nowMinutes * PX_PER_MINUTE),
                      left: todayIndex * dayColumnWidth,
                      width: dayColumnWidth,
                    },
                  ]}
                  pointerEvents="none"
                />
              ) : null}

              <View style={styles.eventsOverlay} pointerEvents="box-none">
                {dayColumnWidth > 0
                  ? timedBlocks.map((b) => {
                      const top = Math.max(0, b.startMinutes * PX_PER_MINUTE);
                      const height = Math.max(
                        MIN_EVENT_HEIGHT,
                        (b.endMinutes - b.startMinutes) * PX_PER_MINUTE,
                      );

                      const dayLeft = b.dayIndex * dayColumnWidth;
                      const columnWidth = dayColumnWidth / b.columnCount;
                      const left = dayLeft + b.column * columnWidth + EVENT_HORIZONTAL_GAP;
                      const width = Math.max(
                        0,
                        columnWidth - EVENT_HORIZONTAL_GAP * 2,
                      );

                      return (
                        <Pressable
                          key={`${b.dayIndex}:${b.id}:${b.startMinutes}`}
                          style={[styles.eventBlock, { top, left, width, height }]}
                          onPress={() => onPressEvent(b.id)}
                        >
                          <Text style={styles.eventTitle} numberOfLines={1}>
                            {b.title}
                          </Text>
                          <Text style={styles.eventTime} numberOfLines={1}>
                            {formatTime(b.displayStart)} - {formatTime(b.displayEnd)}
                          </Text>
                        </Pressable>
                      );
                    })
                  : null}
              </View>
            </View>
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, gap: 10 },
  allDayRow: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#F9FAFB',
  },
  allDayGrid: { flexDirection: 'row' },
  allDayCell: {
    flex: 1,
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: '#E5E7EB',
    gap: 4,
  },
  selectedDayCell: { backgroundColor: '#EEF2FF' },
  allDayChip: {
    backgroundColor: '#111827',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  allDayChipText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  allDayMore: { fontSize: 11, color: '#6B7280', fontWeight: '700' },
  gridContainer: { flex: 1 },
  scroll: { flex: 1 },
  gridRow: { flexDirection: 'row' },
  timeGutter: {
    width: WEEK_TIME_GUTTER_WIDTH,
    paddingTop: 0,
  },
  hourLabelRow: {
    height: HOUR_HEIGHT,
    alignItems: 'flex-end',
    paddingRight: 6,
    paddingTop: 4,
  },
  hourText: { fontSize: 11, color: '#6B7280', fontWeight: '700' },
  weekGrid: {
    flex: 1,
    height: 24 * HOUR_HEIGHT,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#fff',
    position: 'relative',
  },
  dayColumns: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
  },
  dayColumn: {
    flex: 1,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: '#E5E7EB',
  },
  dayColumnFirst: { borderLeftWidth: 0 },
  selectedDayColumn: { backgroundColor: '#EEF2FF' },
  hourLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
  },
  nowLine: {
    position: 'absolute',
    height: 2,
    backgroundColor: '#EF4444',
  },
  eventsOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  eventBlock: {
    position: 'absolute',
    backgroundColor: '#111827',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    justifyContent: 'center',
  },
  eventTitle: { color: '#fff', fontWeight: '800', fontSize: 11 },
  eventTime: { color: '#E5E7EB', marginTop: 2, fontSize: 10 },
});
