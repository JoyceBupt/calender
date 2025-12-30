import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import type { RouteProp } from '@react-navigation/native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { getEventById, upsertEvent } from '../data/eventRepository';
import { listRemindersByEventId } from '../data/reminderRepository';
import { generateId } from '../domain/id';
import type { RootStackParamList } from '../navigation/types';
import {
  cancelRemindersForEvent,
  scheduleSingleReminderForEvent,
} from '../notifications/reminderService';
import {
  addDaysISODateLocal,
  getTodayISODateLocal,
  parseISODateLocal,
} from '../utils/date';

type EventEditorRoute = RouteProp<RootStackParamList, 'EventEditor'>;
type Navigation = NativeStackNavigationProp<RootStackParamList>;

export function EventEditorScreen() {
  const route = useRoute<EventEditorRoute>();
  const navigation = useNavigation<Navigation>();
  const db = useSQLiteContext();

  const eventId = useMemo(
    () => route.params?.eventId ?? generateId('evt'),
    [route.params?.eventId],
  );
  const initialDate = route.params?.initialDate;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [reminderMinutes, setReminderMinutes] = useState<number[]>([]);

  const defaultStartAt = useMemo(() => {
    const base = initialDate
      ? parseISODateLocal(initialDate)
      : new Date(new Date().setHours(0, 0, 0, 0));
    base.setHours(9, 0, 0, 0);
    return base;
  }, [initialDate]);

  const defaultEndAt = useMemo(() => {
    const end = new Date(defaultStartAt);
    end.setHours(end.getHours() + 1);
    return end;
  }, [defaultStartAt]);

  const [isAllDay, setIsAllDay] = useState(false);
  const [startAt, setStartAt] = useState<Date>(defaultStartAt);
  const [endAt, setEndAt] = useState<Date>(defaultEndAt);
  const [startDate, setStartDate] = useState<string>(
    initialDate ?? getTodayISODateLocal(),
  );
  const [endDateInclusive, setEndDateInclusive] = useState<string>(
    initialDate ?? getTodayISODateLocal(),
  );

  useEffect(() => {
    if (!initialDate) return;
    setStartDate(initialDate);
    setEndDateInclusive(initialDate);
  }, [initialDate]);

  useEffect(() => {
    let cancelled = false;
    const id = route.params?.eventId;
    if (!id) return;
    const eventIdToLoad = id;

    async function load() {
      setLoading(true);
      try {
        const [event, reminders] = await Promise.all([
          getEventById(db, eventIdToLoad),
          listRemindersByEventId(db, eventIdToLoad),
        ]);
        if (!event) {
          Alert.alert('未找到日程', '该日程可能已被删除');
          navigation.goBack();
          return;
        }
        if (cancelled) return;

        setTitle(event.title);
        setLocation(event.location ?? '');
        setNotes(event.notes ?? '');
        setReminderMinutes(reminders.map((r) => r.minutes_before));

        if (event.isAllDay) {
          setIsAllDay(true);
          setStartDate(event.startDate);
          setEndDateInclusive(addDaysISODateLocal(event.endDate, -1));
        } else {
          setIsAllDay(false);
          setStartAt(new Date(event.startAt));
          setEndAt(new Date(event.endAt));
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
  }, [db, navigation, route.params?.eventId]);

  const [picker, setPicker] = useState<
    | null
    | { kind: 'startDate' | 'endDate' | 'startTime' | 'endTime'; mode: 'date' | 'time' }
  >(null);

  function onChangePicker(
    kind: 'startDate' | 'endDate' | 'startTime' | 'endTime',
    e: DateTimePickerEvent,
    selected?: Date,
  ) {
    if (e.type === 'dismissed') {
      setPicker(null);
      return;
    }
    if (!selected) {
      setPicker(null);
      return;
    }

    if (isAllDay) {
      const picked = selected;
      const iso = `${picked.getFullYear()}-${String(picked.getMonth() + 1).padStart(2, '0')}-${String(picked.getDate()).padStart(2, '0')}`;
      if (kind === 'startDate') {
        setStartDate(iso);
        if (iso > endDateInclusive) setEndDateInclusive(iso);
      } else {
        setEndDateInclusive(iso);
        if (iso < startDate) setStartDate(iso);
      }
      setPicker(null);
      return;
    }

    if (kind === 'startDate') {
      const next = new Date(startAt);
      next.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
      setStartAt(next);
      if (next >= endAt) {
        const adjustedEnd = new Date(next);
        adjustedEnd.setHours(adjustedEnd.getHours() + 1);
        setEndAt(adjustedEnd);
      }
    } else if (kind === 'endDate') {
      const next = new Date(endAt);
      next.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
      setEndAt(next);
      if (startAt >= next) {
        const adjustedStart = new Date(next);
        adjustedStart.setHours(adjustedStart.getHours() - 1);
        setStartAt(adjustedStart);
      }
    } else if (kind === 'startTime') {
      const next = new Date(startAt);
      next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
      setStartAt(next);
      if (next >= endAt) {
        const adjustedEnd = new Date(next);
        adjustedEnd.setHours(adjustedEnd.getHours() + 1);
        setEndAt(adjustedEnd);
      }
    } else if (kind === 'endTime') {
      const next = new Date(endAt);
      next.setHours(selected.getHours(), selected.getMinutes(), 0, 0);
      setEndAt(next);
      if (startAt >= next) {
        const adjustedStart = new Date(next);
        adjustedStart.setHours(adjustedStart.getHours() - 1);
        setStartAt(adjustedStart);
      }
    }

    setPicker(null);
  }

  async function onSave() {
    const trimmed = title.trim();
    if (!trimmed) {
      Alert.alert('提示', '标题不能为空');
      return;
    }

    setSaving(true);
    try {
      if (isAllDay) {
        const endExclusive = addDaysISODateLocal(endDateInclusive, 1);
        await upsertEvent(db, {
          id: eventId,
          title: trimmed,
          isAllDay: true,
          startDate,
          endDate: endExclusive,
          location: location.trim() || null,
          notes: notes.trim() || null,
          timezone: null,
        });
      } else {
        await upsertEvent(db, {
          id: eventId,
          title: trimmed,
          isAllDay: false,
          startAt: startAt.toISOString(),
          endAt: endAt.toISOString(),
          location: location.trim() || null,
          notes: notes.trim() || null,
          timezone: null,
        });
      }

      await cancelRemindersForEvent(db, eventId);
      const uniqueMinutes = Array.from(new Set(reminderMinutes)).sort(
        (a, b) => a - b,
      );
      if (uniqueMinutes.length > 0) {
        try {
          for (const minutesBefore of uniqueMinutes) {
            await scheduleSingleReminderForEvent(db, {
              eventId,
              title: trimmed,
              isAllDay,
              startAtISO: isAllDay ? null : startAt.toISOString(),
              startDate: isAllDay ? startDate : null,
              minutesBefore,
            });
          }
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          if (message.includes('未获得通知权限')) {
            Alert.alert('提醒设置失败', message, [
              { text: '取消', style: 'cancel' },
              {
                text: '去设置',
                onPress: () => {
                  void Linking.openSettings();
                },
              },
            ]);
          } else {
            Alert.alert('提醒设置失败', message);
          }
        }
      }

      navigation.replace('EventDetail', { eventId });
    } catch (e) {
      Alert.alert('保存失败', e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  const startDateLabel = isAllDay
    ? startDate
    : `${startAt.getFullYear()}-${String(startAt.getMonth() + 1).padStart(2, '0')}-${String(startAt.getDate()).padStart(2, '0')}`;
  const endDateLabel = isAllDay
    ? endDateInclusive
    : `${endAt.getFullYear()}-${String(endAt.getMonth() + 1).padStart(2, '0')}-${String(endAt.getDate()).padStart(2, '0')}`;
  const startTimeLabel = startAt.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });
  const endTimeLabel = endAt.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <View style={styles.container}>
      {loading ? <Text style={styles.hint}>加载中...</Text> : null}

      <Text style={styles.label}>标题 *</Text>
      <TextInput
        style={styles.input}
        placeholder="例如：组会 / 上课 / 生日"
        value={title}
        onChangeText={setTitle}
      />

      <View style={styles.rowBetween}>
        <Text style={styles.label}>全天</Text>
        <Switch
          value={isAllDay}
          onValueChange={(next) => {
            setIsAllDay(next);
            if (next) {
              const iso = `${startAt.getFullYear()}-${String(startAt.getMonth() + 1).padStart(2, '0')}-${String(startAt.getDate()).padStart(2, '0')}`;
              setStartDate(iso);
              setEndDateInclusive(iso);
            } else {
              const base = parseISODateLocal(startDate);
              base.setHours(9, 0, 0, 0);
              const end = new Date(base);
              end.setHours(end.getHours() + 1);
              setStartAt(base);
              setEndAt(end);
            }
          }}
        />
      </View>

      <View style={styles.block}>
        <Text style={styles.blockTitle}>时间</Text>

        <View style={styles.row}>
          <Pressable
            style={styles.field}
            onPress={() => setPicker({ kind: 'startDate', mode: 'date' })}
          >
            <Text style={styles.fieldLabel}>开始日期</Text>
            <Text style={styles.fieldValue}>{startDateLabel}</Text>
          </Pressable>

          <Pressable
            style={styles.field}
            onPress={() => setPicker({ kind: 'endDate', mode: 'date' })}
          >
            <Text style={styles.fieldLabel}>结束日期</Text>
            <Text style={styles.fieldValue}>{endDateLabel}</Text>
          </Pressable>
        </View>

        {isAllDay ? null : (
          <View style={styles.row}>
            <Pressable
              style={styles.field}
              onPress={() => setPicker({ kind: 'startTime', mode: 'time' })}
            >
              <Text style={styles.fieldLabel}>开始时间</Text>
              <Text style={styles.fieldValue}>{startTimeLabel}</Text>
            </Pressable>

            <Pressable
              style={styles.field}
              onPress={() => setPicker({ kind: 'endTime', mode: 'time' })}
            >
              <Text style={styles.fieldLabel}>结束时间</Text>
              <Text style={styles.fieldValue}>{endTimeLabel}</Text>
            </Pressable>
          </View>
        )}
      </View>

      <View style={styles.block}>
        <Text style={styles.blockTitle}>提醒</Text>
        <View style={styles.chips}>
          <Pressable
            style={[
              styles.chip,
              reminderMinutes.length === 0 ? styles.chipActive : null,
            ]}
            onPress={() => setReminderMinutes([])}
          >
            <Text
              style={[
                styles.chipText,
                reminderMinutes.length === 0 ? styles.chipTextActive : null,
              ]}
            >
              无
            </Text>
          </Pressable>

          {[0, 5, 10, 30].map((m) => (
            <Pressable
              key={m}
              style={[
                styles.chip,
                reminderMinutes.includes(m) ? styles.chipActive : null,
              ]}
              onPress={() => {
                setReminderMinutes((prev) => {
                  const set = new Set(prev);
                  if (set.has(m)) {
                    set.delete(m);
                  } else {
                    set.add(m);
                  }
                  return Array.from(set).sort((a, b) => a - b);
                });
              }}
            >
              <Text
                style={[
                  styles.chipText,
                  reminderMinutes.includes(m) ? styles.chipTextActive : null,
                ]}
              >
                {m === 0 ? '准时' : `提前${m}分钟`}
              </Text>
            </Pressable>
          ))}
        </View>
        {isAllDay ? (
          <Text style={styles.hint}>全天日程默认以 09:00 作为提醒基准</Text>
        ) : null}
      </View>

      <Text style={styles.label}>地点</Text>
      <TextInput
        style={styles.input}
        placeholder="可选"
        value={location}
        onChangeText={setLocation}
      />

      <Text style={styles.label}>备注</Text>
      <TextInput
        style={[styles.input, styles.textarea]}
        placeholder="可选"
        value={notes}
        onChangeText={setNotes}
        multiline
      />

      <Pressable
        style={[styles.primaryButton, saving ? styles.disabledButton : null]}
        onPress={onSave}
        disabled={saving}
      >
        <Text style={styles.primaryButtonText}>
          {saving ? '保存中...' : '保存'}
        </Text>
      </Pressable>

      {picker ? (
        <DateTimePicker
          value={
            isAllDay
              ? parseISODateLocal(
                  picker.kind === 'startDate' ? startDate : endDateInclusive,
                )
              : picker.kind === 'startDate' || picker.kind === 'startTime'
                ? startAt
                : endAt
          }
          mode={picker.mode}
          onChange={(e, selected) => onChangePicker(picker.kind, e, selected)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 10 },
  hint: { color: '#6B7280' },
  label: { fontSize: 13, color: '#374151', fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    fontSize: 16,
  },
  textarea: { minHeight: 88, textAlignVertical: 'top' },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  block: {
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 12,
    gap: 10,
  },
  blockTitle: { fontSize: 14, fontWeight: '700', color: '#111827' },
  row: { flexDirection: 'row', gap: 10 },
  field: {
    flex: 1,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 10,
    borderRadius: 12,
    gap: 6,
  },
  fieldLabel: { fontSize: 12, color: '#6B7280' },
  fieldValue: { fontSize: 15, fontWeight: '600', color: '#111827' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#fff',
  },
  chipActive: { backgroundColor: '#111827', borderColor: '#111827' },
  chipText: { fontSize: 13, color: '#111827', fontWeight: '600' },
  chipTextActive: { color: '#fff' },
  primaryButton: {
    marginTop: 8,
    alignSelf: 'stretch',
    backgroundColor: '#111827',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  disabledButton: { opacity: 0.6 },
  primaryButtonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
