import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { CalendarEvent } from '../domain/event';
import type { SubscriptionEvent } from '../domain/subscription';
import { addDaysISODateLocal } from '../utils/date';

function formatTime(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function getEventTimeLabel(
  event: CalendarEvent | SubscriptionEvent,
): string {
  if (event.isAllDay) {
    const endInclusive = addDaysISODateLocal(event.endDate, -1);
    if (event.startDate === endInclusive) return '全天';
    return `全天 ${event.startDate} ~ ${endInclusive}`;
  }
  return `${formatTime(event.startAt)} - ${formatTime(event.endAt)}`;
}

export function EventList({
  events,
  subscriptionEvents = [],
  onPressEvent,
}: {
  events: CalendarEvent[];
  subscriptionEvents?: (SubscriptionEvent & { color: string })[];
  onPressEvent: (eventId: string) => void;
}) {
  const hasEvents = events.length > 0 || subscriptionEvents.length > 0;

  if (!hasEvents) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>当天暂无日程</Text>
      </View>
    );
  }

  return (
    <View style={styles.list}>
      {events.map((event) => (
        <Pressable
          key={event.id}
          style={styles.item}
          onPress={() => onPressEvent(event.id)}
        >
          <Text style={styles.itemTitle} numberOfLines={1}>
            {event.title}
          </Text>
          <Text style={styles.itemSubtitle} numberOfLines={1}>
            {getEventTimeLabel(event)}
          </Text>
        </Pressable>
      ))}

      {subscriptionEvents.map((event) => (
        <View
          key={event.id}
          style={[styles.item, { borderLeftWidth: 3, borderLeftColor: event.color }]}
        >
          <Text style={styles.itemTitle} numberOfLines={1}>
            {event.title}
          </Text>
          <Text style={styles.itemSubtitle} numberOfLines={1}>
            {getEventTimeLabel(event)} · 订阅
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 10 },
  item: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  itemTitle: { fontSize: 16, fontWeight: '600', color: '#111827' },
  itemSubtitle: { marginTop: 4, fontSize: 13, color: '#4B5563' },
  empty: {
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  emptyText: { color: '#6B7280' },
});
