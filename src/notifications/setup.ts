import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function ensureAndroidNotificationChannelAsync() {
  if (Platform.OS !== 'android') return;

  await Notifications.setNotificationChannelAsync('default', {
    name: 'default',
    importance: Notifications.AndroidImportance.HIGH,
  });
}

export async function ensureNotificationPermissionsAsync(): Promise<void> {
  const settings = await Notifications.getPermissionsAsync();
  if (settings.granted) return;

  const request = await Notifications.requestPermissionsAsync();
  if (!request.granted) {
    throw new Error('未获得通知权限，无法设置提醒');
  }
}

