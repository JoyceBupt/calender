import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CalendarProvider, WeekCalendar } from 'react-native-calendars';

import { EventList } from '../components/EventList';
import { listEventsInDateRange } from '../data/eventRepository';
import { useEventsForDate } from '../hooks/useEventsForDate';
import type { RootStackParamList } from '../navigation/types';
import { useCalendar } from '../state/CalendarContext';
import {
  addDaysISODateLocal,
  getWeekStartISODateLocal,
  parseISODateLocal,
  toISODateLocal,
} from '../utils/date';

type Navigation = NativeStackNavigationProp<RootStackParamList>;

export function WeekScreen() {
  const navigation = useNavigation<Navigation>();
  const db = useSQLiteContext();
  const { selectedDate, setSelectedDate } = useCalendar();
  const { events, error, loading } = useEventsForDate(selectedDate);
  const [weekEventDays, setWeekEventDays] = useState<string[]>([]);

  const weekStart = useMemo(
    () => getWeekStartISODateLocal(selectedDate, 1),
    [selectedDate],
  );
  const weekEnd = useMemo(() => addDaysISODateLocal(weekStart, 7), [weekStart]);

  useEffect(() => {
    let cancelled = false;

    async function loadWeekMarks() {
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
      if (!cancelled) setWeekEventDays(Array.from(days));
    }

    void loadWeekMarks().catch((e) => {
      if (!cancelled) {
        setWeekEventDays([]);
        console.warn('loadWeekMarks failed', e);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [db, weekEnd, weekStart]);

  const markedDates = useMemo(() => {
    const result: Record<string, any> = {};
    for (const d of weekEventDays) {
      result[d] = { marked: true, dotColor: '#111827' };
    }
    result[selectedDate] = {
      ...(result[selectedDate] ?? {}),
      selected: true,
      selectedColor: '#111827',
    };
    return result;
  }, [selectedDate, weekEventDays]);

  return (
    <View style={styles.container}>
      <CalendarProvider
        date={selectedDate}
        onDateChanged={(date) => setSelectedDate(date)}
      >
        <WeekCalendar
          firstDay={1}
          markedDates={markedDates}
          theme={{
            todayTextColor: '#111827',
            selectedDayBackgroundColor: '#111827',
          }}
        />
      </CalendarProvider>

      <Pressable
        style={styles.primaryButton}
        onPress={() =>
          navigation.navigate('EventEditor', { initialDate: selectedDate })
        }
      >
        <Text style={styles.primaryButtonText}>新建日程</Text>
      </Pressable>

      {error ? <Text style={styles.errorText}>加载失败：{error}</Text> : null}
      {loading ? <Text style={styles.subtitle}>加载中...</Text> : null}
      <EventList
        events={events}
        onPressEvent={(eventId) => navigation.navigate('EventDetail', { eventId })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12 },
  subtitle: { fontSize: 14, color: '#555' },
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
