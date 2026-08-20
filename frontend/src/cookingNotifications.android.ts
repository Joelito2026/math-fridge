import { isRunningInExpoGo } from 'expo';

let notificationHandlerConfigured = false;

async function getNotifications() {
  if (isRunningInExpoGo()) return null;

  const Notifications = await import('expo-notifications');
  if (!notificationHandlerConfigured) {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
    notificationHandlerConfigured = true;
  }

  return Notifications;
}

export async function scheduleCookingTimerNotification(seconds: number, recipeTitle: string, step: number, recipeId?: string) {
  const Notifications = await getNotifications();
  if (!Notifications) return null;

  await Notifications.setNotificationChannelAsync('cooking-timers', {
    name: 'Cooking timers',
    importance: Notifications.AndroidImportance.HIGH,
    sound: 'default',
    vibrationPattern: [0, 300, 200, 300],
  });
  const existingPermission = await Notifications.getPermissionsAsync();
  const permission = existingPermission.granted ? existingPermission : await Notifications.requestPermissionsAsync();
  if (!permission.granted) return null;
  return Notifications.scheduleNotificationAsync({
    content: {
      title: 'Cooking timer finished',
      body: `${recipeTitle} · Step ${step + 1}`,
      sound: 'default',
      data: { recipeId, step, url: recipeId ? `/cook/${encodeURIComponent(recipeId)}?step=${step}` : '/' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: Math.max(1, seconds),
      channelId: 'cooking-timers',
    },
  });
}

export async function cancelCookingTimerNotification(notificationId: string) {
  const Notifications = await getNotifications();
  if (!Notifications) return;

  await Notifications.cancelScheduledNotificationAsync(notificationId);
}
