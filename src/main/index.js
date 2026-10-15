import { app, BrowserWindow, ipcMain, globalShortcut } from 'electron';
import Store from 'electron-store';
import { StorageEngine } from '../shared/storage.js';
import { WindowManager } from './windowManager.js';
import { DeadlineScheduler } from './deadlineScheduler.js';
import { setupTray } from './tray.js';

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
    windowManager.spawnDotAtCursor();
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

    // Register global shortcuts
    const settings = storage.getSettings();
    if (settings.quickCaptureShortcut) {
      globalShortcut.register(settings.quickCaptureShortcut, () => {
        windowManager.spawnDotAtCursor();
      });
    }
    if (settings.ghostModeShortcut) {
      globalShortcut.register(settings.ghostModeShortcut, () => {
        windowManager.toggleGhostMode();
      });
    }

    // Ensure Hub Dot exists
    windowManager.ensureHubDot();

    // Restore existing dots or spawn default one
    const allDots = storage.getDots();
    for (const dot of allDots) {
      windowManager.createDotWindow(dot);
    }
    const nonHubDots = allDots.filter((d) => !d.isHub && d.id !== 'hub-dot');
    if (nonHubDots.length === 0) {
      windowManager.spawnNewDot({ x: 140, y: 140 });
    }

    // Apply saved displayMode (persists across restarts)
    windowManager.applyDisplayMode(settings.displayMode || 'all');

    // Initialize cluster state for existing dots
    windowManager.updateClusters();

    // Create persistent "+" button window
    windowManager.createPlusButtonWindow();

    // Setup IPC Handlers with robust try/catch wrapping
    ipcMain.on('set-dot-state', (_event, { dotId, state }) => {
      try {
        windowManager.setDotState(dotId, state);
      } catch (err) {
        console.error('[IPC ERROR set-dot-state]:', err);
      }
    });

    ipcMain.on('close-dot-window', (_event, dotId) => {
      try {
        windowManager.closeDotWindow(dotId);
      } catch (err) {
        console.error('[IPC ERROR close-dot-window]:', err);
      }
    });

    ipcMain.on('hide-dot-window', (_event, dotId) => {
      try {
        windowManager.hideDotWindow(dotId);
      } catch (err) {
        console.error('[IPC ERROR hide-dot-window]:', err);
      }
    });

    ipcMain.on('spawn-dot-from-plus-button', () => {
      try {
        windowManager.spawnDotFromPlusButton();
      } catch (err) {
        console.error('[IPC ERROR spawn-dot-from-plus-button]:', err);
      }
    });

    ipcMain.on('bring-dot-to-front', (_event, dotId) => {
      try {
        console.log(`[IPC bring-dot-to-front] Opening dot: ${dotId}`);
        windowManager.bringDotToFront(dotId);
      } catch (err) {
        console.error(`[IPC ERROR bring-dot-to-front ${dotId}]:`, err);
      }
    });

    ipcMain.on('set-cluster-state', (_e, { clusterId, state }) => {
      try {
        windowManager.setClusterState(clusterId, state);
      } catch (err) {
        console.error('[IPC ERROR set-cluster-state]:', err);
      }
    });

    ipcMain.handle('get-cluster-data', (_e, clusterId) => {
      try {
        return windowManager.getClusterData(clusterId);
      } catch (err) {
        console.error('[IPC ERROR get-cluster-data]:', err);
        return null;
      }
    });

    ipcMain.on('uncluster', (_e, clusterId) => {
      try {
        windowManager.uncluster(clusterId);
      } catch (err) {
        console.error('[IPC ERROR uncluster]:', err);
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
        windowManager.updatePlusButtonWindow(saved);
        if (s.displayMode !== undefined) {
          windowManager.applyDisplayMode(s.displayMode);
          if (tray && tray.updateDisplayMode) {
            tray.updateDisplayMode();
          }
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
