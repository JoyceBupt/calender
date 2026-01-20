import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { deleteEvent, getEventById } from '../data/eventRepository';
import { listRemindersByEventId } from '../data/reminderRepository';
import { getSubscriptionEventDetailById } from '../data/subscriptionRepository';
import type { CalendarEvent } from '../domain/event';
import type { SubscriptionEvent } from '../domain/subscription';
import type { RootStackParamList } from '../navigation/types';
import { cancelRemindersForEvent } from '../notifications/reminderService';
import { exportSingleEventToICS } from '../services/icalService';
import { addDaysISODateLocal } from '../utils/date';

type EventDetailRoute = RouteProp<RootStackParamList, 'EventDetail'>;
type Navigation = NativeStackNavigationProp<RootStackParamList>;

function formatEventTime(event: CalendarEvent | SubscriptionEvent): string {
  if (event.isAllDay) {
    const endInclusive = addDaysISODateLocal(event.endDate, -1);
    if (event.startDate === endInclusive) return `全天 · ${event.startDate}`;
    return `全天 · ${event.startDate} ~ ${endInclusive}`;
  }

  const start = new Date(event.startAt);
  const end = new Date(event.endAt);
  return `${start.toLocaleString()} ~ ${end.toLocaleString()}`;
}

type LoadedEvent =
  | {
      source: 'local';
      event: CalendarEvent;
      reminderMinutes: number[];
    }
  | {
      source: 'subscription';
      event: SubscriptionEvent;
      color: string;
      subscriptionName: string;
      subscriptionUrl: string;
    };

export function EventDetailScreen() {
  const route = useRoute<EventDetailRoute>();
  const navigation = useNavigation<Navigation>();
  const db = useSQLiteContext();
  const source = route.params.source ?? 'local';
  const [loaded, setLoaded] = useState<LoadedEvent | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const eventId = route.params.eventId;

        if (source === 'subscription') {
          const found = await getSubscriptionEventDetailById(db, eventId);
          if (!cancelled) {
            setLoaded(
              found
                ? {
                    source: 'subscription',
                    event: found,
                    color: found.color,
                    subscriptionName: found.subscriptionName,
                    subscriptionUrl: found.subscriptionUrl,
                  }
                : null,
            );
          }
          return;
        }

        const [found, reminders] = await Promise.all([
          getEventById(db, eventId),
          listRemindersByEventId(db, eventId),
        ]);
        if (!cancelled) {
          setLoaded(
            found
              ? {
                  source: 'local',
                  event: found,
                  reminderMinutes: reminders.map((r) => r.minutes_before),
                }
              : null,
          );
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
  }, [db, route.params.eventId, source]);

  return (
    <View style={styles.container}>
      {loading ? <Text style={styles.hint}>加载中...</Text> : null}

      {loaded ? (
        <>
          <Text style={styles.title}>{loaded.event.title}</Text>
          <Text style={styles.subtitle}>{formatEventTime(loaded.event)}</Text>

          {loaded.source === 'subscription' ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>来源</Text>
              <Text style={styles.sectionText}>
                {loaded.subscriptionName}
              </Text>
              <Text style={styles.sectionHint} numberOfLines={1}>
                {loaded.subscriptionUrl}
              </Text>
            </View>
          ) : null}

          {loaded.event.location ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>地点</Text>
              <Text style={styles.sectionText}>{loaded.event.location}</Text>
            </View>
          ) : null}

          {loaded.event.notes ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>备注</Text>
              <Text style={styles.sectionText}>{loaded.event.notes}</Text>
            </View>
          ) : null}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>提醒</Text>
            <Text style={styles.sectionText}>
              {loaded.source === 'subscription'
                ? '无（订阅事件不支持提醒）'
                : loaded.reminderMinutes.length === 0
                  ? '无'
                  : loaded.reminderMinutes
                      .map((m) => (m === 0 ? '准时' : `提前 ${m} 分钟`))
                      .join('、')}
            </Text>
          </View>

          <View style={styles.actions}>
            {loaded.source === 'local' ? (
              <Pressable
                style={[styles.button, styles.secondaryButton]}
                onPress={() =>
                  navigation.navigate('EventEditor', { eventId: loaded.event.id })
                }
              >
                <Text style={styles.secondaryButtonText}>编辑</Text>
              </Pressable>
            ) : null}

            <Pressable
              style={[styles.button, styles.shareButton]}
              onPress={async () => {
                try {
                  const now = new Date().toISOString();
                  const shareEvent: CalendarEvent =
                    loaded.source === 'local'
                      ? loaded.event
                      : loaded.event.isAllDay
                        ? {
                            id: loaded.event.id,
                            title: loaded.event.title,
                            notes: loaded.event.notes,
                            location: loaded.event.location,
                            timezone: null,
                            createdAt: now,
                            updatedAt: now,
                            isAllDay: true,
                            startDate: loaded.event.startDate,
                            endDate: loaded.event.endDate,
                          }
                        : {
                            id: loaded.event.id,
                            title: loaded.event.title,
                            notes: loaded.event.notes,
                            location: loaded.event.location,
                            timezone: null,
                            createdAt: now,
                            updatedAt: now,
                            isAllDay: false,
                            startAt: loaded.event.startAt,
                            endAt: loaded.event.endAt,
                          };

                  await exportSingleEventToICS(shareEvent);
                } catch (e: any) {
                  Alert.alert('分享失败', e.message || '未知错误');
                }
              }}
            >
              <Text style={styles.shareButtonText}>分享</Text>
            </Pressable>

            {loaded.source === 'local' ? (
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
                          await cancelRemindersForEvent(db, loaded.event.id);
                          await deleteEvent(db, loaded.event.id);
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
            ) : null}
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
  sectionHint: { fontSize: 12, color: '#6B7280' },
  actions: { marginTop: 12, flexDirection: 'row', gap: 10 },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  secondaryButton: { backgroundColor: '#111827' },
  secondaryButtonText: { color: '#fff', fontWeight: '700' },
  shareButton: { backgroundColor: '#E0E7FF' },
  shareButtonText: { color: '#3730A3', fontWeight: '700' },
  dangerButton: { backgroundColor: '#FEE2E2' },
  dangerButtonText: { color: '#991B1B', fontWeight: '800' },
});
