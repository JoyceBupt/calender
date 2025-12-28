import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { DateSwitcher } from '../components/DateSwitcher';
import { EventList } from '../components/EventList';
import { useEventsForDate } from '../hooks/useEventsForDate';
import type { RootStackParamList } from '../navigation/types';
import { useCalendar } from '../state/CalendarContext';

type Navigation = NativeStackNavigationProp<RootStackParamList>;

export function DayScreen() {
  const navigation = useNavigation<Navigation>();
  const { selectedDate } = useCalendar();
  const { events, error, loading } = useEventsForDate(selectedDate);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>日视图</Text>
      <DateSwitcher />

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
  title: { fontSize: 18, fontWeight: '600' },
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
