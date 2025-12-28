import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useCalendar } from '../state/CalendarContext';
import { addDaysISODateLocal, getTodayISODateLocal } from '../utils/date';

export function DateSwitcher() {
  const { selectedDate, setSelectedDate } = useCalendar();

  return (
    <View style={styles.container}>
      <Pressable
        style={styles.button}
        onPress={() => setSelectedDate(addDaysISODateLocal(selectedDate, -1))}
      >
        <Text style={styles.buttonText}>上一天</Text>
      </Pressable>

      <View style={styles.center}>
        <Text style={styles.dateText}>{selectedDate}</Text>
        <Pressable
          style={[styles.button, styles.todayButton]}
          onPress={() => setSelectedDate(getTodayISODateLocal())}
        >
          <Text style={styles.buttonText}>今天</Text>
        </Pressable>
      </View>

      <Pressable
        style={styles.button}
        onPress={() => setSelectedDate(addDaysISODateLocal(selectedDate, 1))}
      >
        <Text style={styles.buttonText}>下一天</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  center: { alignItems: 'center', gap: 6 },
  dateText: { fontSize: 16, fontWeight: '600' },
  button: {
    backgroundColor: '#111827',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  todayButton: { backgroundColor: '#374151' },
  buttonText: { color: '#fff', fontWeight: '600' },
});

