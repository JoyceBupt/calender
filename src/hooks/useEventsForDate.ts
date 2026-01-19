import { useIsFocused } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';

import type { CalendarEvent } from '../domain/event';
import type { SubscriptionEvent } from '../domain/subscription';
import { listEventsForDate } from '../data/eventRepository';
import { listSubscriptionEventsInDateRange } from '../data/subscriptionRepository';
import { addDaysISODateLocal } from '../utils/date';

export type EventWithSource =
  | (CalendarEvent & { source: 'local' })
  | (SubscriptionEvent & { source: 'subscription'; color: string });

export function useEventsForDate(isoDate: string) {
  const db = useSQLiteContext();
  const isFocused = useIsFocused();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [subscriptionEvents, setSubscriptionEvents] = useState<
    (SubscriptionEvent & { color: string })[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const nextDay = addDaysISODateLocal(isoDate, 1);
        const [localEvents, subEvents] = await Promise.all([
          listEventsForDate(db, isoDate),
          listSubscriptionEventsInDateRange(db, isoDate, nextDay),
        ]);
        if (!cancelled) {
          setEvents(localEvents);
          setSubscriptionEvents(subEvents);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    if (isFocused) {
      void load();
    }

    return () => {
      cancelled = true;
    };
  }, [db, isoDate, isFocused]);

  return { events, subscriptionEvents, loading, error };
}

