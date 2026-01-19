/**
 * 订阅同步服务
 */

import type { SQLiteDatabase } from 'expo-sqlite';

import {
  clearSubscriptionEvents,
  getSubscriptionById,
  insertSubscriptionEvents,
  listSubscriptions,
  updateSubscriptionSyncTime,
} from '../data/subscriptionRepository';
import { parseICS } from '../utils/ical';

/**
 * 同步单个订阅
 */
export async function syncSubscription(
  db: SQLiteDatabase,
  subscriptionId: string,
): Promise<number> {
  const subscription = await getSubscriptionById(db, subscriptionId);
  if (!subscription) {
    throw new Error('订阅不存在');
  }

  // 获取远程 ICS 文件
  const response = await fetch(subscription.url, {
    headers: {
      Accept: 'text/calendar, application/ics, */*',
    },
  });

  if (!response.ok) {
    throw new Error(`获取日历失败: ${response.status} ${response.statusText}`);
  }

  const content = await response.text();

  // 解析 ICS 内容
  const events = parseICS(content);

  // 清除旧事件并插入新事件
  await clearSubscriptionEvents(db, subscriptionId);
  await insertSubscriptionEvents(db, subscriptionId, events);

  // 更新同步时间
  await updateSubscriptionSyncTime(db, subscriptionId);

  return events.length;
}

/**
 * 同步所有订阅
 */
export async function syncAllSubscriptions(
  db: SQLiteDatabase,
): Promise<{ success: number; failed: number }> {
  const subscriptions = await listSubscriptions(db);

  let success = 0;
  let failed = 0;

  for (const subscription of subscriptions) {
    try {
      await syncSubscription(db, subscription.id);
      success++;
    } catch (e) {
      console.warn(`同步订阅 ${subscription.name} 失败:`, e);
      failed++;
    }
  }

  return { success, failed };
}
