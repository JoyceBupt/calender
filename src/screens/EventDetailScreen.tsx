import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { deleteEvent, getEventById } from '../data/eventRepository';
import { listRemindersByEventId } from '../data/reminderRepository';
import type { CalendarEvent } from '../domain/event';
import type { RootStackParamList } from '../navigation/types';
import { cancelRemindersForEvent } from '../notifications/reminderService';
import { addDaysISODateLocal } from '../utils/date';

type EventDetailRoute = RouteProp<RootStackParamList, 'EventDetail'>;
type Navigation = NativeStackNavigationProp<RootStackParamList>;

function formatEventTime(event: CalendarEvent): string {
  if (event.isAllDay) {
    const endInclusive = addDaysISODateLocal(event.endDate, -1);
    if (event.startDate === endInclusive) return `全天 · ${event.startDate}`;
    return `全天 · ${event.startDate} ~ ${endInclusive}`;
  }

  const start = new Date(event.startAt);
  const end = new Date(event.endAt);
  return `${start.toLocaleString()} ~ ${end.toLocaleString()}`;
}

export function EventDetailScreen() {
  const route = useRoute<EventDetailRoute>();
  const navigation = useNavigation<Navigation>();
  const db = useSQLiteContext();
  const [event, setEvent] = useState<CalendarEvent | null>(null);
  const [reminderMinutes, setReminderMinutes] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const [found, reminders] = await Promise.all([
          getEventById(db, route.params.eventId),
          listRemindersByEventId(db, route.params.eventId),
        ]);
        if (!cancelled) {
          setEvent(found);
          setReminderMinutes(reminders[0]?.minutes_before ?? null);
        }
      } catch (e) {
        if (!cancelled) {
          Alert.alert('加载失败', e instanceof Error ? e.message : String(e));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [db, route.params.eventId]);

  return (
    <View style={styles.container}>
      {loading ? <Text style={styles.hint}>加载中...</Text> : null}

      {event ? (
        <>
          <Text style={styles.title}>{event.title}</Text>
          <Text style={styles.subtitle}>{formatEventTime(event)}</Text>

          {event.location ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>地点</Text>
              <Text style={styles.sectionText}>{event.location}</Text>
            </View>
          ) : null}

          {event.notes ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>备注</Text>
              <Text style={styles.sectionText}>{event.notes}</Text>
            </View>
          ) : null}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>提醒</Text>
            <Text style={styles.sectionText}>
              {reminderMinutes == null
                ? '无'
                : reminderMinutes === 0
                  ? '准时'
                  : `提前 ${reminderMinutes} 分钟`}
            </Text>
          </View>

          <View style={styles.actions}>
            <Pressable
              style={[styles.button, styles.secondaryButton]}
              onPress={() =>
                navigation.navigate('EventEditor', { eventId: event.id })
              }
            >
              <Text style={styles.secondaryButtonText}>编辑</Text>
            </Pressable>

            <Pressable
              style={[styles.button, styles.dangerButton]}
              onPress={() => {
                Alert.alert('删除日程', '确定要删除这个日程吗？', [
                  { text: '取消', style: 'cancel' },
                  {
                    text: '删除',
                    style: 'destructive',
                    onPress: async () => {
                      try {
                        await cancelRemindersForEvent(db, event.id);
                        await deleteEvent(db, event.id);
                        navigation.goBack();
                      } catch (e) {
                        Alert.alert(
                          '删除失败',
                          e instanceof Error ? e.message : String(e),
                        );
                      }
                    },
                  },
                ]);
              }}
            >
              <Text style={styles.dangerButtonText}>删除</Text>
            </Pressable>
          </View>
        </>
      ) : (
        <Text style={styles.subtitle}>未找到该日程</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 10 },
  hint: { color: '#6B7280' },
  title: { fontSize: 22, fontWeight: '800', color: '#111827' },
  subtitle: { fontSize: 14, color: '#555' },
  section: {
    marginTop: 8,
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 12,
    gap: 6,
  },
  sectionTitle: { fontSize: 12, color: '#6B7280', fontWeight: '700' },
  sectionText: { fontSize: 15, color: '#111827' },
  actions: { marginTop: 12, flexDirection: 'row', gap: 10 },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  secondaryButton: { backgroundColor: '#111827' },
  secondaryButtonText: { color: '#fff', fontWeight: '700' },
  dangerButton: { backgroundColor: '#FEE2E2' },
  dangerButtonText: { color: '#991B1B', fontWeight: '800' },
});
