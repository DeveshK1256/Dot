import { describe, it, expect } from 'vitest';
import { calculateOverlapPercentage, detectClusters } from '../../src/main/clustering.js';
import { AutoArchiver } from '../../src/main/autoArchive.js';
import { StorageEngine } from '../../src/shared/storage.js';

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
