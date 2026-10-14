import { app, BrowserWindow, ipcMain, screen } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { HubSettingsSchema } from '../shared/schema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class WindowManager {
  constructor(storage) {
    this.storage = storage;
    this.windows = new Map(); // dotId -> BrowserWindow
    this.settingsWindow = null;
    this.plusButtonWindow = null;
    this.isGhostMode = false;
    this.hubDotId = null;
  }

  ensureHubDot() {
    const dots = this.storage.getDots();
    const existing = dots.find((d) => d.isHub || d.id === 'hub-dot');
    if (existing) {
      this.hubDotId = existing.id;
      // Ensure missing HubSettingsSchema fields are populated for backward compatibility
      let updated = false;
      const hubDot = { ...existing };
      for (const [k, v] of Object.entries(HubSettingsSchema)) {
        if (hubDot[k] === undefined) {
          hubDot[k] = v;
          updated = true;
        }
      }
      if (updated) {
        this.storage.saveDot(hubDot);
      }
      return hubDot;
    }

    const hubDot = {
      id: 'hub-dot',
      isHub: true,
      position: { x: 50, y: 50 },
      color: HubSettingsSchema.hubColor,
      opacity: HubSettingsSchema.hubOpacity,
      blurBackground: true,
      blurRadius: 12,
      expandTimerMs: 6000,
      isPinned: false,
      noteIds: [],
      hubEdge: HubSettingsSchema.hubEdge,
      hubColor: HubSettingsSchema.hubColor,
      hubOpacity: HubSettingsSchema.hubOpacity,
      hubBorderStyle: HubSettingsSchema.hubBorderStyle,
      sortOrder: HubSettingsSchema.sortOrder,
      showCompletedChecklists: HubSettingsSchema.showCompletedChecklists
    };
    this.storage.saveDot(hubDot);
    this.hubDotId = hubDot.id;
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

  createDotWindow(dot) {
    if (this.windows.has(dot.id)) {
      const existing = this.windows.get(dot.id);
      const settings = this.storage.getSettings();
      if (settings.displayMode !== 'hubOnly' || dot.id === this.hubDotId || dot.isHub) {
        existing.show();
        existing.focus();
      }
      return existing;
    }

    const settings = this.storage.getSettings();
    const isHubOnly = settings.displayMode === 'hubOnly';
    const isHub = dot.id === this.hubDotId || dot.isHub;
    const shouldShow = isHub || !isHubOnly;

    let initBounds = {
      x: dot.position.x,
      y: dot.position.y,
      width: 48,
      height: 48
    };

    if (isHub && isHubOnly) {
      initBounds = this.getHubEdgeBounds(dot.hubEdge || 'right', false);
    }

    const win = new BrowserWindow({
      width: initBounds.width,
      height: initBounds.height,
      x: initBounds.x,
      y: initBounds.y,
      show: shouldShow,
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

    // In dev mode load vite server or file in production
    const devUrl = 'http://localhost:5173';
    win.loadURL(`${devUrl}?dotId=${dot.id}`).catch(() => {
      win.loadFile(path.join(__dirname, '../../dist/renderer/index.html'), {
        query: { dotId: dot.id }
      });
    });

    win.on('moved', () => {
      const currentSettings = this.storage.getSettings();
      if (isHub && currentSettings.displayMode === 'hubOnly') {
        return;
      }
      const [x, y] = win.getPosition();
      const currentDot = this.storage.getDot(dot.id);
      if (currentDot) {
        currentDot.position = { x, y };
        this.storage.saveDot(currentDot);
      }
    });

    if (isHub) {
      win.on('blur', () => {
        const currentSettings = this.storage.getSettings();
        if (currentSettings.displayMode === 'hubOnly') {
          win.webContents.send('collapse-hub');
        }
      });
    }

    this.windows.set(dot.id, win);
    return win;
  }

  applyDisplayMode(mode) {
    const hubDot = this.storage.getDot(this.hubDotId);
    const hubWin = this.windows.get(this.hubDotId);

    for (const [dotId, win] of this.windows) {
      if (!win || win.isDestroyed()) continue;
      if (dotId === this.hubDotId) {
        win.show();
      } else {
        if (mode === 'hubOnly') {
          win.hide();
        } else {
          win.show();
        }
      }
    }

    if (hubWin && !hubWin.isDestroyed()) {
      if (mode === 'hubOnly') {
        const edge = hubDot?.hubEdge || 'right';
        hubWin.setBounds(this.getHubEdgeBounds(edge, false));
      } else {
        const pos = hubDot?.position || { x: 50, y: 50 };
        hubWin.setBounds({
          x: pos.x,
          y: pos.y,
          width: 48,
          height: 48
        });
      }
    }

    // Hide plusButton in hubOnly mode, show in 'all' if showPlusButton !== false
    const settings = this.storage.getSettings();
    if (mode === 'hubOnly') {
      if (this.plusButtonWindow && !this.plusButtonWindow.isDestroyed()) {
        this.plusButtonWindow.hide();
      }
    } else {
      if (settings.showPlusButton !== false) {
        if (this.plusButtonWindow && !this.plusButtonWindow.isDestroyed()) {
          this.plusButtonWindow.show();
        } else {
          this.createPlusButtonWindow();
        }
      }
    }

    this.broadcast('display-mode-changed', mode);
  }

  bringDotToFront(dotId) {
    let win = this.windows.get(dotId);
    if (!win || win.isDestroyed()) {
      const dot = this.storage.getDot(dotId);
      if (dot) {
        win = this.createDotWindow(dot);
      }
    }
    if (win && !win.isDestroyed()) {
      win.show();
      win.focus();
      this.setDotState(dotId, 'EXPANDED');
      win.webContents.send('focus-input');
    }
  }

  hideDotWindow(dotId) {
    const win = this.windows.get(dotId);
    if (win && !win.isDestroyed()) {
      this.setDotState(dotId, 'COLLAPSED');
      win.hide();
    }
  }

  showAllHiddenDots() {
    const settings = this.storage.getSettings();
    if (settings.displayMode === 'hubOnly') {
      const updated = { ...settings, displayMode: 'all' };
      this.storage.saveSettings(updated);
      this.broadcast('settings-updated', updated);
      this.broadcast('display-mode-changed', 'all');
    }

    const dots = this.storage.getDots();
    for (const dot of dots) {
      if (dot.isHub || dot.id === this.hubDotId) continue;
      let win = this.windows.get(dot.id);
      if (!win || win.isDestroyed()) {
        win = this.createDotWindow(dot);
      }
      if (win && !win.isDestroyed()) {
        win.show();
      }
    }
  }

  setDotState(dotId, state) {
    const win = this.windows.get(dotId);
    if (!win || win.isDestroyed()) return;

    const isHub = dotId === this.hubDotId;
    const settings = this.storage.getSettings();

    if (isHub && settings.displayMode === 'hubOnly') {
      const hubDot = this.storage.getDot(dotId);
      const edge = hubDot?.hubEdge || 'right';
      const newBounds = this.getHubEdgeBounds(edge, state === 'EXPANDED');
      win.setBounds(newBounds);
      return;
    }

    const bounds = win.getBounds();
    if (state === 'COLLAPSED') {
      win.setBounds({
        x: bounds.x,
        y: bounds.y,
        width: 48,
        height: 48
      });
    } else if (state === 'EXPANDED') {
      win.setBounds({
        x: bounds.x,
        y: bounds.y,
        width: 340,
        height: isHub ? 340 : 260
      });
    }
  }

  closeDotWindow(dotId) {
    const win = this.windows.get(dotId);
    if (win) {
      this.windows.delete(dotId);
      if (!win.isDestroyed()) {
        win.destroy();
      }
    }
  }

  toggleGhostMode() {
    this.isGhostMode = !this.isGhostMode;
    for (const [_, win] of this.windows) {
      if (!win.isDestroyed()) {
        win.setIgnoreMouseEvents(this.isGhostMode, { forward: true });
        win.webContents.send('ghost-mode-toggle', this.isGhostMode);
      }
    }
    return this.isGhostMode;
  }

  openSettingsWindow() {
    if (this.settingsWindow && !this.settingsWindow.isDestroyed()) {
      this.settingsWindow.show();
      this.settingsWindow.focus();
      return this.settingsWindow;
    }

    this.settingsWindow = new BrowserWindow({
      width: 420,
      height: 520,
      title: 'Dot Settings',
      resizable: false,
      minimizable: false,
      maximizable: false,
      autoHideMenuBar: true,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false
      }
    });

    const devUrl = 'http://localhost:5173';
    this.settingsWindow.loadURL(`${devUrl}?view=settings`).catch(() => {
      this.settingsWindow.loadFile(path.join(__dirname, '../../dist/renderer/index.html'), {
        query: { view: 'settings' }
      });
    });

    this.settingsWindow.on('closed', () => {
      this.settingsWindow = null;
    });

    return this.settingsWindow;
  }

  broadcast(channel, data) {
    for (const [_, win] of this.windows) {
      if (!win.isDestroyed()) {
        win.webContents.send(channel, data);
      }
    }
    if (this.settingsWindow && !this.settingsWindow.isDestroyed()) {
      this.settingsWindow.webContents.send(channel, data);
    }
    if (this.plusButtonWindow && !this.plusButtonWindow.isDestroyed()) {
      this.plusButtonWindow.webContents.send(channel, data);
    }
  }

  getCornerPosition(corner = 'bottom-right', buttonSize = 44, margin = 24) {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workArea;

    let x = width - buttonSize - margin;
    let y = height - buttonSize - margin;

    if (corner === 'bottom-left') {
      x = margin;
      y = height - buttonSize - margin;
    } else if (corner === 'top-right') {
      x = width - buttonSize - margin;
      y = margin;
    } else if (corner === 'top-left') {
      x = margin;
      y = margin;
    }

    return { x, y };
  }

  createPlusButtonWindow() {
    const settings = this.storage.getSettings();
    if (settings.showPlusButton === false || settings.displayMode === 'hubOnly') {
      if (this.plusButtonWindow && !this.plusButtonWindow.isDestroyed()) {
        this.plusButtonWindow.destroy();
        this.plusButtonWindow = null;
      }
      return null;
    }

    if (this.plusButtonWindow && !this.plusButtonWindow.isDestroyed()) {
      const pos = this.getCornerPosition(settings.plusButtonCorner);
      this.plusButtonWindow.setPosition(pos.x, pos.y);
      this.plusButtonWindow.show();
      return this.plusButtonWindow;
    }

    const pos = this.getCornerPosition(settings.plusButtonCorner);

    this.plusButtonWindow = new BrowserWindow({
      width: 44,
      height: 44,
      x: pos.x,
      y: pos.y,
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

    const devUrl = 'http://localhost:5173';
    this.plusButtonWindow.loadURL(`${devUrl}?view=plus-button`).catch(() => {
      this.plusButtonWindow.loadFile(path.join(__dirname, '../../dist/renderer/index.html'), {
        query: { view: 'plus-button' }
      });
    });

    this.plusButtonWindow.on('closed', () => {
      this.plusButtonWindow = null;
    });

    return this.plusButtonWindow;
  }

  updatePlusButtonWindow(settings) {
    if (settings.showPlusButton === false || settings.displayMode === 'hubOnly') {
      if (this.plusButtonWindow && !this.plusButtonWindow.isDestroyed()) {
        this.plusButtonWindow.hide();
      }
    } else {
      if (!this.plusButtonWindow || this.plusButtonWindow.isDestroyed()) {
        this.createPlusButtonWindow();
      } else {
        const pos = this.getCornerPosition(settings.plusButtonCorner);
        this.plusButtonWindow.setPosition(pos.x, pos.y);
        this.plusButtonWindow.show();
      }
    }
  }

  updateHubPosition(hubDot) {
    const settings = this.storage.getSettings();
    if (settings.displayMode === 'hubOnly') {
      const win = this.windows.get(hubDot.id || this.hubDotId);
      if (win && !win.isDestroyed()) {
        const edge = hubDot.hubEdge || 'right';
        const bounds = win.getBounds();
        const isExpanded = bounds.width > 20 && bounds.height > 20;
        win.setBounds(this.getHubEdgeBounds(edge, isExpanded));
      }
    }
  }

  spawnNewDot(position, expandImmediately = false) {
    const id = `dot-${Date.now()}`;
    const settings = this.storage.getSettings();
    const noteId = `note-${Date.now()}`;

    const initialNote = {
      id: noteId,
      dotId: id,
      text: '',
      checklist: [],
      deadline: null,
      firedReminders: [],
      textSize: settings?.defaultTextSize ?? 14,
      textColor: settings?.defaultTextColor ?? '#ffffff',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    this.storage.saveNote(initialNote);

    const newDot = {
      id,
      position: position || { x: 100, y: 100 },
      color: settings?.defaultDotColor || '#3b82f6',
      opacity: settings?.defaultOpacity ?? 0.88,
      blurBackground: true,
      blurRadius: settings?.defaultBlurRadius ?? 12,
      expandTimerMs: settings?.defaultExpandTimerMs ?? 4000,
      isPinned: false,
      noteIds: [noteId]
    };
    this.storage.saveDot(newDot);
    const win = this.createDotWindow(newDot);

    const isHubOnly = settings.displayMode === 'hubOnly';

    if (expandImmediately && !isHubOnly) {
      this.setDotState(id, 'EXPANDED');
      win.webContents.once('did-finish-load', () => {
        win.webContents.send('focus-input');
      });
    }

    this.broadcast('dot-updated', newDot);
    this.broadcast('note-updated', initialNote);

    return win;
  }

  spawnDotFromPlusButton() {
    const settings = this.storage.getSettings();
    const corner = settings.plusButtonCorner || 'bottom-right';
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.workArea;

    // Calculate initial target based on corner, offset towards screen center
    let baseX = width - 360;
    let baseY = height - 280;

    if (corner === 'bottom-left') {
      baseX = 60;
      baseY = height - 280;
    } else if (corner === 'top-right') {
      baseX = width - 360;
      baseY = 60;
    } else if (corner === 'top-left') {
      baseX = 60;
      baseY = 60;
    }

    // Cascade slightly from existing dots
    const dots = this.storage.getDots();
    const cascadeOffset = (dots.length % 5) * 24;
    const x = Math.max(20, Math.min(width - 340, baseX - cascadeOffset));
    const y = Math.max(20, Math.min(height - 260, baseY - cascadeOffset));

    return this.spawnNewDot({ x, y }, true);
  }

  spawnDotAtCursor() {
    const cursor = screen.getCursorScreenPoint();
    return this.spawnNewDot({ x: cursor.x - 24, y: cursor.y - 24 }, true);
  }
}
