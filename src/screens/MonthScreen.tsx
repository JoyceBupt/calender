import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Calendar, type DateData } from 'react-native-calendars';

import { EventList } from '../components/EventList';
import { LunarDayCell } from '../components/LunarDayCell';
import { listEventsInDateRange } from '../data/eventRepository';
import { exportEventsToICS, importEventsFromICS } from '../services/icalService';
import { useEventsForDate } from '../hooks/useEventsForDate';
import { useCalendar } from '../state/CalendarContext';
import type { RootStackParamList } from '../navigation/types';
import {
  addDaysISODateLocal,
  addMonthsISODateLocal,
  getMonthStartISODateLocal,
  parseISODateLocal,
  toISODateLocal,
} from '../utils/date';

type Navigation = NativeStackNavigationProp<RootStackParamList>;

export function MonthScreen() {
  const navigation = useNavigation<Navigation>();
  const db = useSQLiteContext();
  const { selectedDate, setSelectedDate } = useCalendar();
  const { events, subscriptionEvents, error, loading } = useEventsForDate(selectedDate);
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
          const rangeStart = parseISODateLocal(monthStart);
          const rangeEnd = parseISODateLocal(monthEnd);
          const eventStart = new Date(e.startAt);
          const eventEnd = new Date(e.endAt);
          const startMs = Math.max(eventStart.getTime(), rangeStart.getTime());
          const endMs = Math.min(eventEnd.getTime(), rangeEnd.getTime());
          if (endMs > startMs) {
            const startDay = toISODateLocal(new Date(startMs));
            const lastMoment = new Date(endMs - 1);
            const endDay = toISODateLocal(lastMoment);
            for (let d = startDay; d <= endDay; d = addDaysISODateLocal(d, 1)) {
              days.add(d);
            }
          }
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

  const renderDayComponent = useCallback(
    (props: any) => (
      <LunarDayCell
        date={props.date}
        state={props.state}
        marking={props.marking}
        onPress={(date) => setSelectedDate(date.dateString)}
      />
    ),
    [setSelectedDate],
  );

  const handleExport = useCallback(async () => {
    try {
      await exportEventsToICS(db);
    } catch (e: any) {
      Alert.alert('导出失败', e.message || '未知错误');
    }
  }, [db]);

  const handleImport = useCallback(async () => {
    try {
      const count = await importEventsFromICS(db);
      if (count > 0) {
        Alert.alert('导入成功', `成功导入 ${count} 个日程`);
        // 刷新月视图标记
        setVisibleMonthStart((prev) => prev);
      }
    } catch (e: any) {
      Alert.alert('导入失败', e.message || '未知错误');
    }
  }, [db]);

  return (
    <View style={styles.container}>
      <View style={styles.actionRow}>
        <Pressable
          style={styles.secondaryButton}
          onPress={() => navigation.navigate('Subscriptions')}
        >
          <Text style={styles.secondaryButtonText}>订阅</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={handleImport}>
          <Text style={styles.secondaryButtonText}>导入</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={handleExport}>
          <Text style={styles.secondaryButtonText}>导出</Text>
        </Pressable>
      </View>

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
        dayComponent={renderDayComponent}
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
        subscriptionEvents={subscriptionEvents}
        onPressEvent={(eventId) => navigation.navigate('EventDetail', { eventId })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12 },
  actionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
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
  secondaryButton: {
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  secondaryButtonText: { color: '#374151', fontWeight: '600', fontSize: 13 },
});
