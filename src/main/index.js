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

    // Create persistent "+" button window
    windowManager.createPlusButtonWindow();

    // Setup IPC Handlers
    ipcMain.on('set-dot-state', (_event, { dotId, state }) => {
      windowManager.setDotState(dotId, state);
    });

    ipcMain.on('close-dot-window', (_event, dotId) => {
      windowManager.closeDotWindow(dotId);
    });

    ipcMain.on('hide-dot-window', (_event, dotId) => {
      windowManager.hideDotWindow(dotId);
    });

    ipcMain.on('spawn-dot-from-plus-button', () => {
      windowManager.spawnDotFromPlusButton();
    });

    ipcMain.on('bring-dot-to-front', (_event, dotId) => {
      windowManager.bringDotToFront(dotId);
    });

    ipcMain.on('set-cluster-state', (_e, { clusterId, state }) => {
      windowManager.setClusterState(clusterId, state);
    });

    ipcMain.handle('get-cluster-data', (_e, clusterId) => {
      return windowManager.getClusterData(clusterId);
    });

    ipcMain.on('uncluster', (_e, clusterId) => {
      windowManager.uncluster(clusterId);
    });

    ipcMain.handle('storage:getSettings', () => storage.getSettings());
    ipcMain.handle('storage:saveSettings', (_e, s) => {
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
    });
    ipcMain.handle('storage:getDots', () => storage.getDots());
    ipcMain.handle('storage:saveDot', (_e, d) => {
      const saved = storage.saveDot(d);
      windowManager.broadcast('dot-updated', saved);
      if (saved.isHub || saved.id === windowManager.hubDotId) {
        windowManager.updateHubPosition(saved);
      }
      return saved;
    });
    ipcMain.handle('storage:deleteDot', (_e, { dotId, deleteNotes }) => {
      const deleted = storage.deleteDot(dotId, deleteNotes);
      windowManager.broadcast('dot-deleted', dotId);
      return deleted;
    });
    ipcMain.handle('storage:getNotesByDot', (_e, dotId) => storage.getNotesByDot(dotId));
    ipcMain.handle('storage:getAllNotes', () => storage.getAllNotes());
    ipcMain.handle('storage:saveNote', (_e, n) => {
      const saved = storage.saveNote(n);
      windowManager.broadcast('note-updated', saved);
      return saved;
    });
    ipcMain.handle('storage:deleteNote', (_e, noteId) => {
      const deleted = storage.deleteNote(noteId);
      windowManager.broadcast('note-deleted', noteId);
      return deleted;
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
