import { memo, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { DateData } from 'react-native-calendars';
import { getLunarDayText, isSpecialLunarDay } from '../utils/lunar';

interface LunarDayCellProps {
  date?: DateData;
  state?: 'disabled' | 'today' | '';
  marking?: {
    selected?: boolean;
    marked?: boolean;
    dotColor?: string;
  };
  onPress?: (date: DateData) => void;
}

function LunarDayCellInner({ date, state, marking, onPress }: LunarDayCellProps) {
  if (!date) return null;

  const { year, month, day, dateString } = date;
  const isSelected = marking?.selected;
  const isToday = state === 'today';
  const isDisabled = state === 'disabled';
  const hasEvent = marking?.marked;

  const lunarText = useMemo(
    () => getLunarDayText(year, month, day),
    [year, month, day],
  );

  const isSpecial = useMemo(
    () => isSpecialLunarDay(year, month, day),
    [year, month, day],
  );

  const handlePress = () => {
    if (!isDisabled && onPress) {
      onPress(date);
    }
  };

  return (
    <View
      style={[
        styles.container,
        isSelected && styles.selectedContainer,
      ]}
      onTouchEnd={handlePress}
    >
      <Text
        style={[
          styles.dayText,
          isToday && styles.todayText,
          isDisabled && styles.disabledText,
          isSelected && styles.selectedText,
        ]}
      >
        {day}
      </Text>
      <Text
        style={[
          styles.lunarText,
          isSpecial && styles.specialLunarText,
          isDisabled && styles.disabledText,
          isSelected && styles.selectedLunarText,
        ]}
        numberOfLines={1}
      >
        {lunarText}
      </Text>
      {hasEvent && !isSelected && <View style={styles.dot} />}
    </View>
  );
}

export const LunarDayCell = memo(LunarDayCellInner);

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
    height: 50,
    borderRadius: 8,
  },
  selectedContainer: {
    backgroundColor: '#111827',
  },
  dayText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
  },
  todayText: {
    color: '#2563EB',
    fontWeight: '700',
  },
  disabledText: {
    color: '#9CA3AF',
  },
  selectedText: {
    color: '#fff',
  },
  lunarText: {
    fontSize: 10,
    color: '#6B7280',
    marginTop: 2,
  },
  specialLunarText: {
    color: '#DC2626',
  },
  selectedLunarText: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  dot: {
    position: 'absolute',
    bottom: 4,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#111827',
  },
});
