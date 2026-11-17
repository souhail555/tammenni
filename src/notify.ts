import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

const supported = Platform.OS !== 'web';

export async function setupNotifications() {
  if (!supported) return false;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('reminders', {
      name: 'تذكيرات',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 400, 200, 400],
    });
  }
  const res = await Notifications.requestPermissionsAsync();
  return res.granted;
}

export async function scheduleDaily(title: string, body: string, hour: number, minute: number) {
  if (!supported) return undefined;
  try {
    return await Notifications.scheduleNotificationAsync({
      content: { title, body, sound: true },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour,
        minute,
        channelId: 'reminders',
      },
    });
  } catch {
    return undefined;
  }
}

export async function cancel(id?: string) {
  if (!supported || !id) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {}
}
