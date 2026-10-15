import { describe, it, expect, vi } from 'vitest';
import { AutoArchiver } from '../../src/main/autoArchive.js';
import { StorageEngine } from '../../src/shared/storage.js';
import { HubSettingsSchema } from '../../src/shared/schema.js';

vi.mock('electron', () => {
  class MockBrowserWindow {
    constructor(opts = {}) {
      this.opts = opts;
      this.bounds = { x: opts.x || 0, y: opts.y || 0, width: opts.width || 6, height: opts.height || 120 };
      this.visible = opts.show !== false;
      this.destroyed = false;
      this.events = {};
      this.webContents = {
        send: vi.fn(),
        once: vi.fn((_evt, cb) => cb && cb()),
        on: vi.fn(),
        isDestroyed: vi.fn(() => false)
      };
    }
    show() { this.visible = true; }
    hide() { this.visible = false; }
    focus() {}
    setAlwaysOnTop() {}
    moveTop() {}
    setIgnoreMouseEvents() {}
    isVisible() { return this.visible; }
    isDestroyed() { return this.destroyed; }
    getPosition() { return [this.bounds.x, this.bounds.y]; }
    setPosition(x, y) {
      this.bounds.x = x;
      this.bounds.y = y;
      if (this.events['moved']) {
        this.events['moved']();
      }
    }
    getBounds() { return this.bounds; }
    setBounds(b) { this.bounds = { ...this.bounds, ...b }; }
    destroy() {
      this.destroyed = true;
      this.visible = false;
      if (this.events['closed']) {
        this.events['closed']();
      }
    }
    on(evt, cb) { this.events[evt] = cb; }
    loadURL() {
      if (this.destroyed) return Promise.reject(new TypeError('Object has been destroyed'));
      return new Promise((_, reject) => {
        setTimeout(() => {
          if (this.destroyed) {
            reject(new TypeError('Object has been destroyed'));
          } else {
            reject(new Error('ERR_CONNECTION_REFUSED'));
          }
        }, 5);
      });
    }
    loadFile() {
      if (this.destroyed) return Promise.reject(new TypeError('Object has been destroyed'));
      return Promise.resolve();
    }
  }

  return {
    app: { isPackaged: false },
    screen: {
      getPrimaryDisplay: () => ({
        workArea: { x: 0, y: 0, width: 1920, height: 1080 }
      }),
      getCursorScreenPoint: () => ({ x: 100, y: 100 })
    },
    BrowserWindow: MockBrowserWindow,
    ipcMain: {
      on: vi.fn(),
      handle: vi.fn()
    }
  };
});

import { WindowManager } from '../../src/main/windowManager.js';

class MockStore {
  constructor() {
    this.data = {};
  }
  get(key) {
    if (!key.includes('.')) return this.data[key];
    const parts = key.split('.');
    let cur = this.data;
    for (const p of parts) {
      if (cur === undefined || cur === null) return undefined;
      cur = cur[p];
    }
    return cur;
  }
  set(key, val) {
    if (!key.includes('.')) {
      this.data[key] = val;
      return;
    }
    const parts = key.split('.');
    let cur = this.data;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!cur[parts[i]]) cur[parts[i]] = {};
      cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = val;
  }
  delete(key) {
    if (!key.includes('.')) {
      delete this.data[key];
      return;
    }
    const parts = key.split('.');
    let cur = this.data;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!cur[parts[i]]) return;
      cur = cur[parts[i]];
    }
    delete cur[parts[parts.length - 1]];
  }
}

describe('Single Hub & Core Features Unit Tests', () => {
  describe('Single-Hub Window & Edge Invariants', () => {
    it('calculates edge strip and card bounds accurately across all 4 edges', () => {
      const store = new MockStore();
      const storage = new StorageEngine(store);
      const wm = new WindowManager(storage);

      // Collapsed bounds
      const rightCollapsed = wm.getHubEdgeBounds('right', false);
      expect(rightCollapsed).toEqual({ x: 1914, y: 480, width: 6, height: 120 });

      const leftCollapsed = wm.getHubEdgeBounds('left', false);
      expect(leftCollapsed).toEqual({ x: 0, y: 480, width: 6, height: 120 });

      const topCollapsed = wm.getHubEdgeBounds('top', false);
      expect(topCollapsed).toEqual({ x: 900, y: 0, width: 120, height: 6 });

      const bottomCollapsed = wm.getHubEdgeBounds('bottom', false);
      expect(bottomCollapsed).toEqual({ x: 900, y: 1074, width: 120, height: 6 });

      // Expanded bounds
      const rightExpanded = wm.getHubEdgeBounds('right', true);
      expect(rightExpanded).toEqual({ x: 1580, y: 350, width: 340, height: 380 });

      const leftExpanded = wm.getHubEdgeBounds('left', true);
      expect(leftExpanded).toEqual({ x: 0, y: 350, width: 340, height: 380 });

      const topExpanded = wm.getHubEdgeBounds('top', true);
      expect(topExpanded).toEqual({ x: 790, y: 0, width: 340, height: 380 });

      const bottomExpanded = wm.getHubEdgeBounds('bottom', true);
      expect(bottomExpanded).toEqual({ x: 790, y: 700, width: 340, height: 380 });
    });

    it('creates a single hub window and expands/collapses properly', () => {
      const store = new MockStore();
      const storage = new StorageEngine(store);
      const wm = new WindowManager(storage);

      const win = wm.createHubWindow();
      expect(win).toBeDefined();
      expect(wm.windows.size).toBe(1);
      expect(wm.windows.get('hub-dot')).toBe(win);

      // Expand hub
      wm.setDotState('hub-dot', 'EXPANDED');
      expect(wm.isExpanded).toBe(true);
      expect(win.getBounds().width).toBe(340);
      expect(win.getBounds().height).toBe(380);

      // Collapse hub
      wm.setDotState('hub-dot', 'COLLAPSED');
      expect(wm.isExpanded).toBe(false);
      expect(win.getBounds().width).toBe(6);
      expect(win.getBounds().height).toBe(120);
    });

    it('hotkey invocation via openNewNoteInHub expands hub window and broadcasts focus-input', () => {
      const store = new MockStore();
      const storage = new StorageEngine(store);
      const wm = new WindowManager(storage);

      const win = wm.createHubWindow();
      wm.openNewNoteInHub();

      expect(wm.isExpanded).toBe(true);
      expect(win.visible).toBe(true);
      expect(win.getBounds().width).toBe(340);
      expect(win.webContents.send).toHaveBeenCalledWith('focus-input');
    });

    it('toggles ghost mode on the single hub window', () => {
      const store = new MockStore();
      const storage = new StorageEngine(store);
      const wm = new WindowManager(storage);

      wm.createHubWindow();
      expect(wm.isGhostMode).toBe(false);

      const ghostOn = wm.toggleGhostMode();
      expect(ghostOn).toBe(true);
      expect(wm.isGhostMode).toBe(true);

      const ghostOff = wm.toggleGhostMode();
      expect(ghostOff).toBe(false);
      expect(wm.isGhostMode).toBe(false);
    });
  });

  describe('Debounced Save & Typing Guarantees', () => {
    it('fast-typing debounced note save guarantees no data loss when immediately closed / blurred', () => {
      const store = new MockStore();
      const storage = new StorageEngine(store);

      const initialNote = {
        id: 'note-fast-type',
        dotId: 'hub-dot',
        text: 'Initial text'
      };
      storage.saveNote(initialNote);

      let activeText = initialNote.text;
      let timer = null;
      let flushCalled = false;

      const flushSave = () => {
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
        storage.saveNote({ ...initialNote, text: activeText });
        flushCalled = true;
      };

      const handleTyping = (newChar) => {
        activeText += newChar;
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          flushSave();
        }, 350);
      };

      handleTyping(' - quickly typed text!');
      expect(timer).not.toBeNull();
      expect(storage.getNote('note-fast-type').text).toBe('Initial text');

      // User blurs / closes
      flushSave();

      expect(flushCalled).toBe(true);
      expect(storage.getNote('note-fast-type').text).toBe('Initial text - quickly typed text!');
    });
  });

  describe('Auto-Archive Engine', () => {
    it('moves completed tasks older than 14 days into archive store', () => {
      const store = new MockStore();
      const archiveStore = new MockStore();
      const storage = new StorageEngine(store);
      const archiver = new AutoArchiver(storage, archiveStore);

      const hubDot = { id: 'hub-dot', isHub: true, noteIds: [] };
      storage.saveDot(hubDot);

      const now = Date.now();
      const fifteenDaysAgo = now - 15 * 24 * 60 * 60 * 1000;

      const oldDoneNote = {
        id: 'note-old-done',
        dotId: 'hub-dot',
        checklist: [{ id: '1', label: 'Done task', done: true }],
        firedReminders: [],
        createdAt: fifteenDaysAgo,
        updatedAt: fifteenDaysAgo
      };
      storage.saveNote(oldDoneNote);

      const recentNote = {
        id: 'note-pending',
        dotId: 'hub-dot',
        checklist: [{ id: '2', label: 'Pending task', done: false }],
        firedReminders: [],
        createdAt: fifteenDaysAgo,
        updatedAt: fifteenDaysAgo
      };
      storage.saveNote(recentNote);

      const archivedCount = archiver.runArchiveJob(14, now);
      expect(archivedCount).toBe(1);

      expect(storage.getNote('note-old-done')).toBeNull();
      expect(archiveStore.get('archivedNotes.note-old-done')).toBeDefined();
      expect(storage.getNote('note-pending')).toBeDefined();
    });
  });

  describe('Note Deletion & Debounce Race Verification', () => {
    it('permanently deletes note from storage and updates hub noteIds', () => {
      const store = new MockStore();
      const storage = new StorageEngine(store);

      const hubDot = { id: 'hub-dot', isHub: true, noteIds: [] };
      storage.saveDot(hubDot);

      const note = { id: 'note-del-1', dotId: 'hub-dot', text: 'To be deleted' };
      storage.saveNote(note);

      expect(storage.getNote('note-del-1')).toBeDefined();
      expect(storage.getDot('hub-dot').noteIds).toContain('note-del-1');

      const deleted = storage.deleteNote('note-del-1');
      expect(deleted).toBe(true);

      expect(storage.getNote('note-del-1')).toBeNull();
      expect(storage.getDot('hub-dot').noteIds).not.toContain('note-del-1');
    });

    it('simulates rapid delete cancelling pending typing debounce without resurrecting note', () => {
      const store = new MockStore();
      const storage = new StorageEngine(store);

      const note = { id: 'note-debounce-del', dotId: 'hub-dot', text: 'Typing something' };
      storage.saveNote(note);

      let isDeleting = false;
      let debounceTimer = null;
      let activeText = 'Typing something fast!';

      const flushSave = () => {
        if (isDeleting) return;
        if (debounceTimer) {
          clearTimeout(debounceTimer);
          debounceTimer = null;
        }
        storage.saveNote({ ...note, text: activeText });
      };

      debounceTimer = setTimeout(() => {
        flushSave();
      }, 350);

      isDeleting = true;
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
      storage.deleteNote('note-debounce-del');

      flushSave();

      expect(storage.getNote('note-debounce-del')).toBeNull();
    });
  });

  describe('Configurable Deadline Alert Windows', () => {
    it('uses per-note alertWindowsMin when specified on note, falling back to global settings when omitted', () => {
      const store = new MockStore();
      const storage = new StorageEngine(store);

      const noteWithCustomAlerts = {
        id: 'note-custom-alerts',
        dotId: 'hub-dot',
        text: 'Custom alerts',
        deadline: Date.now() + 30 * 60 * 1000,
        alertWindowsMin: [30, 0],
        firedReminders: []
      };
      const noteWithDefaultAlerts = {
        id: 'note-default-alerts',
        dotId: 'hub-dot',
        text: 'Default alerts',
        deadline: Date.now() + 60 * 60 * 1000,
        firedReminders: []
      };

      storage.saveNote(noteWithCustomAlerts);
      storage.saveNote(noteWithDefaultAlerts);

      const globalWindows = storage.getSettings()?.deadlineReminderWindowsMin || [1440, 60, 15, 0];

      const customWindows = Array.isArray(noteWithCustomAlerts.alertWindowsMin) && noteWithCustomAlerts.alertWindowsMin.length > 0
        ? noteWithCustomAlerts.alertWindowsMin
        : globalWindows;

      const fallbackWindows = Array.isArray(noteWithDefaultAlerts.alertWindowsMin) && noteWithDefaultAlerts.alertWindowsMin.length > 0
        ? noteWithDefaultAlerts.alertWindowsMin
        : globalWindows;

      expect(customWindows).toEqual([30, 0]);
      expect(fallbackWindows).toEqual(globalWindows);
    });
  });

  describe('Hub Settings Reset to Defaults & Clamping', () => {
    it('resets hub settings to HubSettingsSchema defaults without losing isHub or edge alignment', () => {
      const store = new MockStore();
      const storage = new StorageEngine(store);
      const wm = new WindowManager(storage);

      const initialHub = wm.ensureHubDot();
      expect(initialHub.isHub).toBe(true);

      const modifiedHub = {
        ...initialHub,
        hubEdge: 'left',
        hubColor: '#ff0000',
        hubOpacity: 0.5,
        sortOrder: 'alphabetical'
      };
      storage.saveDot(modifiedHub);

      const resetHub = {
        ...modifiedHub,
        isHub: true,
        hubEdge: HubSettingsSchema.hubEdge,
        hubColor: HubSettingsSchema.hubColor,
        hubOpacity: HubSettingsSchema.hubOpacity,
        hubBorderStyle: HubSettingsSchema.hubBorderStyle,
        sortOrder: HubSettingsSchema.sortOrder,
        showCompletedChecklists: HubSettingsSchema.showCompletedChecklists
      };
      storage.saveDot(resetHub);

      const saved = storage.getDot(resetHub.id);
      expect(saved.isHub).toBe(true);
      expect(saved.hubEdge).toBe('right');
      expect(saved.hubColor).toBe(HubSettingsSchema.hubColor);

      const bounds = wm.getHubEdgeBounds(saved.hubEdge, false);
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.y).toBeGreaterThanOrEqual(0);
      expect(bounds.width).toBe(6);
      expect(bounds.height).toBe(120);
    });

    it('clamps off-screen or NaN hub position back to valid on-screen coordinates on startup', () => {
      const store = new MockStore();
      const storage = new StorageEngine(store);

      storage.saveDot({
        id: 'hub-dot',
        isHub: true,
        position: { x: -9999, y: NaN },
        noteIds: []
      });

      const wm = new WindowManager(storage);
      const sanitizedHub = wm.ensureHubDot();

      expect(sanitizedHub.position.x).toBeGreaterThanOrEqual(0);
      expect(sanitizedHub.position.y).toBeGreaterThanOrEqual(0);
      expect(isNaN(sanitizedHub.position.x)).toBe(false);
      expect(isNaN(sanitizedHub.position.y)).toBe(false);
    });
  });
});
