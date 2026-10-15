import { app, BrowserWindow, ipcMain, screen } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { HubSettingsSchema } from '../shared/schema.js';
import { detectClusters } from './clustering.js';

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
    this.windows = new Map(); // dotId -> BrowserWindow
    this.clusterWindows = new Map(); // clusterId -> BrowserWindow
    this.clusters = new Map(); // clusterId -> cluster data
    this.clusteredDotIds = new Set();
    this.settingsWindow = null;
    this.plusButtonWindow = null;
    this.isGhostMode = false;
    this.hubDotId = null;
    this.expandedDotIds = new Set();
    this.isProgrammaticMove = false;
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
      // Startup safety check: clamp position if invalid / off-screen / NaN / negative
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
      if (existing && !existing.isDestroyed()) {
        const settings = this.storage.getSettings();
        if (settings.displayMode !== 'hubOnly' || dot.id === this.hubDotId || dot.isHub) {
          existing.show();
          existing.focus();
        }
        return existing;
      }
      this.windows.delete(dot.id);
    }

    const settings = this.storage.getSettings();
    const isHubOnly = settings.displayMode === 'hubOnly';
    const isHub = dot.id === this.hubDotId || dot.isHub;
    const shouldShow = isHub || !isHubOnly;

    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: screenW, height: screenH } = primaryDisplay.workArea;
    let posX = dot.position?.x;
    let posY = dot.position?.y;
    if (typeof posX !== 'number' || isNaN(posX) || posX < -50 || posX > screenW + 50) {
      posX = 100;
    }
    if (typeof posY !== 'number' || isNaN(posY) || posY < -50 || posY > screenH + 50) {
      posY = 100;
    }

    let initBounds = {
      x: posX,
      y: posY,
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

    if (win.webContents && typeof win.webContents.on === 'function') {
      win.webContents.on('console-message', (_e, level, message, line, sourceId) => {
        console.log(`[RENDERER ${dot.id} L${level}] ${message} (${sourceId}:${line})`);
      });
      win.webContents.on('render-process-gone', (_e, details) => {
        console.error(`[RENDER-PROCESS-GONE ${dot.id}]`, details);
      });
    }

    const devUrl = 'http://localhost:5173';
    safeLoadWindow(win, `${devUrl}?dotId=${dot.id}`, { dotId: dot.id });

    if (isHub && process.argv.includes('--enable-logging')) {
      try {
        win.webContents.openDevTools({ mode: 'detach' });
      } catch (_) {}
    }

    win.on('moved', () => {
      this.handleDotMoved(dot.id);
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

  handleDotMoved(dotId) {
    if (this.isProgrammaticMove) return;
    const win = this.windows.get(dotId);
    if (!win || win.isDestroyed()) return;
    const isHub = dotId === this.hubDotId;
    const currentSettings = this.storage.getSettings();
    if (isHub && currentSettings.displayMode === 'hubOnly') {
      return;
    }
    const [x, y] = win.getPosition();
    const currentDot = this.storage.getDot(dotId);
    if (currentDot) {
      currentDot.position = { x, y };
      this.storage.saveDot(currentDot);
    }
    this.updateClusters();
  }

  updateClusters() {
    const settings = this.storage.getSettings();
    if (settings.displayMode === 'hubOnly') {
      for (const [_, cWin] of this.clusterWindows) {
        if (cWin && !cWin.isDestroyed()) {
          cWin.hide();
        }
      }
      return [];
    }

    const allDots = this.storage.getDots();
    const candidateDots = allDots.filter((d) => {
      if (d.isHub || d.id === this.hubDotId) return false;
      if (this.expandedDotIds && this.expandedDotIds.has(d.id)) return false;
      return d.position && typeof d.position.x === 'number' && typeof d.position.y === 'number';
    });

    const detected = detectClusters(candidateDots, 48, 0.5);
    const activeClusterIds = new Set(detected.map((c) => c.clusterId));
    const newClusteredDotIds = new Set();

    for (const cluster of detected) {
      this.clusters.set(cluster.clusterId, cluster);
      for (const dotId of cluster.dotIds) {
        newClusteredDotIds.add(dotId);
      }
    }

    // Hide dots belonging to newly detected clusters
    for (const dotId of newClusteredDotIds) {
      const win = this.windows.get(dotId);
      if (win && !win.isDestroyed()) {
        win.hide();
      }
      this.clusteredDotIds.add(dotId);
    }

    // Unhide dots that left clusters
    for (const dotId of this.clusteredDotIds) {
      if (!newClusteredDotIds.has(dotId)) {
        const win = this.windows.get(dotId);
        if (win && !win.isDestroyed()) {
          win.show();
        }
        this.clusteredDotIds.delete(dotId);
      }
    }

    // Create or update cluster badge windows
    for (const cluster of detected) {
      this.createOrUpdateClusterWindow(cluster);
    }

    // Destroy expired cluster windows
    for (const [clusterId, win] of this.clusterWindows) {
      if (!activeClusterIds.has(clusterId)) {
        if (win && !win.isDestroyed()) {
          win.destroy();
        }
        this.clusterWindows.delete(clusterId);
        this.clusters.delete(clusterId);
      }
    }

    return detected;
  }

  createOrUpdateClusterWindow(cluster) {
    let win = this.clusterWindows.get(cluster.clusterId);
    if (win && !win.isDestroyed()) {
      const bounds = win.getBounds();
      const isExpanded = bounds.width > 50;
      if (!isExpanded) {
        win.setPosition(cluster.centroid.x - 24, cluster.centroid.y - 24);
      }
      win.show();
      win.webContents.send('cluster-data-updated', cluster);
      return win;
    }

    win = new BrowserWindow({
      width: 48,
      height: 48,
      x: cluster.centroid.x - 24,
      y: cluster.centroid.y - 24,
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
        win.webContents.openDevTools({ mode: 'detach' });
      } catch (_) {}
    }

    if (win.webContents && typeof win.webContents.on === 'function') {
      win.webContents.on('console-message', (_e, level, message, line, sourceId) => {
        console.log(`[RENDERER ${cluster.clusterId} L${level}] ${message} (${sourceId}:${line})`);
      });
      win.webContents.on('render-process-gone', (_e, details) => {
        console.error(`[RENDER-PROCESS-GONE ${cluster.clusterId}]`, details);
      });
    }

    const devUrl = 'http://localhost:5173';
    const query = { view: 'cluster', clusterId: cluster.clusterId };
    safeLoadWindow(win, `${devUrl}?view=cluster&clusterId=${cluster.clusterId}`, query);

    win.on('closed', () => {
      this.clusterWindows.delete(cluster.clusterId);
    });

    this.clusterWindows.set(cluster.clusterId, win);
    return win;
  }

  setClusterState(clusterId, state) {
    const win = this.clusterWindows.get(clusterId);
    if (!win || win.isDestroyed()) return;
    const cluster = this.clusters.get(clusterId);
    if (!cluster) return;

    const primaryDisplay = screen.getPrimaryDisplay();
    const { width: scrW, height: scrH } = primaryDisplay.workArea;

    if (state === 'COLLAPSED') {
      win.setBounds({
        x: cluster.centroid.x - 24,
        y: cluster.centroid.y - 24,
        width: 48,
        height: 48
      });
    } else if (state === 'EXPANDED') {
      const cardW = 340;
      const cardH = 280;
      const targetX = Math.max(10, Math.min(scrW - cardW - 10, cluster.centroid.x - Math.round(cardW / 2)));
      const targetY = Math.max(10, Math.min(scrH - cardH - 10, cluster.centroid.y - 24));
      win.setBounds({
        x: targetX,
        y: targetY,
        width: cardW,
        height: cardH
      });
    }
  }

  getClusterData(clusterId) {
    const cluster = this.clusters.get(clusterId);
    if (!cluster) return null;
    const dots = cluster.dotIds.map((id) => this.storage.getDot(id)).filter(Boolean);
    const allNotes = this.storage.getAllNotes();
    const notes = allNotes.filter((n) => cluster.dotIds.includes(n.dotId));
    return {
      cluster,
      dots,
      notes
    };
  }

  uncluster(clusterId) {
    const cluster = this.clusters.get(clusterId);
    if (!cluster) return;
    const dots = cluster.dotIds.map((id) => this.storage.getDot(id)).filter(Boolean);
    dots.forEach((dot, index) => {
      const offset = (index + 1) * 55;
      dot.position = {
        x: cluster.centroid.x - 24 + offset,
        y: cluster.centroid.y - 24
      };
      this.storage.saveDot(dot);
      const win = this.windows.get(dot.id);
      if (win && !win.isDestroyed()) {
        win.setPosition(dot.position.x, dot.position.y);
        win.show();
      }
    });

    const clusterWin = this.clusterWindows.get(clusterId);
    if (clusterWin && !clusterWin.isDestroyed()) {
      clusterWin.destroy();
    }
    this.clusterWindows.delete(clusterId);
    this.clusters.delete(clusterId);
    for (const id of cluster.dotIds) {
      this.clusteredDotIds.delete(id);
    }
    this.updateClusters();
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
    try {
      // 1. If dot is currently part of an active cluster, handle via openDotFromCluster
      if (this.clusteredDotIds.has(dotId)) {
        this.openDotFromCluster(dotId);
        return;
      }

      // 2. Normal or Hidden (Hide to Tray): retrieve or recreate window
      let win = this.windows.get(dotId);
      if (!win || win.isDestroyed()) {
        const dot = this.storage.getDot(dotId);
        if (dot) {
          win = this.createDotWindow(dot);
        } else {
          console.warn(`[WindowManager] Dot ${dotId} not found in storage`);
          return;
        }
      }

      if (win && !win.isDestroyed()) {
        const bounds = win.getBounds();
        const primaryDisplay = screen.getPrimaryDisplay();
        const { width: screenW, height: screenH } = primaryDisplay.workArea;
        if (bounds.x < 0 || bounds.x > screenW - 60 || bounds.y < 0 || bounds.y > screenH - 60) {
          win.setPosition(100, 100);
        }
        win.show();
        win.focus();
        this.setDotState(dotId, 'EXPANDED');
        if (win.webContents && !win.webContents.isDestroyed()) {
          win.webContents.send('focus-input');
        }
      }
    } catch (err) {
      console.error(`[WindowManager] Error bringing dot ${dotId} to front:`, err);
    }
  }

  openDotFromCluster(dotId) {
    try {
      this.expandedDotIds.add(dotId);
      const activeCluster = Array.from(this.clusters.values()).find((c) =>
        c.dotIds.includes(dotId)
      );

      // Remove from clustered set
      this.clusteredDotIds.delete(dotId);

      // Get or create window for the dot being opened
      let win = this.windows.get(dotId);
      const dot = this.storage.getDot(dotId);
      if (!win || win.isDestroyed()) {
        if (dot) {
          win = this.createDotWindow(dot);
        }
      }

      if (activeCluster) {
        const remainingDotIds = activeCluster.dotIds.filter((id) => id !== dotId);

        if (remainingDotIds.length < 2) {
          // Cluster dissolves completely
          const otherDotId = remainingDotIds[0];
          if (otherDotId) {
            this.clusteredDotIds.delete(otherDotId);
            const otherWin = this.windows.get(otherDotId);
            if (otherWin && !otherWin.isDestroyed()) {
              otherWin.show();
            }
          }

          // Destroy cluster window
          const clusterWin = this.clusterWindows.get(activeCluster.clusterId);
          if (clusterWin && !clusterWin.isDestroyed()) {
            clusterWin.destroy();
          }
          this.clusterWindows.delete(activeCluster.clusterId);
          this.clusters.delete(activeCluster.clusterId);
        } else {
          // Shrink cluster
          activeCluster.dotIds = remainingDotIds;
          activeCluster.count = remainingDotIds.length;
          const clusterWin = this.clusterWindows.get(activeCluster.clusterId);
          if (clusterWin && !clusterWin.isDestroyed()) {
            clusterWin.webContents.send('cluster-data-updated', activeCluster);
          }
        }

        // Offset the opened dot slightly away from centroid so it doesn't immediately re-cluster
        if (dot && win && !win.isDestroyed()) {
          const primaryDisplay = screen.getPrimaryDisplay();
          const { width, height } = primaryDisplay.workArea;
          const newX = Math.max(20, Math.min(width - 360, (activeCluster.centroid?.x || dot.position?.x || 100) + 60));
          const newY = Math.max(20, Math.min(height - 280, (activeCluster.centroid?.y || dot.position?.y || 100) + 10));
          dot.position = { x: newX, y: newY };
          this.storage.saveDot(dot);
          this.isProgrammaticMove = true;
          win.setPosition(newX, newY);
          this.isProgrammaticMove = false;
        }
      }

      if (win && !win.isDestroyed()) {
        win.show();
        win.focus();
        this.setDotState(dotId, 'EXPANDED');
        if (win.webContents && !win.webContents.isDestroyed()) {
          win.webContents.send('focus-input');
        }
      }

      this.updateClusters();
    } catch (err) {
      console.error(`[WindowManager] Error opening dot ${dotId} from cluster:`, err);
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
    try {
      if (state === 'EXPANDED') {
        this.expandedDotIds.add(dotId);
      } else if (state === 'COLLAPSED') {
        this.expandedDotIds.delete(dotId);
      }

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
        this.updateClusters();
      } else if (state === 'EXPANDED') {
        const cardW = 340;
        const cardH = isHub ? 340 : 260;
        const primaryDisplay = screen.getPrimaryDisplay();
        const { width: screenW, height: screenH } = primaryDisplay.workArea;
        let x = bounds.x;
        let y = bounds.y;
        if (x < 10 || x + cardW > screenW || isNaN(x)) {
          x = Math.max(20, Math.min(screenW - cardW - 20, x));
        }
        if (y < 10 || y + cardH > screenH || isNaN(y)) {
          y = Math.max(20, Math.min(screenH - cardH - 20, y));
        }
        win.setBounds({
          x,
          y,
          width: cardW,
          height: cardH
        });
      }
    } catch (err) {
      console.error(`[WindowManager] Error in setDotState for ${dotId}:`, err);
    }
  }

  closeDotWindow(dotId) {
    const win = this.windows.get(dotId);
    if (win) {
      this.windows.delete(dotId);
      if (!win.isDestroyed()) {
        win.destroy();
      }
      this.clusteredDotIds.delete(dotId);
      this.expandedDotIds.delete(dotId);
      this.updateClusters();
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
    safeLoadWindow(this.settingsWindow, `${devUrl}?view=settings`, { view: 'settings' });

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
    for (const [_, win] of this.clusterWindows) {
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
      if (typeof this.plusButtonWindow.setAlwaysOnTop === 'function') {
        this.plusButtonWindow.setAlwaysOnTop(true, 'screen-saver');
      }
      this.plusButtonWindow.show();
      if (typeof this.plusButtonWindow.moveTop === 'function') {
        this.plusButtonWindow.moveTop();
      }
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

    if (typeof this.plusButtonWindow.setAlwaysOnTop === 'function') {
      this.plusButtonWindow.setAlwaysOnTop(true, 'screen-saver');
    }

    const devUrl = 'http://localhost:5173';
    safeLoadWindow(this.plusButtonWindow, `${devUrl}?view=plus-button`, { view: 'plus-button' });

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
        if (typeof this.plusButtonWindow.setAlwaysOnTop === 'function') {
          this.plusButtonWindow.setAlwaysOnTop(true, 'screen-saver');
        }
        this.plusButtonWindow.show();
        if (typeof this.plusButtonWindow.moveTop === 'function') {
          this.plusButtonWindow.moveTop();
        }
      }
    }
  }

  updateHubPosition(hubDot) {
    const settings = this.storage.getSettings();
    const win = this.windows.get(hubDot.id || this.hubDotId);
    if (!win || win.isDestroyed()) return;

    if (settings.displayMode === 'hubOnly') {
      const edge = hubDot.hubEdge || 'right';
      const bounds = win.getBounds();
      const isExpanded = bounds.width > 20 && bounds.height > 20;
      win.setBounds(this.getHubEdgeBounds(edge, isExpanded));
      win.show();
    } else {
      // In 'all' mode: make sure hub is on-screen
      const primaryDisplay = screen.getPrimaryDisplay();
      const { x: workX, y: workY, width: workW, height: workH } = primaryDisplay.workArea;
      let x = hubDot.position?.x ?? (workX + 50);
      let y = hubDot.position?.y ?? (workY + 50);
      if (isNaN(x) || x < workX || x > workX + workW - 48) x = workX + 50;
      if (isNaN(y) || y < workY || y > workY + workH - 48) y = workY + 50;
      win.setPosition(x, y);
      win.show();
    }
  }

  spawnNewDot(position, expandImmediately = false) {
    const id = `dot-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const settings = this.storage.getSettings();
    const noteId = `note-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

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

    // Position initial base clearly away from the 44x44 corner button
    // (Card is 340w x 260h; keeping 80px margin leaves at least 16px clear of the 44px button at 20px margin)
    let baseX = width - 420;
    let baseY = height - 340;

    if (corner === 'bottom-left') {
      baseX = 80;
      baseY = height - 340;
    } else if (corner === 'top-right') {
      baseX = width - 420;
      baseY = 80;
    } else if (corner === 'top-left') {
      baseX = 80;
      baseY = 80;
    }

    const dots = this.storage.getDots().filter((d) => !d.isHub && d.id !== this.hubDotId);

    // Find an unoccupied spawn position that doesn't overlap existing dots (>48px)
    // and doesn't collide with the corner plus button
    let step = 0;
    let chosenX = baseX;
    let chosenY = baseY;
    const maxSteps = 50;

    while (step < maxSteps) {
      const diagIndex = step % 6;
      const laneIndex = Math.floor(step / 6);

      // Offset along diagonal (60px step) and parallel lane (140px step)
      const offsetX = diagIndex * 60 + laneIndex * 140;
      const offsetY = diagIndex * 60;

      let candX, candY;
      if (corner === 'bottom-right') {
        candX = baseX - offsetX;
        candY = baseY - offsetY;
      } else if (corner === 'bottom-left') {
        candX = baseX + offsetX;
        candY = baseY - offsetY;
      } else if (corner === 'top-right') {
        candX = baseX - offsetX;
        candY = baseY + offsetY;
      } else {
        // 'top-left'
        candX = baseX + offsetX;
        candY = baseY + offsetY;
      }

      // Keep within comfortable screen workArea bounds
      if (candX < 20 || candX > width - 360 || candY < 20 || candY > height - 280) {
        step++;
        continue;
      }

      // Check collision with any existing dot (within 52px ensures 0% overlap when collapsed)
      const collides = dots.some((d) => {
        if (!d.position) return false;
        return Math.abs(d.position.x - candX) < 52 && Math.abs(d.position.y - candY) < 52;
      });

      if (!collides) {
        chosenX = candX;
        chosenY = candY;
        break;
      }

      step++;
    }

    const win = this.spawnNewDot({ x: chosenX, y: chosenY }, true);

    if (this.plusButtonWindow && !this.plusButtonWindow.isDestroyed()) {
      if (typeof this.plusButtonWindow.moveTop === 'function') {
        this.plusButtonWindow.moveTop();
      }
    }

    return win;
  }

  spawnDotAtCursor() {
    const cursor = screen.getCursorScreenPoint();
    return this.spawnNewDot({ x: cursor.x - 24, y: cursor.y - 24 }, true);
  }
}
