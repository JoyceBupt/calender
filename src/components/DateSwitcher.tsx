import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useCalendar } from '../state/CalendarContext';
import { addDaysISODateLocal, getTodayISODateLocal, parseISODateLocal } from '../utils/date';
import { getLunarInfo } from '../utils/lunar';

export function DateSwitcher() {
  const { selectedDate, setSelectedDate } = useCalendar();

  const lunarText = useMemo(() => {
    const d = parseISODateLocal(selectedDate);
    const info = getLunarInfo(d.getFullYear(), d.getMonth() + 1, d.getDate());
    let text = info.month + info.day;
    if (info.solarTerm) {
      text += ' · ' + info.solarTerm;
    }
    if (info.festival) {
      text += ' · ' + info.festival;
    }
    return text;
  }, [selectedDate]);

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
        <Text style={styles.lunarText}>{lunarText}</Text>
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
  center: { alignItems: 'center', gap: 4 },
  dateText: { fontSize: 16, fontWeight: '600' },
  lunarText: { fontSize: 12, color: '#6B7280' },
  button: {
    backgroundColor: '#111827',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  todayButton: { backgroundColor: '#374151' },
  buttonText: { color: '#fff', fontWeight: '600' },
});

