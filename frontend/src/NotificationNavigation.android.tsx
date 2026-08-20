import { isRunningInExpoGo } from 'expo';
import { router } from 'expo-router';
import { useEffect } from 'react';

import type { Notification } from 'expo-notifications';

function openNotification(notification: Notification) {
  const url = notification.request.content.data?.url;
  if (typeof url === 'string' && url.startsWith('/cook/')) router.push(url as never);
}

export default function NotificationNavigation() {
  useEffect(() => {
    if (isRunningInExpoGo()) return;

    let removeSubscription: (() => void) | undefined;
    let cancelled = false;

    void import('expo-notifications').then((Notifications) => {
      if (cancelled) return;

      const lastResponse = Notifications.getLastNotificationResponse();
      if (lastResponse?.notification) {
        openNotification(lastResponse.notification);
        Notifications.clearLastNotificationResponse();
      }

      const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
        openNotification(response.notification);
        Notifications.clearLastNotificationResponse();
      });
      removeSubscription = () => subscription.remove();
    });

    return () => {
      cancelled = true;
      removeSubscription?.();
    };
  }, []);

  return null;
}
