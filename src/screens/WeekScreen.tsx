import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useIsFocused, useNavigation } from '@react-navigation/native';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { WeekTimeline } from '../components/WeekTimeline';
import { listEventsInDateRange } from '../data/eventRepository';
import type { CalendarEvent } from '../domain/event';
import type { RootStackParamList } from '../navigation/types';
import { useCalendar } from '../state/CalendarContext';
import {
  addDaysISODateLocal,
  getTodayISODateLocal,
  getWeekStartISODateLocal,
  parseISODateLocal,
  toISODateLocal,
} from '../utils/date';
import { getLunarDayText, isSpecialLunarDay } from '../utils/lunar';

type Navigation = NativeStackNavigationProp<RootStackParamList>;

const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日'];

export function WeekScreen() {
  const navigation = useNavigation<Navigation>();
  const db = useSQLiteContext();
  const isFocused = useIsFocused();
  const { selectedDate, setSelectedDate } = useCalendar();
  const [weekEventDays, setWeekEventDays] = useState<string[]>([]);
  const [weekEvents, setWeekEvents] = useState<CalendarEvent[]>([]);
  const [error, setError] = useState<string | null>(null);

  const weekStart = useMemo(
    () => getWeekStartISODateLocal(selectedDate, 1),
    [selectedDate],
  );
  const weekEnd = useMemo(() => addDaysISODateLocal(weekStart, 7), [weekStart]);

  // 生成本周 7 天的日期
  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => addDaysISODateLocal(weekStart, i));
  }, [weekStart]);

  const today = getTodayISODateLocal();

  useEffect(() => {
    let cancelled = false;

    async function loadWeekMarks() {
      setError(null);

      const weekEvents = await listEventsInDateRange(db, weekStart, weekEnd);
      const days = new Set<string>();
      for (const e of weekEvents) {
        if (e.isAllDay) {
          const start = e.startDate < weekStart ? weekStart : e.startDate;
          const end = e.endDate > weekEnd ? weekEnd : e.endDate;
          for (let d = start; d < end; d = addDaysISODateLocal(d, 1)) {
            days.add(d);
          }
        } else {
          const rangeStart = parseISODateLocal(weekStart);
          const rangeEnd = parseISODateLocal(weekEnd);
          const eventStart = new Date(e.startAt);
          const eventEnd = new Date(e.endAt);
          const startMs = Math.max(eventStart.getTime(), rangeStart.getTime());
          const endMs = Math.min(eventEnd.getTime(), rangeEnd.getTime());
          if (endMs > startMs) {
            const startDay = toISODateLocal(new Date(startMs));
            const lastMoment = new Date(endMs - 1);
            const endDay = toISODateLocal(lastMoment);
            for (let d = startDay; d <= endDay; d = addDaysISODateLocal(d, 1)) {
              if (d >= weekStart && d < weekEnd) days.add(d);
            }
          }
        }
      }
      if (!cancelled) {
        setWeekEvents(weekEvents);
        setWeekEventDays(Array.from(days));
      }
    }

    void loadWeekMarks().catch((e) => {
      if (!cancelled) {
        setWeekEvents([]);
        setWeekEventDays([]);
        setError(e instanceof Error ? e.message : String(e));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [db, weekEnd, weekStart, isFocused]);

  const goToPrevWeek = () => {
    setSelectedDate(addDaysISODateLocal(selectedDate, -7));
  };

  const goToNextWeek = () => {
    setSelectedDate(addDaysISODateLocal(selectedDate, 7));
  };

  // 周范围显示文本
  const weekRangeText = useMemo(() => {
    const start = weekDays[0];
    const end = weekDays[6];
    const [sy, sm, sd] = start.split('-').map(Number);
    const [ey, em, ed] = end.split('-').map(Number);
    if (sy === ey && sm === em) {
      return `${sy}年${sm}月${sd}日 - ${ed}日`;
    }
    if (sy === ey) {
      return `${sy}年${sm}月${sd}日 - ${em}月${ed}日`;
    }
    return `${sy}年${sm}月${sd}日 - ${ey}年${em}月${ed}日`;
  }, [weekDays]);

  return (
    <View style={styles.container}>
      {/* 周导航 */}
      <View style={styles.weekNavRow}>
        <Pressable style={styles.navButton} onPress={goToPrevWeek}>
          <Text style={styles.navButtonText}>‹</Text>
        </Pressable>
        <Text style={styles.weekRangeText}>{weekRangeText}</Text>
        <Pressable style={styles.navButton} onPress={goToNextWeek}>
          <Text style={styles.navButtonText}>›</Text>
        </Pressable>
      </View>

      {/* 自定义周头部 */}
      <View style={styles.weekHeaderRow}>
        <View style={{ width: 36 }} />
        <View style={styles.weekDaysContainer}>
          {weekDays.map((isoDate, index) => {
            const [year, month, day] = isoDate.split('-').map(Number);
            const isSelected = isoDate === selectedDate;
            const isToday = isoDate === today;
            const hasEvent = weekEventDays.includes(isoDate);
            const lunarText = getLunarDayText(year, month, day);
            const isSpecial = isSpecialLunarDay(year, month, day);

            return (
              <Pressable
                key={isoDate}
                style={[
                  styles.dayCell,
                  isSelected && styles.dayCellSelected,
                  isToday && !isSelected && styles.dayCellToday,
                ]}
                onPress={() => setSelectedDate(isoDate)}
              >
                <Text style={[styles.weekdayLabel, isSelected && styles.textSelected]}>
                  {WEEKDAY_LABELS[index]}
                </Text>
                <Text style={[styles.dayNumber, isSelected && styles.textSelected]}>
                  {day}
                </Text>
                <Text
                  style={[
                    styles.lunarText,
                    isSpecial && styles.lunarSpecial,
                    isSelected && styles.lunarSelected,
                  ]}
                  numberOfLines={1}
                >
                  {lunarText}
                </Text>
                {hasEvent && !isSelected && <View style={styles.dot} />}
              </Pressable>
            );
          })}
        </View>
      </View>

      <Pressable
        style={styles.primaryButton}
        onPress={() =>
          navigation.navigate('EventEditor', { initialDate: selectedDate })
        }
      >
        <Text style={styles.primaryButtonText}>新建日程</Text>
      </Pressable>

      {error ? <Text style={styles.errorText}>加载失败：{error}</Text> : null}
      <WeekTimeline
        weekStart={weekStart}
        selectedDate={selectedDate}
        events={weekEvents}
        onSelectDate={setSelectedDate}
        onPressEvent={(eventId) => navigation.navigate('EventDetail', { eventId })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12 },
  weekHeaderRow: { flexDirection: 'row' },
  weekDaysContainer: { flex: 1, flexDirection: 'row' },
  dayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 10,
  },
  dayCellSelected: {
    backgroundColor: '#111827',
  },
  dayCellToday: {
    borderWidth: 1,
    borderColor: '#111827',
  },
  weekdayLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 2,
  },
  dayNumber: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  lunarText: {
    fontSize: 9,
    color: '#6B7280',
    marginTop: 2,
  },
  lunarSpecial: {
    color: '#DC2626',
  },
  lunarSelected: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  textSelected: {
    color: '#fff',
  },
  dot: {
    position: 'absolute',
    bottom: 4,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#111827',
  },
  errorText: { fontSize: 14, color: '#B91C1C' },
  primaryButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#111827',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  primaryButtonText: { color: '#fff', fontWeight: '600' },
});
