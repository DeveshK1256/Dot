import { sendNotification } from './notifications.js';

export class DeadlineScheduler {
  constructor(storage, windowManager) {
    this.storage = storage;
    this.windowManager = windowManager;
    this.intervalId = null;
    this.checkIntervalMs = 60 * 1000; // Check every 60s
  }

  start() {
    this.stop();
    this.checkDeadlines(); // Immediate check on startup
    this.intervalId = setInterval(() => {
      this.checkDeadlines();
    }, this.checkIntervalMs);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  checkDeadlines() {
    const settings = this.storage.getSettings();
    const globalReminderWindows = settings?.deadlineReminderWindowsMin || [1440, 60, 15, 0];
    const now = Date.now();

    const allNotes = this.storage.getAllNotes();
    let minTimeRemainingMin = Infinity;

    for (const note of allNotes) {
      if (!note.deadline) continue;

      const reminderWindows = Array.isArray(note.alertWindowsMin) && note.alertWindowsMin.length > 0
        ? note.alertWindowsMin
        : globalReminderWindows;

      const msLeft = note.deadline - now;
      const minsLeft = Math.floor(msLeft / 60000);

      if (minsLeft < minTimeRemainingMin) {
        minTimeRemainingMin = minsLeft;
      }

      for (const windowMin of reminderWindows) {
        // If within window (+/- 2 minute drift) and not already fired
        if (minsLeft <= windowMin && minsLeft >= windowMin - 2) {
          if (!Array.isArray(note.firedReminders)) note.firedReminders = [];
          if (!note.firedReminders.includes(windowMin)) {
            note.firedReminders.push(windowMin);
            this.storage.saveNote(note);

            const timeStr = windowMin === 0 ? 'Now' : `in ${windowMin}m`;

            // Play alarm sound if enabled
            const soundEnabled = settings?.soundEnabled !== false;
            const alarmSound = settings?.alarmSound || 'chime';
            if (soundEnabled) {
              this.windowManager.broadcast('play-alarm-sound', { sound: alarmSound });
            }

            sendNotification({
              title: `Task Due: ${timeStr}`,
              message: note.text ? note.text.slice(0, 80) : 'Check your note checklist',
              silent: true,
              onClick: () => {
                this.windowManager.openNewNoteInHub();
              }
            });
          }
        }
      }
    }

    // Dispatch urgency ring event to hub window
    let urgency = 'normal';
    if (minTimeRemainingMin <= 15) {
      urgency = 'critical'; // Red pulsing
    } else if (minTimeRemainingMin <= 60) {
      urgency = 'warning'; // Amber pulsing
    }
    this.windowManager.broadcast('urgency-update', { dotId: 'hub-dot', urgency });
  }
}
