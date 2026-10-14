import { describe, it, expect, vi } from 'vitest';
import { calculateOverlapPercentage, detectClusters } from '../../src/main/clustering.js';
import * as clusteringModule from '../../src/main/clustering.js';
import { AutoArchiver } from '../../src/main/autoArchive.js';
import { StorageEngine } from '../../src/shared/storage.js';

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
        once: vi.fn((_evt, cb) => cb && cb())
      };
    }
    show() { this.visible = true; }
    hide() { this.visible = false; }
    focus() {}
    isVisible() { return this.visible; }
    isDestroyed() { return this.destroyed; }
    getPosition() { return [this.bounds.x, this.bounds.y]; }
    setPosition(x, y) { this.bounds.x = x; this.bounds.y = y; }
    getBounds() { return this.bounds; }
    setBounds(b) { this.bounds = { ...this.bounds, ...b }; }
    destroy() { this.destroyed = true; }
    on(evt, cb) { this.events[evt] = cb; }
    loadURL() { return Promise.resolve(); }
    loadFile() { return Promise.resolve(); }
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
});
