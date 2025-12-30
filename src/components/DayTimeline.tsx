import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type { CalendarEvent } from '../domain/event';
import {
  addDaysISODateLocal,
  getTodayISODateLocal,
  parseISODateLocal,
} from '../utils/date';

const HOUR_HEIGHT = 60;
const PX_PER_MINUTE = HOUR_HEIGHT / 60;
const TIME_GUTTER_WIDTH = 56;
const EVENT_SIDE_PADDING = 8;
const MIN_EVENT_HEIGHT = 18;

type TimedBlock = {
  id: string;
  title: string;
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

function clampTimedEventsToDay(
  isoDate: string,
  events: CalendarEvent[],
): { allDay: CalendarEvent[]; timed: TimedBlock[] } {
  const dayStart = parseISODateLocal(isoDate);
  const dayEnd = parseISODateLocal(addDaysISODateLocal(isoDate, 1));

  const allDay = events.filter((e) => e.isAllDay);
  const timedRaw = events
    .filter((e) => !e.isAllDay)
    .map((e) => {
      const start = new Date(e.startAt);
      const end = new Date(e.endAt);
      const startMs = Math.max(start.getTime(), dayStart.getTime());
      const endMs = Math.min(end.getTime(), dayEnd.getTime());
      return {
        id: e.id,
        title: e.title,
        startMs,
        endMs,
      };
    })
    .filter((e) => e.endMs > e.startMs)
    .map((e) => {
      const displayStart = new Date(e.startMs);
      const displayEnd = new Date(e.endMs);
      const startMinutes = (e.startMs - dayStart.getTime()) / 60000;
      const endMinutes = (e.endMs - dayStart.getTime()) / 60000;
      return {
        id: e.id,
        title: e.title,
        startMinutes,
        endMinutes,
        column: 0,
        columnCount: 1,
        displayStart,
        displayEnd,
      } satisfies TimedBlock;
    });

  return { allDay, timed: layoutTimedBlocks(timedRaw) };
}

function layoutTimedBlocks(blocks: TimedBlock[]): TimedBlock[] {
  const sorted = [...blocks].sort((a, b) => {
    if (a.startMinutes !== b.startMinutes) return a.startMinutes - b.startMinutes;
    return b.endMinutes - a.endMinutes;
  });

  const clusters: TimedBlock[][] = [];
  let current: TimedBlock[] = [];
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

    for (const block of cluster) {
      let column = columnEnds.findIndex((end) => end <= block.startMinutes);
      if (column === -1) {
        column = columnEnds.length;
        columnEnds.push(block.endMinutes);
      } else {
        columnEnds[column] = block.endMinutes;
      }
      maxColumns = Math.max(maxColumns, columnEnds.length);
      result.push({ ...block, column, columnCount: 1 });
    }

    // 为该 cluster 内的所有事件补齐 columnCount
    for (let i = result.length - cluster.length; i < result.length; i++) {
      result[i] = { ...result[i], columnCount: maxColumns };
    }
  }

  return result;
}

export function DayTimeline({
  isoDate,
  events,
  onPressEvent,
}: {
  isoDate: string;
  events: CalendarEvent[];
  onPressEvent: (eventId: string) => void;
}) {
  const scrollRef = useRef<ScrollView>(null);
  const [containerWidth, setContainerWidth] = useState(0);

  const { allDay, timed } = useMemo(
    () => clampTimedEventsToDay(isoDate, events),
    [events, isoDate],
  );

  const isToday = isoDate === getTodayISODateLocal();
  const nowMinutes = useMemo(() => {
    if (!isToday) return null;
    const now = new Date();
    const dayStart = parseISODateLocal(isoDate);
    return (now.getTime() - dayStart.getTime()) / 60000;
  }, [isToday, isoDate]);

  const eventAreaWidth = Math.max(
    0,
    containerWidth - TIME_GUTTER_WIDTH - EVENT_SIDE_PADDING * 2,
  );

  useEffect(() => {
    const targetMinutes = isToday ? nowMinutes ?? 8 * 60 : 8 * 60;
    const y = Math.max(0, targetMinutes * PX_PER_MINUTE - 120);
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y, animated: false });
    });
  }, [isToday, nowMinutes, isoDate]);

  return (
    <View
      style={styles.container}
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
    >
      {allDay.length ? (
        <View style={styles.allDaySection}>
          <Text style={styles.allDayTitle}>全天</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.allDayRow}>
              {allDay.map((event) => (
                <Pressable
                  key={event.id}
                  style={styles.allDayChip}
                  onPress={() => onPressEvent(event.id)}
                >
                  <Text style={styles.allDayChipText} numberOfLines={1}>
                    {event.title}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </View>
      ) : null}

      <ScrollView ref={scrollRef} style={styles.scroll}>
        <View style={styles.timeline}>
          {Array.from({ length: 24 }).map((_, h) => (
            <View key={h} style={styles.hourRow}>
              <Text style={styles.hourText}>{String(h).padStart(2, '0')}:00</Text>
              <View style={styles.hourDivider} />
            </View>
          ))}

          {/* Overlay: now line + timed events */}
          <View style={styles.overlay} pointerEvents="box-none">
            {isToday && nowMinutes != null ? (
              <View
                style={[
                  styles.nowLine,
                  { top: Math.max(0, nowMinutes * PX_PER_MINUTE) },
                ]}
                pointerEvents="none"
              />
            ) : null}

            <View style={styles.eventOverlay} pointerEvents="box-none">
              {timed.map((block) => {
                const top = Math.max(0, block.startMinutes * PX_PER_MINUTE);
                const height = Math.max(
                  MIN_EVENT_HEIGHT,
                  (block.endMinutes - block.startMinutes) * PX_PER_MINUTE,
                );
                const columnWidth = eventAreaWidth / block.columnCount;
                const left = EVENT_SIDE_PADDING + block.column * columnWidth;
                const width = Math.max(0, columnWidth - 6);

                return (
                  <Pressable
                    key={block.id}
                    style={[
                      styles.eventBlock,
                      { top, left, width, height },
                    ]}
                    onPress={() => onPressEvent(block.id)}
                  >
                    <Text style={styles.eventTitle} numberOfLines={1}>
                      {block.title}
                    </Text>
                    <Text style={styles.eventTime} numberOfLines={1}>
                      {formatTime(block.displayStart)} - {formatTime(block.displayEnd)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, gap: 10 },
  scroll: { flex: 1 },
  timeline: {
    height: 24 * HOUR_HEIGHT,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  hourRow: {
    height: HOUR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  hourText: {
    width: TIME_GUTTER_WIDTH,
    paddingTop: 6,
    paddingLeft: 10,
    fontSize: 12,
    color: '#6B7280',
  },
  hourDivider: {
    flex: 1,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: TIME_GUTTER_WIDTH,
    right: 0,
  },
  nowLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#EF4444',
  },
  eventOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  },
  eventBlock: {
    position: 'absolute',
    backgroundColor: '#111827',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    justifyContent: 'center',
  },
  eventTitle: { color: '#fff', fontWeight: '800', fontSize: 13 },
  eventTime: { color: '#E5E7EB', marginTop: 2, fontSize: 11 },
  allDaySection: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    gap: 10,
  },
  allDayTitle: { fontSize: 13, fontWeight: '800', color: '#111827' },
  allDayRow: { flexDirection: 'row', gap: 8 },
  allDayChip: {
    backgroundColor: '#111827',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
    maxWidth: 220,
  },
  allDayChipText: { color: '#fff', fontWeight: '700' },
});
