import { Notification } from 'electron';
import notifier from 'node-notifier';

export function sendNotification({ title, message, onClick }) {
  try {
    if (Notification.isSupported()) {
      const notification = new Notification({
        title: title || 'Dot Reminder',
        body: message,
        silent: false
      });
      if (onClick) {
        notification.on('click', onClick);
      }
      notification.show();
      return true;
    }
  } catch (err) {
    // Fallback to node-notifier if electron native Notification fails (e.g. Linux distros)
  }

  notifier.notify({
    title: title || 'Dot Reminder',
    message,
    sound: true
  });
  return true;
}
