import { useIsFocused } from '@react-navigation/native';
import { useEffect, useState } from 'react';
import { useSQLiteContext } from 'expo-sqlite';

import type { CalendarEvent } from '../domain/event';
import { listEventsForDate } from '../data/eventRepository';

export function useEventsForDate(isoDate: string) {
  const db = useSQLiteContext();
  const isFocused = useIsFocused();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const result = await listEventsForDate(db, isoDate);
        if (!cancelled) {
          setEvents(result);
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

  return { events, loading, error };
}

