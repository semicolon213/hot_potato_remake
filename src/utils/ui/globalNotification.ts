export type GlobalNotificationType = 'info' | 'success' | 'error' | 'warning';

const GLOBAL_NOTIFICATION_EVENT = 'hp:global-notification';

export interface GlobalNotificationPayload {
  message: string;
  type?: GlobalNotificationType;
  duration?: number;
}

export const notifyGlobal = (
  message: string,
  type: GlobalNotificationType = 'info',
  duration?: number
): void => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<GlobalNotificationPayload>(GLOBAL_NOTIFICATION_EVENT, {
      detail: { message, type, duration }
    })
  );
};

export const subscribeGlobalNotification = (
  handler: (payload: GlobalNotificationPayload) => void
): (() => void) => {
  if (typeof window === 'undefined') return () => {};
  const listener = (event: Event) => {
    const customEvent = event as CustomEvent<GlobalNotificationPayload>;
    if (customEvent?.detail?.message) {
      handler(customEvent.detail);
    }
  };
  window.addEventListener(GLOBAL_NOTIFICATION_EVENT, listener as EventListener);
  return () => window.removeEventListener(GLOBAL_NOTIFICATION_EVENT, listener as EventListener);
};
