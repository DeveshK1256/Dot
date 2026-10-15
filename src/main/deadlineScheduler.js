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

    const dots = this.storage.getDots();
    for (const dot of dots) {
      const notes = this.storage.getNotesByDot(dot.id);
      let dotMinTimeRemainingMin = Infinity;

      for (const note of notes) {
        if (!note.deadline) continue;

        const reminderWindows = Array.isArray(note.alertWindowsMin) && note.alertWindowsMin.length > 0
          ? note.alertWindowsMin
          : globalReminderWindows;

        const msLeft = note.deadline - now;
        const minsLeft = Math.floor(msLeft / 60000);

        if (minsLeft < dotMinTimeRemainingMin) {
          dotMinTimeRemainingMin = minsLeft;
        }

        for (const windowMin of reminderWindows) {
          // If within window (+/- 2 minute drift) and not already fired
          if (minsLeft <= windowMin && minsLeft >= windowMin - 2) {
            if (!note.firedReminders.includes(windowMin)) {
              note.firedReminders.push(windowMin);
              this.storage.saveNote(note);

              const timeStr = windowMin === 0 ? 'Now' : `in ${windowMin}m`;
              sendNotification({
                title: `Task Due: ${timeStr}`,
                message: note.text ? note.text.slice(0, 80) : 'Check your note checklist',
                onClick: () => {
                  this.windowManager.createDotWindow(dot);
                }
              });
            }
          }
        }
      }

      // Dispatch urgency ring event to the dot's window
      const win = this.windowManager.windows.get(dot.id);
      if (win && !win.isDestroyed()) {
        let urgency = 'normal';
        if (dotMinTimeRemainingMin <= 15) {
          urgency = 'critical'; // Red pulsing
        } else if (dotMinTimeRemainingMin <= 60) {
          urgency = 'warning'; // Amber pulsing
        }
        win.webContents.send('urgency-update', { dotId: dot.id, urgency });
      }
    }
  }
}
