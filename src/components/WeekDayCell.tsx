import type { DateData } from 'react-native-calendars';
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { getTodayISODateLocal, parseISODateLocal } from '../utils/date';
import { getLunarDayText, isSpecialLunarDay } from '../utils/lunar';

type Props = {
  date?: DateData;
  state?: string;
  marking?: any;
  onPress?: (date: DateData) => void;
  onLongPress?: (date: DateData) => void;
  children?: React.ReactNode;
};

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function WeekDayCell(props: Props) {
  const { date, state, marking, onPress, onLongPress } = props;
  if (!date?.dateString) return null;

  const weekday = parseISODateLocal(date.dateString).getDay();
  const weekdayLabel = WEEKDAY_LABELS[weekday] ?? '';

  const selected = !!marking?.selected;
  const disabled = state === 'disabled' || !!marking?.disabled || !!marking?.disableTouchEvent;
  const isToday = date.dateString === getTodayISODateLocal();
  const marked = !!marking?.marked;

  const bg = selected ? (marking?.selectedColor ?? '#111827') : 'transparent';
  const textColor = selected ? '#fff' : disabled ? '#9CA3AF' : '#111827';
  const subColor = selected ? '#E5E7EB' : disabled ? '#D1D5DB' : '#6B7280';

  const lunarText = useMemo(
    () => getLunarDayText(date.year, date.month, date.day),
    [date.year, date.month, date.day],
  );

  const isSpecial = useMemo(
    () => isSpecialLunarDay(date.year, date.month, date.day),
    [date.year, date.month, date.day],
  );

  const lunarColor = selected
    ? 'rgba(255, 255, 255, 0.8)'
    : isSpecial
      ? '#DC2626'
      : subColor;

  return (
    <Pressable
      style={[styles.container, { backgroundColor: bg }, isToday ? styles.today : null]}
      disabled={disabled}
      onPress={() => onPress?.(date)}
      onLongPress={() => onLongPress?.(date)}
    >
      <Text style={[styles.weekday, { color: subColor }]}>{weekdayLabel}</Text>
      <Text style={[styles.day, { color: textColor }]}>{date.day}</Text>
      <Text style={[styles.lunar, { color: lunarColor }]} numberOfLines={1}>
        {lunarText}
      </Text>
      <View style={styles.dotRow}>
        {marked ? (
          <View
            style={[
              styles.dot,
              { backgroundColor: selected ? '#fff' : (marking?.dotColor ?? '#111827') },
            ]}
          />
        ) : (
          <View style={styles.dotPlaceholder} />
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginHorizontal: 2,
    paddingVertical: 6,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  today: {
    borderWidth: 1,
    borderColor: '#111827',
  },
  weekday: {
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 2,
  },
  day: {
    fontSize: 15,
    fontWeight: '900',
    lineHeight: 18,
  },
  lunar: {
    fontSize: 9,
    marginTop: 1,
  },
  dotRow: { marginTop: 2, height: 8, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 5, height: 5, borderRadius: 99 },
  dotPlaceholder: { width: 5, height: 5 },
});
