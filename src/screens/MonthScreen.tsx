import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Calendar, type DateData } from 'react-native-calendars';

import { EventList } from '../components/EventList';
import { listEventsInDateRange } from '../data/eventRepository';
import { useEventsForDate } from '../hooks/useEventsForDate';
import { useCalendar } from '../state/CalendarContext';
import type { RootStackParamList } from '../navigation/types';
import { addDaysISODateLocal, addMonthsISODateLocal, getMonthStartISODateLocal, toISODateLocal } from '../utils/date';

type Navigation = NativeStackNavigationProp<RootStackParamList>;

export function MonthScreen() {
  const navigation = useNavigation<Navigation>();
  const db = useSQLiteContext();
  const { selectedDate, setSelectedDate } = useCalendar();
  const { events, error, loading } = useEventsForDate(selectedDate);
  const [visibleMonthStart, setVisibleMonthStart] = useState(() =>
    getMonthStartISODateLocal(selectedDate),
  );
  const [monthEventDays, setMonthEventDays] = useState<string[]>([]);

  const selectedMonthKey = selectedDate.slice(0, 7);
  useEffect(() => {
    setVisibleMonthStart(getMonthStartISODateLocal(selectedDate));
  }, [selectedMonthKey]);

  useEffect(() => {
    let cancelled = false;

    async function loadMonthMarks() {
      const monthStart = visibleMonthStart;
      const monthEnd = addMonthsISODateLocal(monthStart, 1);
      const monthEvents = await listEventsInDateRange(db, monthStart, monthEnd);

      const days = new Set<string>();
      for (const e of monthEvents) {
        if (e.isAllDay) {
          const start = e.startDate < monthStart ? monthStart : e.startDate;
          const end = e.endDate > monthEnd ? monthEnd : e.endDate;
          for (let d = start; d < end; d = addDaysISODateLocal(d, 1)) {
            days.add(d);
          }
        } else {
          days.add(toISODateLocal(new Date(e.startAt)));
        }
      }

      if (!cancelled) {
        setMonthEventDays(Array.from(days));
      }
    }

    void loadMonthMarks().catch((e) => {
      if (!cancelled) {
        // 标记加载失败不阻塞主要功能
        setMonthEventDays([]);
        console.warn('loadMonthMarks failed', e);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [db, visibleMonthStart]);

  const markedDates = useMemo(() => {
    const result: Record<string, any> = {};
    for (const d of monthEventDays) {
      result[d] = { marked: true, dotColor: '#111827' };
    }
    result[selectedDate] = {
      ...(result[selectedDate] ?? {}),
      selected: true,
      selectedColor: '#111827',
    };
    return result;
  }, [monthEventDays, selectedDate]);

  return (
    <View style={styles.container}>
      <Calendar
        current={selectedDate}
        onDayPress={(day) => setSelectedDate(day.dateString)}
        onMonthChange={(month: DateData) => {
          const monthStart = `${month.year}-${String(month.month).padStart(2, '0')}-01`;
          setVisibleMonthStart(monthStart);
        }}
        markedDates={markedDates}
        enableSwipeMonths
        firstDay={1}
        theme={{
          todayTextColor: '#111827',
          arrowColor: '#111827',
          selectedDayBackgroundColor: '#111827',
        }}
      />

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
