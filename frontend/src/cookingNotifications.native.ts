import * as Notifications from 'expo-notifications';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

export async function scheduleCookingTimerNotification(seconds: number, recipeTitle: string, step: number, recipeId?: string) {
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
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: Math.max(1, seconds), channelId: 'cooking-timers' },
  });
}

export async function cancelCookingTimerNotification(notificationId: string) {
  await Notifications.cancelScheduledNotificationAsync(notificationId);
}
