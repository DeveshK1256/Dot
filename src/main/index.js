import { app, BrowserWindow, ipcMain, globalShortcut } from 'electron';
import Store from 'electron-store';
import { StorageEngine } from '../shared/storage.js';
import { WindowManager } from './windowManager.js';
import { DeadlineScheduler } from './deadlineScheduler.js';
import { setupTray } from './tray.js';
import { setStartupEnabled } from './startup.js';

const electronStore = new Store();
const storage = new StorageEngine(electronStore);
const windowManager = new WindowManager(storage);
const scheduler = new DeadlineScheduler(storage, windowManager);

let tray = null;

process.on('uncaughtException', (err) => {
  console.error('[MAIN UNCAUGHT EXCEPTION]', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[MAIN UNHANDLED REJECTION]', reason);
});

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    windowManager.openNewNoteInHub();
  });

  app.whenReady().then(() => {
    // Start background scheduler
    scheduler.start();

    // Setup tray
    tray = setupTray({
      windowManager,
      storage,
      onOpenSettings: () => {
        windowManager.openSettingsWindow();
      }
    });

    // Configure startup / login item settings
    const settings = storage.getSettings();
    const launchAtStartup = settings?.launchAtStartup !== false;
    setStartupEnabled(launchAtStartup);

    // Register global shortcuts
    if (settings.quickCaptureShortcut) {
      globalShortcut.register(settings.quickCaptureShortcut, () => {
        windowManager.openNewNoteInHub();
      });
    }
    if (settings.ghostModeShortcut) {
      globalShortcut.register(settings.ghostModeShortcut, () => {
        windowManager.toggleGhostMode();
      });
    }

    // Ensure Hub Dot exists and create the single Hub window
    windowManager.ensureHubDot();
    windowManager.createHubWindow();

    // Setup IPC Handlers
    ipcMain.on('set-dot-state', (_event, { dotId, state }) => {
      try {
        windowManager.setDotState(dotId, state);
      } catch (err) {
        console.error('[IPC ERROR set-dot-state]:', err);
      }
    });

    ipcMain.on('open-new-note', () => {
      try {
        windowManager.openNewNoteInHub();
      } catch (err) {
        console.error('[IPC ERROR open-new-note]:', err);
      }
    });

    ipcMain.handle('storage:getSettings', () => {
      try {
        return storage.getSettings();
      } catch (err) {
        console.error('[IPC ERROR storage:getSettings]:', err);
        return {};
      }
    });

    ipcMain.handle('storage:saveSettings', (_e, s) => {
      try {
        const saved = storage.saveSettings(s);
        windowManager.broadcast('settings-updated', saved);
        if (s.launchAtStartup !== undefined) {
          setStartupEnabled(s.launchAtStartup);
        }
        return saved;
      } catch (err) {
        console.error('[IPC ERROR storage:saveSettings]:', err);
        return s;
      }
    });

    ipcMain.handle('storage:getDots', () => {
      try {
        return storage.getDots();
      } catch (err) {
        console.error('[IPC ERROR storage:getDots]:', err);
        return [];
      }
    });

    ipcMain.handle('storage:saveDot', (_e, d) => {
      try {
        const saved = storage.saveDot(d);
        windowManager.broadcast('dot-updated', saved);
        if (saved.isHub || saved.id === windowManager.hubDotId) {
          windowManager.updateHubPosition(saved);
        }
        return saved;
      } catch (err) {
        console.error('[IPC ERROR storage:saveDot]:', err);
        return d;
      }
    });

    ipcMain.handle('storage:deleteDot', (_e, { dotId, deleteNotes }) => {
      try {
        const deleted = storage.deleteDot(dotId, deleteNotes);
        windowManager.broadcast('dot-deleted', dotId);
        return deleted;
      } catch (err) {
        console.error('[IPC ERROR storage:deleteDot]:', err);
        return false;
      }
    });

    ipcMain.handle('storage:getNotesByDot', (_e, dotId) => {
      try {
        return storage.getNotesByDot(dotId);
      } catch (err) {
        console.error('[IPC ERROR storage:getNotesByDot]:', err);
        return [];
      }
    });

    ipcMain.handle('storage:getAllNotes', () => {
      try {
        return storage.getAllNotes();
      } catch (err) {
        console.error('[IPC ERROR storage:getAllNotes]:', err);
        return [];
      }
    });

    ipcMain.handle('storage:saveNote', (_e, n) => {
      try {
        const saved = storage.saveNote(n);
        windowManager.broadcast('note-updated', saved);
        return saved;
      } catch (err) {
        console.error('[IPC ERROR storage:saveNote]:', err);
        return n;
      }
    });

    ipcMain.handle('storage:deleteNote', (_e, noteId) => {
      try {
        const deleted = storage.deleteNote(noteId);
        windowManager.broadcast('note-deleted', noteId);
        return deleted;
      } catch (err) {
        console.error('[IPC ERROR storage:deleteNote]:', err);
        return false;
      }
    });
  });

  app.on('window-all-closed', (e) => {
    // Keep app running in tray when windows are closed
    e.preventDefault();
  });

  app.on('will-quit', () => {
    globalShortcut.unregisterAll();
    scheduler.stop();
  });
}
