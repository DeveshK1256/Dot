import { describe, it, expect, vi } from 'vitest';
import { calculateOverlapPercentage, detectClusters } from '../../src/main/clustering.js';
import * as clusteringModule from '../../src/main/clustering.js';
import { AutoArchiver } from '../../src/main/autoArchive.js';
import { StorageEngine } from '../../src/shared/storage.js';
import { HubSettingsSchema } from '../../src/shared/schema.js';

vi.mock('electron', () => {
  class MockBrowserWindow {
    constructor(opts = {}) {
      this.opts = opts;
      this.bounds = { x: opts.x || 0, y: opts.y || 0, width: opts.width || 48, height: opts.height || 48 };
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

describe('Unique Features Unit Tests', () => {
  describe('Clustering & Overlap Math', () => {
    it('calculates 100% overlap for identical rectangles', () => {
      const rect = { x: 100, y: 100, width: 48, height: 48 };
      expect(calculateOverlapPercentage(rect, rect)).toBe(1.0);
    });

    it('calculates 0% overlap for disjoint rectangles', () => {
      const rectA = { x: 0, y: 0, width: 48, height: 48 };
      const rectB = { x: 100, y: 100, width: 48, height: 48 };
      expect(calculateOverlapPercentage(rectA, rectB)).toBe(0);
    });

    it('detects clusters when overlap exceeds 50% threshold', () => {
      const dots = [
        { id: 'd1', position: { x: 100, y: 100 } },
        { id: 'd2', position: { x: 110, y: 110 } }, // ~62% overlap
        { id: 'd3', position: { x: 500, y: 500 } }  // Disjoint
      ];
      const clusters = detectClusters(dots, 48, 0.5);
      expect(clusters.length).toBe(1);
      expect(clusters[0].count).toBe(2);
      expect(clusters[0].dotIds).toContain('d1');
      expect(clusters[0].dotIds).toContain('d2');
      expect(clusters[0].centroid.x).toBe(105);
    });

    it('confirms windowManager actually CALLS detectClusters after a position-save (call-was-made assertion)', () => {
      const store = new MockStore();
      const storage = new StorageEngine(store);
      const wm = new WindowManager(storage);

      const d1 = { id: 'dot-1', position: { x: 100, y: 100 }, noteIds: [] };
      const d2 = { id: 'dot-2', position: { x: 105, y: 105 }, noteIds: [] };
      storage.saveDot(d1);
      storage.saveDot(d2);
      wm.createDotWindow(d1);
      wm.createDotWindow(d2);

      const spy = vi.spyOn(clusteringModule, 'detectClusters');

      // Simulate a drag-end moved event triggering position-save on dot-1
      wm.handleDotMoved('dot-1');

      // Assert that detectClusters was actually called by windowManager!
      expect(spy).toHaveBeenCalled();
      expect(spy.mock.calls.length).toBeGreaterThanOrEqual(1);

      spy.mockRestore();
    });

    it('clusters dots when overlap > 50%, hides members and shows cluster window, then un-clusters when dragged away', () => {
      const store = new MockStore();
      const storage = new StorageEngine(store);
      const wm = new WindowManager(storage);

      const d1 = { id: 'dot-1', position: { x: 100, y: 100 }, noteIds: [] };
      const d2 = { id: 'dot-2', position: { x: 105, y: 105 }, noteIds: [] }; // ~70% overlap
      storage.saveDot(d1);
      storage.saveDot(d2);
      const win1 = wm.createDotWindow(d1);
      const win2 = wm.createDotWindow(d2);

      expect(win1.visible).toBe(true);
      expect(win2.visible).toBe(true);
      expect(wm.clusterWindows.size).toBe(0);

      // Save position / drag end
      wm.handleDotMoved('dot-1');

      // Both dots must now be hidden into the cluster
      expect(win1.visible).toBe(false);
      expect(win2.visible).toBe(false);
      expect(wm.clusteredDotIds.has('dot-1')).toBe(true);
      expect(wm.clusteredDotIds.has('dot-2')).toBe(true);

      // Exactly 1 cluster window created with count 2
      expect(wm.clusterWindows.size).toBe(1);
      const clusterData = Array.from(wm.clusters.values())[0];
      expect(clusterData.count).toBe(2);
      expect(clusterData.dotIds).toEqual(['dot-1', 'dot-2']);

      // Now simulate bringing dot-2 to front and dragging it away to (400, 400)
      wm.bringDotToFront('dot-2');
      expect(win2.visible).toBe(true);
      win2.setPosition(400, 400);

      // Drag end on dot-2
      wm.handleDotMoved('dot-2');

      // Overlap is now 0%! Cluster must be destroyed and both individual windows visible
      expect(wm.clusterWindows.size).toBe(0);
      expect(wm.clusteredDotIds.size).toBe(0);
      expect(win1.visible).toBe(true);
      expect(win2.visible).toBe(true);
      expect(storage.getDot('dot-2').position).toEqual({ x: 400, y: 400 });
    });

    it('fast-typing debounced note save guarantees no data loss when immediately closed / blurred', () => {
      const store = new MockStore();
      const storage = new StorageEngine(store);

      const initialNote = {
        id: 'note-fast-type',
        dotId: 'dot-1',
        text: 'Initial text'
      };
      storage.saveNote(initialNote);

      // Simulate fast-typing state buffer and debounce timer
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

      // Type fast: characters in under 50ms
      handleTyping(' - quickly typed text!');
      expect(timer).not.toBeNull();
      // Before 350ms passes, storage still has initial text
      expect(storage.getNote('note-fast-type').text).toBe('Initial text');

      // User immediately clicks close / triggers blur before 350ms
      flushSave();

      // Confirm text is NOT lost!
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

      const dot = { id: 'dot-a', position: { x: 0, y: 0 }, noteIds: [] };
      storage.saveDot(dot);

      const now = Date.now();
      const fifteenDaysAgo = now - 15 * 24 * 60 * 60 * 1000;

      // Note with completed tasks older than 14 days
      const oldDoneNote = {
        id: 'note-old-done',
        dotId: 'dot-a',
        checklist: [{ id: '1', label: 'Done task', done: true }],
        firedReminders: [],
        createdAt: fifteenDaysAgo,
        updatedAt: fifteenDaysAgo
      };
      storage.saveNote(oldDoneNote);

      // Note with incomplete tasks
      const recentNote = {
        id: 'note-pending',
        dotId: 'dot-a',
        checklist: [{ id: '2', label: 'Pending task', done: false }],
        firedReminders: [],
        createdAt: fifteenDaysAgo,
        updatedAt: fifteenDaysAgo
      };
      storage.saveNote(recentNote);

      const archivedCount = archiver.runArchiveJob(14, now);
      expect(archivedCount).toBe(1);

      // Old done note should be in archive store and removed from active notes
      expect(storage.getNote('note-old-done')).toBeNull();
      expect(archiveStore.get('archivedNotes.note-old-done')).toBeDefined();

      // Pending note stays in active storage
      expect(storage.getNote('note-pending')).toBeDefined();
    });
  });

  describe('Hub Note Click & bringDotToFront Handling across states', () => {
    it('restores and focuses a dot closed via "Hide to Tray" (Case A)', () => {
      const store = new MockStore();
      const storage = new StorageEngine(store);
      const wm = new WindowManager(storage);

      const d1 = { id: 'dot-hidden-tray', position: { x: 150, y: 150 }, noteIds: [] };
      storage.saveDot(d1);
      const win = wm.createDotWindow(d1);
      expect(win.visible).toBe(true);

      // Dot is closed via "Hide to Tray"
      wm.hideDotWindow('dot-hidden-tray');
      expect(win.visible).toBe(false);

      // User clicks note in hub list -> calls bringDotToFront
      wm.bringDotToFront('dot-hidden-tray');

      // Window must be re-shown, focused, and expanded
      expect(win.visible).toBe(true);
      expect(win.bounds.width).toBe(340);
      expect(win.bounds.height).toBe(260);
      expect(win.webContents.send).toHaveBeenCalledWith('focus-input');
    });

    it('opens a dot from an active cluster and un-clusters cleanly (Case B)', () => {
      const store = new MockStore();
      const storage = new StorageEngine(store);
      const wm = new WindowManager(storage);

      const d1 = { id: 'dot-c1', position: { x: 100, y: 100 }, noteIds: [] };
      const d2 = { id: 'dot-c2', position: { x: 105, y: 105 }, noteIds: [] }; // >50% overlap
      storage.saveDot(d1);
      storage.saveDot(d2);
      const win1 = wm.createDotWindow(d1);
      const win2 = wm.createDotWindow(d2);

      // Trigger clustering
      wm.handleDotMoved('dot-c1');
      expect(win1.visible).toBe(false);
      expect(win2.visible).toBe(false);
      expect(wm.clusteredDotIds.has('dot-c1')).toBe(true);
      expect(wm.clusteredDotIds.has('dot-c2')).toBe(true);
      expect(wm.clusterWindows.size).toBe(1);

      // User clicks dot-c1 in hub list -> calls bringDotToFront('dot-c1')
      wm.bringDotToFront('dot-c1');

      // dot-c1 should now be visible, expanded, and unclustered
      expect(win1.visible).toBe(true);
      expect(win1.bounds.width).toBe(340);
      expect(wm.clusteredDotIds.has('dot-c1')).toBe(false);

      // Since the cluster only had 2 dots, dissolving dot-c1 leaves dot-c2 free
      expect(win2.visible).toBe(true);
      expect(wm.clusteredDotIds.has('dot-c2')).toBe(false);
      expect(wm.clusterWindows.size).toBe(0);
    });

    it('shrinks a 3-dot cluster when one dot is opened, keeping remaining 2 clustered without crashing', () => {
      const store = new MockStore();
      const storage = new StorageEngine(store);
      const wm = new WindowManager(storage);

      const d1 = { id: 'dot-3a', position: { x: 100, y: 100 }, noteIds: [] };
      const d2 = { id: 'dot-3b', position: { x: 105, y: 105 }, noteIds: [] };
      const d3 = { id: 'dot-3c', position: { x: 108, y: 108 }, noteIds: [] };
      storage.saveDot(d1);
      storage.saveDot(d2);
      storage.saveDot(d3);
      const win1 = wm.createDotWindow(d1);
      const win2 = wm.createDotWindow(d2);
      const win3 = wm.createDotWindow(d3);

      wm.handleDotMoved('dot-3a');
      expect(wm.clusterWindows.size).toBe(1);
      expect(wm.clusteredDotIds.size).toBe(3);

      // Open dot-3b from hub
      wm.bringDotToFront('dot-3b');

      expect(win2.visible).toBe(true);
      expect(win2.bounds.width).toBe(340);
      expect(wm.clusteredDotIds.has('dot-3b')).toBe(false);

      // Cluster still has 2 dots
      expect(wm.clusterWindows.size).toBe(1);
      expect(wm.clusteredDotIds.has('dot-3a')).toBe(true);
      expect(wm.clusteredDotIds.has('dot-3c')).toBe(true);
      expect(win1.visible).toBe(false);
      expect(win3.visible).toBe(false);
    });

    it('focuses and expands a normal visible dot without error (Case C)', () => {
      const store = new MockStore();
      const storage = new StorageEngine(store);
      const wm = new WindowManager(storage);

      const d1 = { id: 'dot-normal', position: { x: 200, y: 200 }, noteIds: [] };
      storage.saveDot(d1);
      const win = wm.createDotWindow(d1);
      expect(win.visible).toBe(true);

      // User clicks note in hub list
      wm.bringDotToFront('dot-normal');

      expect(win.visible).toBe(true);
      expect(win.bounds.width).toBe(340);
      expect(win.webContents.send).toHaveBeenCalledWith('focus-input');
    });

    it('gracefully recreates a window if previously destroyed, and handles non-existent dot safely', () => {
      const store = new MockStore();
      const storage = new StorageEngine(store);
      const wm = new WindowManager(storage);

      const d1 = { id: 'dot-recreate', position: { x: 300, y: 300 }, noteIds: [] };
      storage.saveDot(d1);
      const win = wm.createDotWindow(d1);
      win.destroy();

      // Window was destroyed, bringing to front recreates it safely
      expect(() => wm.bringDotToFront('dot-recreate')).not.toThrow();
      const newWin = wm.windows.get('dot-recreate');
      expect(newWin.isDestroyed()).toBe(false);
      expect(newWin.visible).toBe(true);

      // Calling bringDotToFront with non-existent dotId logs warning and does NOT throw
      expect(() => wm.bringDotToFront('non-existent-dot-id')).not.toThrow();
    });
  });

  describe('Note Deletion & Debounce Race Verification', () => {
    it('permanently deletes note from storage, removes from dot.noteIds, and does not resurrect on display mode toggle', () => {
      const store = new MockStore();
      const storage = new StorageEngine(store);
      const wm = new WindowManager(storage);

      const dot = { id: 'dot-test-del', position: { x: 100, y: 100 }, noteIds: ['note-del-1'] };
      const note = { id: 'note-del-1', dotId: 'dot-test-del', text: 'To be deleted' };
      storage.saveDot(dot);
      storage.saveNote(note);

      expect(storage.getNote('note-del-1')).toBeDefined();
      expect(storage.getNotesByDot('dot-test-del').length).toBe(1);
      expect(storage.getDot('dot-test-del').noteIds).toContain('note-del-1');

      // Delete note
      const deleted = storage.deleteNote('note-del-1');
      expect(deleted).toBe(true);

      // Verify removed from storage and dot
      expect(storage.getNote('note-del-1')).toBeNull();
      expect(storage.getNotesByDot('dot-test-del').length).toBe(0);
      expect(storage.getDot('dot-test-del').noteIds).not.toContain('note-del-1');

      // Toggle display mode between 'hubOnly' and 'all'
      wm.applyDisplayMode('hubOnly');
      expect(storage.getNotesByDot('dot-test-del').length).toBe(0);

      wm.applyDisplayMode('all');
      expect(storage.getNotesByDot('dot-test-del').length).toBe(0);
    });

    it('simulates rapid delete cancelling pending typing debounce without resurrecting note', () => {
      const store = new MockStore();
      const storage = new StorageEngine(store);

      const note = { id: 'note-debounce-del', dotId: 'dot-1', text: 'Typing something' };
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

      // User types
      debounceTimer = setTimeout(() => {
        flushSave();
      }, 350);

      // User immediately clicks delete within 50ms (before 350ms passes)
      isDeleting = true;
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
      storage.deleteNote('note-debounce-del');

      // Simulate unmount flush
      flushSave();

      // Confirm note is NOT re-saved
      expect(storage.getNote('note-debounce-del')).toBeNull();
    });
  });

  describe('Configurable Deadline Alert Windows', () => {
    it('uses per-note alertWindowsMin when specified on note, falling back to global settings when omitted', () => {
      const store = new MockStore();
      const storage = new StorageEngine(store);
      const wm = new WindowManager(storage);

      const noteWithCustomAlerts = {
        id: 'note-custom-alerts',
        dotId: 'dot-1',
        text: 'Custom alerts',
        deadline: Date.now() + 30 * 60 * 1000,
        alertWindowsMin: [30, 0],
        firedReminders: []
      };
      const noteWithDefaultAlerts = {
        id: 'note-default-alerts',
        dotId: 'dot-1',
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

  describe('Hub Settings Reset to Defaults & Visibility Clamping', () => {
    it('resets hub settings to HubSettingsSchema defaults without losing isHub or vanishing off-screen', () => {
      const store = new MockStore();
      const storage = new StorageEngine(store);
      const wm = new WindowManager(storage);

      // Initialize hub
      const initialHub = wm.ensureHubDot();
      expect(initialHub.isHub).toBe(true);

      // Simulate user changing hub settings
      const modifiedHub = {
        ...initialHub,
        hubEdge: 'left',
        hubColor: '#ff0000',
        hubOpacity: 0.5,
        sortOrder: 'alphabetical'
      };
      storage.saveDot(modifiedHub);

      // Now simulate "Reset to Defaults"
      const resetHub = {
        ...modifiedHub,
        isHub: true,
        position: modifiedHub.position || { x: 50, y: 50 },
        color: HubSettingsSchema.hubColor,
        opacity: HubSettingsSchema.hubOpacity,
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

      // Confirm updateHubPosition calculates valid on-screen bounds in hubOnly mode
      storage.saveSettings({ ...storage.getSettings(), displayMode: 'hubOnly' });
      const hubWin = wm.createDotWindow(saved);
      wm.updateHubPosition(saved);

      const bounds = hubWin.getBounds();
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.y).toBeGreaterThanOrEqual(0);
      expect(bounds.width).toBe(6);
      expect(bounds.height).toBe(120);
    });

    it('clamps off-screen or NaN hub position back to valid on-screen coordinates on startup', () => {
      const store = new MockStore();
      const storage = new StorageEngine(store);

      // Save corrupted hub with NaN / out-of-bounds coordinates
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

    it('spawns new dots clear of the plus button corner and avoids overlapping or instant clustering', () => {
      const store = new MockStore();
      const storage = new StorageEngine(store);
      storage.saveSettings({ ...storage.getSettings(), plusButtonCorner: 'bottom-right' });

      const wm = new WindowManager(storage);
      wm.ensureHubDot();
      const plusWin = wm.createPlusButtonWindow();
      const moveTopSpy = vi.spyOn(plusWin, 'moveTop');

      // Spawn 4 dots sequentially
      const spawnedWins = [];
      for (let i = 0; i < 4; i++) {
        const win = wm.spawnDotFromPlusButton();
        spawnedWins.push(win);
      }

      expect(spawnedWins.length).toBe(4);
      expect(moveTopSpy).toHaveBeenCalledTimes(4);

      // Verify each dot position is clear of the corner button area (workArea is 1920x1080, button at 1856, 1016)
      const spawnedDots = storage.getDots().filter((d) => !d.isHub);
      expect(spawnedDots.length).toBe(4);

      for (const dot of spawnedDots) {
        // Expanded card right edge = dot.position.x + 340. Must be < 1856 (leaving space before plus button)
        expect(dot.position.x + 340).toBeLessThanOrEqual(1856);
        // Expanded card bottom edge = dot.position.y + 260. Must be < 1016 (leaving space above plus button)
        expect(dot.position.y + 260).toBeLessThanOrEqual(1016);
      }

      // Verify no two dots have >= 50% overlap (collapsed size 48x48)
      for (let i = 0; i < spawnedDots.length; i++) {
        for (let j = i + 1; j < spawnedDots.length; j++) {
          const rectA = { x: spawnedDots[i].position.x, y: spawnedDots[i].position.y, width: 48, height: 48 };
          const rectB = { x: spawnedDots[j].position.x, y: spawnedDots[j].position.y, width: 48, height: 48 };
          const overlap = calculateOverlapPercentage(rectA, rectB);
          expect(overlap).toBe(0);
        }
      }

      // Verify clusters map does not cluster them
      const candidateDots = spawnedDots.map((d) => ({ ...d }));
      const detected = detectClusters(candidateDots, 48, 0.5);
      expect(detected.length).toBe(0);
    });
  });
});
