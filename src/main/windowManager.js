import { app, BrowserWindow, screen } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { HubSettingsSchema } from '../shared/schema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function safeLoadWindow(win, url, query) {
  if (!win || win.isDestroyed()) return;
  const filePath = path.join(__dirname, '../../dist/renderer/index.html');
  if (!app.isPackaged) {
    win.loadURL(url).catch(() => {
      try {
        if (!win.isDestroyed() && win.webContents && !win.webContents.isDestroyed()) {
          win.loadFile(filePath, { query }).catch(() => {});
        }
      } catch (_) {}
    });
  } else {
    try {
      if (!win.isDestroyed() && win.webContents && !win.webContents.isDestroyed()) {
        win.loadFile(filePath, { query }).catch(() => {});
      }
    } catch (_) {}
  }
}

export class WindowManager {
  constructor(storage) {
    this.storage = storage;
    this.hubWindow = null;
    this.windows = new Map(); // 'hub-dot' -> hubWindow
    this.settingsWindow = null;
    this.isGhostMode = false;
    this.hubDotId = 'hub-dot';
    this.isExpanded = false;
  }

  ensureHubDot() {
    const dots = this.storage.getDots();
    const existing = dots.find((d) => d.isHub || d.id === 'hub-dot');
    const primaryDisplay = screen.getPrimaryDisplay();
    const { x: workX, y: workY, width: workW, height: workH } = primaryDisplay.workArea;

    if (existing) {
      this.hubDotId = existing.id;
      let updated = false;
      const hubDot = { ...existing, isHub: true };
      for (const [k, v] of Object.entries(HubSettingsSchema)) {
        if (hubDot[k] === undefined) {
          hubDot[k] = v;
          updated = true;
        }
      }
      if (
        !hubDot.position ||
        typeof hubDot.position.x !== 'number' ||
        typeof hubDot.position.y !== 'number' ||
        isNaN(hubDot.position.x) ||
        isNaN(hubDot.position.y) ||
        hubDot.position.x < workX ||
        hubDot.position.x > workX + workW - 48 ||
        hubDot.position.y < workY ||
        hubDot.position.y > workY + workH - 48
      ) {
        hubDot.position = { x: workX + 50, y: workY + 50 };
        updated = true;
      }

      if (updated || !existing.isHub) {
        this.storage.saveDot(hubDot);
      }
      return hubDot;
    }

    const hubDot = {
      id: 'hub-dot',
      isHub: true,
      position: { x: workX + 50, y: workY + 50 },
      color: HubSettingsSchema.hubColor,
      opacity: HubSettingsSchema.hubOpacity,
      blurBackground: true,
      blurRadius: 12,
      expandTimerMs: 4000,
      isPinned: false,
      noteIds: [],
      hubEdge: HubSettingsSchema.hubEdge,
      hubColor: HubSettingsSchema.hubColor,
      hubOpacity: HubSettingsSchema.hubOpacity,
      hubBorderStyle: HubSettingsSchema.hubBorderStyle,
      sortOrder: HubSettingsSchema.sortOrder,
      showCompletedChecklists: HubSettingsSchema.showCompletedChecklists
    };

    this.hubDotId = 'hub-dot';
    this.storage.saveDot(hubDot);
    return hubDot;
  }

  getHubEdgeBounds(edge = 'right', isExpanded = false) {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { x: originX, y: originY, width, height } = primaryDisplay.workArea;

    if (!isExpanded) {
      const stripThickness = 6;
      const stripLength = 120;
      if (edge === 'left') {
        return {
          x: originX,
          y: originY + Math.round((height - stripLength) / 2),
          width: stripThickness,
          height: stripLength
        };
      } else if (edge === 'top') {
        return {
          x: originX + Math.round((width - stripLength) / 2),
          y: originY,
          width: stripLength,
          height: stripThickness
        };
      } else if (edge === 'bottom') {
        return {
          x: originX + Math.round((width - stripLength) / 2),
          y: originY + height - stripThickness,
          width: stripLength,
          height: stripThickness
        };
      } else {
        // 'right'
        return {
          x: originX + width - stripThickness,
          y: originY + Math.round((height - stripLength) / 2),
          width: stripThickness,
          height: stripLength
        };
      }
    } else {
      const cardWidth = 340;
      const cardHeight = Math.min(380, height - 40);
      if (edge === 'left') {
        return {
          x: originX,
          y: originY + Math.round((height - cardHeight) / 2),
          width: cardWidth,
          height: cardHeight
        };
      } else if (edge === 'top') {
        return {
          x: originX + Math.round((width - cardWidth) / 2),
          y: originY,
          width: cardWidth,
          height: cardHeight
        };
      } else if (edge === 'bottom') {
        return {
          x: originX + Math.round((width - cardWidth) / 2),
          y: originY + height - cardHeight,
          width: cardWidth,
          height: cardHeight
        };
      } else {
        // 'right'
        return {
          x: originX + width - cardWidth,
          y: originY + Math.round((height - cardHeight) / 2),
          width: cardWidth,
          height: cardHeight
        };
      }
    }
  }

  createHubWindow() {
    if (this.hubWindow && !this.hubWindow.isDestroyed()) {
      this.hubWindow.show();
      this.hubWindow.focus();
      return this.hubWindow;
    }

    const hubDot = this.ensureHubDot();
    const bounds = this.getHubEdgeBounds(hubDot.hubEdge || 'right', false);

    this.hubWindow = new BrowserWindow({
      width: bounds.width,
      height: bounds.height,
      x: bounds.x,
      y: bounds.y,
      show: true,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      hasShadow: false,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false
      }
    });

    if (process.argv.includes('--enable-logging')) {
      try {
        this.hubWindow.webContents.openDevTools({ mode: 'detach' });
      } catch (_) {}
    }

    const devUrl = 'http://localhost:5173';
    safeLoadWindow(this.hubWindow, `${devUrl}?dotId=${this.hubDotId}`, { dotId: this.hubDotId });

    this.hubWindow.on('blur', () => {
      if (this.hubWindow && !this.hubWindow.isDestroyed()) {
        this.hubWindow.webContents.send('collapse-hub');
      }
    });

    this.hubWindow.on('closed', () => {
      this.hubWindow = null;
      this.windows.delete(this.hubDotId);
    });

    this.windows.set(this.hubDotId, this.hubWindow);
    return this.hubWindow;
  }

  // Compatibility method for any legacy callers
  createDotWindow(dot) {
    return this.createHubWindow();
  }

  setDotState(dotId, state) {
    try {
      const isExpanded = state === 'EXPANDED';
      this.isExpanded = isExpanded;
      if (!this.hubWindow || this.hubWindow.isDestroyed()) return;

      const hubDot = this.storage.getDot(this.hubDotId);
      const edge = hubDot?.hubEdge || 'right';
      const newBounds = this.getHubEdgeBounds(edge, isExpanded);
      this.hubWindow.setBounds(newBounds);
    } catch (err) {
      console.error('[WindowManager] Error setting dot state:', err);
    }
  }

  updateHubPosition(hubDot) {
    if (!this.hubWindow || this.hubWindow.isDestroyed()) return;
    const edge = hubDot?.hubEdge || 'right';
    this.hubWindow.setBounds(this.getHubEdgeBounds(edge, this.isExpanded));
    this.hubWindow.show();
  }

  openNewNoteInHub() {
    if (!this.hubWindow || this.hubWindow.isDestroyed()) {
      this.createHubWindow();
    }
    if (this.hubWindow && !this.hubWindow.isDestroyed()) {
      this.setDotState(this.hubDotId, 'EXPANDED');
      this.hubWindow.show();
      this.hubWindow.focus();
      if (this.hubWindow.webContents && !this.hubWindow.webContents.isDestroyed()) {
        this.hubWindow.webContents.send('focus-input');
      }
    }
  }

  bringDotToFront(dotId) {
    this.openNewNoteInHub();
  }

  spawnDotAtCursor() {
    this.openNewNoteInHub();
  }

  spawnDotFromPlusButton() {
    this.openNewNoteInHub();
  }

  closeDotWindow(dotId) {
    if (this.hubWindow && !this.hubWindow.isDestroyed()) {
      this.hubWindow.webContents.send('collapse-hub');
    }
  }

  hideDotWindow(dotId) {
    if (this.hubWindow && !this.hubWindow.isDestroyed()) {
      this.hubWindow.webContents.send('collapse-hub');
    }
  }

  showAllHiddenDots() {
    this.openNewNoteInHub();
  }

  toggleGhostMode() {
    this.isGhostMode = !this.isGhostMode;
    if (this.hubWindow && !this.hubWindow.isDestroyed()) {
      this.hubWindow.setIgnoreMouseEvents(this.isGhostMode);
    }
    return this.isGhostMode;
  }

  openSettingsWindow() {
    if (this.settingsWindow && !this.settingsWindow.isDestroyed()) {
      this.settingsWindow.focus();
      return this.settingsWindow;
    }

    this.settingsWindow = new BrowserWindow({
      width: 420,
      height: 480,
      frame: false,
      transparent: true,
      resizable: false,
      alwaysOnTop: true,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false
      }
    });

    const devUrl = 'http://localhost:5173';
    safeLoadWindow(this.settingsWindow, `${devUrl}?view=settings`, { view: 'settings' });

    this.settingsWindow.on('closed', () => {
      this.settingsWindow = null;
    });

    return this.settingsWindow;
  }

  broadcast(channel, data) {
    if (this.hubWindow && !this.hubWindow.isDestroyed()) {
      this.hubWindow.webContents.send(channel, data);
    }
    if (this.settingsWindow && !this.settingsWindow.isDestroyed()) {
      this.settingsWindow.webContents.send(channel, data);
    }
  }
}
