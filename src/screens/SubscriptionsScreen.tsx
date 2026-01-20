import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';

import type { Subscription } from '../domain/subscription';
import {
  createSubscription,
  deleteSubscription,
  listSubscriptions,
} from '../data/subscriptionRepository';
import { syncSubscription } from '../services/subscriptionService';

const COLORS = ['#6366F1', '#EC4899', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

export function SubscriptionsScreen() {
  const db = useSQLiteContext();
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [selectedColor, setSelectedColor] = useState(COLORS[0]);
  const [syncing, setSyncing] = useState<string | null>(null);

  const loadSubscriptions = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listSubscriptions(db);
      setSubscriptions(list);
    } catch (e) {
      console.error('加载订阅失败', e);
    } finally {
      setLoading(false);
    }
  }, [db]);

  useEffect(() => {
    void loadSubscriptions();
  }, [loadSubscriptions]);

  const handleAdd = async () => {
    if (!newName.trim() || !newUrl.trim()) {
      Alert.alert('错误', '请填写名称和 URL');
      return;
    }

    try {
      const subscription = await createSubscription(db, {
        name: newName,
        url: newUrl,
        color: selectedColor,
      });

      setModalVisible(false);
      setNewName('');
      setNewUrl('');
      setSelectedColor(COLORS[0]);

      // 立即同步
      setSyncing(subscription.id);
      try {
        const count = await syncSubscription(db, subscription.id);
        Alert.alert('添加成功', `已同步 ${count} 个日程`);
      } catch (e) {
        Alert.alert(
          '同步失败',
          e instanceof Error ? e.message : String(e) || '请稍后重试',
        );
      } finally {
        setSyncing(null);
      }

      await loadSubscriptions();
    } catch (e) {
      Alert.alert('添加失败', e instanceof Error ? e.message : String(e) || '未知错误');
    }
  };

  const handleSync = async (subscription: Subscription) => {
    setSyncing(subscription.id);
    try {
      const count = await syncSubscription(db, subscription.id);
      Alert.alert('同步成功', `已同步 ${count} 个日程`);
      await loadSubscriptions();
    } catch (e) {
      Alert.alert(
        '同步失败',
        e instanceof Error ? e.message : String(e) || '请稍后重试',
      );
    } finally {
      setSyncing(null);
    }
  };

  const handleDelete = (subscription: Subscription) => {
    Alert.alert('删除订阅', `确定要删除「${subscription.name}」吗？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteSubscription(db, subscription.id);
            await loadSubscriptions();
          } catch (e) {
            Alert.alert(
              '删除失败',
              e instanceof Error ? e.message : String(e) || '未知错误',
            );
          }
        },
      },
    ]);
  };

  const renderItem = ({ item }: { item: Subscription }) => (
    <View style={styles.item}>
      <View style={[styles.colorDot, { backgroundColor: item.color }]} />
      <View style={styles.itemContent}>
        <Text style={styles.itemName}>{item.name}</Text>
        <Text style={styles.itemUrl} numberOfLines={1}>
          {item.url}
        </Text>
        {item.lastSyncedAt && (
          <Text style={styles.itemSync}>
            上次同步: {new Date(item.lastSyncedAt).toLocaleString()}
          </Text>
        )}
      </View>
      <View style={styles.itemActions}>
        <Pressable
          style={styles.actionButton}
          onPress={() => handleSync(item)}
          disabled={syncing === item.id}
        >
          <Text style={styles.actionText}>
            {syncing === item.id ? '同步中...' : '同步'}
          </Text>
        </Pressable>
        <Pressable
          style={[styles.actionButton, styles.deleteButton]}
          onPress={() => handleDelete(item)}
        >
          <Text style={styles.deleteText}>删除</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <Pressable style={styles.addButton} onPress={() => setModalVisible(true)}>
        <Text style={styles.addButtonText}>添加订阅</Text>
      </Pressable>

      {loading ? (
        <Text style={styles.hint}>加载中...</Text>
      ) : subscriptions.length === 0 ? (
        <Text style={styles.hint}>暂无订阅，点击上方按钮添加</Text>
      ) : (
        <FlatList
          data={subscriptions}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
        />
      )}

      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>添加订阅</Text>

            <TextInput
              style={styles.input}
              placeholder="订阅名称"
              value={newName}
              onChangeText={setNewName}
            />

            <TextInput
              style={styles.input}
              placeholder="订阅 URL (ics 文件地址)"
              value={newUrl}
              onChangeText={setNewUrl}
              autoCapitalize="none"
              keyboardType="url"
            />

            <Text style={styles.colorLabel}>颜色</Text>
            <View style={styles.colorRow}>
              {COLORS.map((color) => (
                <Pressable
                  key={color}
                  style={[
                    styles.colorOption,
                    { backgroundColor: color },
                    selectedColor === color && styles.colorSelected,
                  ]}
                  onPress={() => setSelectedColor(color)}
                />
              ))}
            </View>

            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelText}>取消</Text>
              </Pressable>
              <Pressable
                style={[styles.modalButton, styles.confirmButton]}
                onPress={handleAdd}
              >
                <Text style={styles.confirmText}>添加</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  addButton: {
    backgroundColor: '#111827',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 16,
  },
  addButtonText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  hint: { color: '#6B7280', textAlign: 'center', marginTop: 20 },
  list: { gap: 12 },
  item: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 10,
  },
  itemContent: { flex: 1 },
  itemName: { fontSize: 15, fontWeight: '700', color: '#111827' },
  itemUrl: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  itemSync: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  itemActions: { flexDirection: 'row', gap: 8 },
  actionButton: {
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  actionText: { fontSize: 12, color: '#374151', fontWeight: '600' },
  deleteButton: { backgroundColor: '#FEE2E2' },
  deleteText: { fontSize: 12, color: '#991B1B', fontWeight: '600' },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    marginBottom: 12,
  },
  colorLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 8,
  },
  colorRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  colorOption: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  colorSelected: {
    borderWidth: 3,
    borderColor: '#111827',
  },
  modalActions: { flexDirection: 'row', gap: 12 },
  modalButton: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  cancelButton: { backgroundColor: '#E5E7EB' },
  cancelText: { color: '#374151', fontWeight: '700' },
  confirmButton: { backgroundColor: '#111827' },
  confirmText: { color: '#fff', fontWeight: '700' },
});
