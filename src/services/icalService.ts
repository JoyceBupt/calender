/**
 * iCalendar 文件导入导出服务
 */

import { File, Paths } from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import type { SQLiteDatabase } from 'expo-sqlite';

import type { CalendarEvent } from '../domain/event';
import { listAllEvents, upsertEvent } from '../data/eventRepository';
import { exportToICS, parseICS } from '../utils/ical';

/**
 * 导出所有事件为 .ics 文件并分享
 */
export async function exportEventsToICS(db: SQLiteDatabase): Promise<void> {
  // 获取所有事件
  const events = await listAllEvents(db);

  if (events.length === 0) {
    throw new Error('没有可导出的日程');
  }

  // 生成 ICS 内容
  const icsContent = exportToICS(events);

  // 写入临时文件
  const fileName = `calendar_export_${Date.now()}.ics`;
  const file = new File(Paths.cache, fileName);
  file.create();
  file.write(icsContent);

  // 检查是否支持分享
  const isAvailable = await Sharing.isAvailableAsync();
  if (!isAvailable) {
    throw new Error('当前设备不支持分享功能');
  }

  // 分享文件
  await Sharing.shareAsync(file.uri, {
    mimeType: 'text/calendar',
    dialogTitle: '导出日历',
    UTI: 'public.calendar-file',
  });
}

/**
 * 从 .ics 文件导入事件
 * @returns 导入的事件数量
 */
export async function importEventsFromICS(db: SQLiteDatabase): Promise<number> {
  // 打开文件选择器
  const result = await DocumentPicker.getDocumentAsync({
    type: ['text/calendar', 'application/ics', '*/*'],
    copyToCacheDirectory: true,
  });

  if (result.canceled || !result.assets || result.assets.length === 0) {
    return 0;
  }

  const pickedFile = result.assets[0];

  // 读取文件内容
  const file = new File(pickedFile.uri);
  const content = await file.text();

  // 解析 ICS 内容
  const events = parseICS(content);

  if (events.length === 0) {
    throw new Error('文件中没有找到有效的日程');
  }

  // 导入事件到数据库
  for (const event of events) {
    await upsertEvent(db, event);
  }

  return events.length;
}

/**
 * 导出指定事件为 .ics 文件并分享
 */
export async function exportSingleEventToICS(event: CalendarEvent): Promise<void> {
  // 生成 ICS 内容
  const icsContent = exportToICS([event]);

  // 写入临时文件
  const safeTitle = event.title.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_').slice(0, 20);
  const fileName = `${safeTitle}_${Date.now()}.ics`;
  const file = new File(Paths.cache, fileName);
  file.create();
  file.write(icsContent);

  // 检查是否支持分享
  const isAvailable = await Sharing.isAvailableAsync();
  if (!isAvailable) {
    throw new Error('当前设备不支持分享功能');
  }

  // 分享文件
  await Sharing.shareAsync(file.uri, {
    mimeType: 'text/calendar',
    dialogTitle: '分享日程',
    UTI: 'public.calendar-file',
  });
}
