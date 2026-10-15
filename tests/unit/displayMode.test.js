import { describe, it, expect, beforeEach } from 'vitest';
import { StorageEngine } from '../../src/shared/storage.js';
import { HubSettingsSchema, validateHubSettings } from '../../src/shared/schema.js';

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

// Single-Hub Controller simulator
class SingleHubSimulator {
  constructor(storage) {
    this.storage = storage;
    this.hubWindow = { visible: true, expanded: false, bounds: { x: 1914, y: 480, width: 6, height: 120 } };
    this.hubDotId = 'hub-dot';
  }

  ensureHubDot() {
    const dots = this.storage.getDots();
    const existing = dots.find((d) => d.isHub || d.id === 'hub-dot');
    if (existing) {
      this.hubDotId = existing.id;
      return existing;
    }
    const hubDot = {
      id: 'hub-dot',
      isHub: true,
      position: { x: 50, y: 50 },
      hubEdge: 'right',
      hubColor: '#4f46e5',
      hubOpacity: 0.92,
      hubBorderStyle: 'solid',
      sortOrder: 'newest',
      showCompletedChecklists: true,
      noteIds: []
    };
    this.storage.saveDot(hubDot);
    this.hubDotId = hubDot.id;
    return hubDot;
  }

  expandHub() {
    this.hubWindow.expanded = true;
    this.hubWindow.bounds = { x: 1580, y: 350, width: 340, height: 380 };
  }

  collapseHub() {
    this.hubWindow.expanded = false;
    this.hubWindow.bounds = { x: 1914, y: 480, width: 6, height: 120 };
  }

  createNewNote(initialProps = {}) {
    const id = `note-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    const newNote = {
      id,
      dotId: this.hubDotId,
      text: '',
      checklist: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      ...initialProps
    };
    this.storage.saveNote(newNote);
    this.expandHub();
    return newNote;
  }
}

describe('Single Hub Architecture & Invariants', () => {
  let store;
  let storage;
  let hub;

  beforeEach(() => {
    store = new MockStore();
    storage = new StorageEngine(store);
    hub = new SingleHubSimulator(storage);
  });

  it('initializes single hub-dot with correct defaults', () => {
    const hubDot = hub.ensureHubDot();
    expect(hubDot.id).toBe('hub-dot');
    expect(hubDot.isHub).toBe(true);
    expect(hubDot.hubEdge).toBe('right');
    expect(hubDot.hubColor).toBe('#4f46e5');
    expect(hubDot.hubOpacity).toBe(0.92);
    expect(hub.hubDotId).toBe('hub-dot');
  });

  it('creates notes directly within the single hub and updates hubDot noteIds', () => {
    hub.ensureHubDot();

    const note1 = hub.createNewNote({ text: 'Note 1' });
    const note2 = hub.createNewNote({ text: 'Note 2' });

    const allNotes = storage.getAllNotes();
    expect(allNotes.length).toBe(2);
    expect(allNotes.map((n) => n.id)).toEqual([note1.id, note2.id]);

    const hubDot = storage.getDot('hub-dot');
    expect(hubDot.noteIds).toContain(note1.id);
    expect(hubDot.noteIds).toContain(note2.id);
  });

  it('inline edits persist to storage and retain per-note styles', () => {
    hub.ensureHubDot();

    const note = hub.createNewNote({
      text: 'Original Text',
      color: '#ef4444',
      opacity: 0.8,
      textSize: 18
    });

    storage.saveNote({
      ...note,
      text: 'Updated inline text',
      textSize: 14
    });

    const retrieved = storage.getNote(note.id);
    expect(retrieved.text).toBe('Updated inline text');
    expect(retrieved.color).toBe('#ef4444');
    expect(retrieved.opacity).toBe(0.8);
    expect(retrieved.textSize).toBe(14);
  });

  it('deleting note removes from store and unlinks from hubDot', () => {
    hub.ensureHubDot();

    const note = hub.createNewNote({ text: 'To delete' });
    expect(storage.getNote(note.id)).toBeDefined();
    expect(storage.getDot('hub-dot').noteIds).toContain(note.id);

    storage.deleteNote(note.id);
    expect(storage.getNote(note.id)).toBeNull();
    expect(storage.getDot('hub-dot').noteIds).not.toContain(note.id);
  });

  describe('Hub Settings Validation & Edge Positioning', () => {
    it('validates HubSettingsSchema correctly', () => {
      expect(HubSettingsSchema.hubEdge).toBe('right');
      expect(HubSettingsSchema.hubColor).toBe('#4f46e5');
      expect(HubSettingsSchema.hubOpacity).toBe(0.92);
      expect(HubSettingsSchema.hubBorderStyle).toBe('solid');
      expect(HubSettingsSchema.sortOrder).toBe('newest');
      expect(HubSettingsSchema.showCompletedChecklists).toBe(true);

      expect(() => validateHubSettings({ hubEdge: 'invalid' })).toThrow();
      expect(() => validateHubSettings({ hubOpacity: 1.5 })).toThrow();
      expect(() => validateHubSettings({ hubBorderStyle: 'dotted' })).toThrow();
      expect(() => validateHubSettings({ sortOrder: 'random' })).toThrow();

      expect(validateHubSettings({
        hubEdge: 'left',
        hubColor: '#3b82f6',
        hubOpacity: 0.85,
        hubBorderStyle: 'dashed',
        sortOrder: 'alphabetical',
        showCompletedChecklists: false
      })).toBe(true);
    });

    it('calculates edge bounds accurately for all edges in collapsed and expanded states', () => {
      function calculateHubBounds(workArea, edge, isExpanded) {
        const { x: originX, y: originY, width, height } = workArea;
        if (!isExpanded) {
          const thickness = 6;
          const length = 120;
          if (edge === 'left') {
            return { x: originX, y: originY + Math.round((height - length) / 2), width: thickness, height: length };
          } else if (edge === 'top') {
            return { x: originX + Math.round((width - length) / 2), y: originY, width: length, height: thickness };
          } else if (edge === 'bottom') {
            return { x: originX + Math.round((width - length) / 2), y: originY + height - thickness, width: length, height: thickness };
          } else {
            return { x: originX + width - thickness, y: originY + Math.round((height - length) / 2), width: thickness, height: length };
          }
        } else {
          const cardWidth = 340;
          const cardHeight = Math.min(380, height - 40);
          if (edge === 'left') {
            return { x: originX, y: originY + Math.round((height - cardHeight) / 2), width: cardWidth, height: cardHeight };
          } else if (edge === 'top') {
            return { x: originX + Math.round((width - cardWidth) / 2), y: originY, width: cardWidth, height: cardHeight };
          } else if (edge === 'bottom') {
            return { x: originX + Math.round((width - cardWidth) / 2), y: originY + height - cardHeight, width: cardWidth, height: cardHeight };
          } else {
            return { x: originX + width - cardWidth, y: originY + Math.round((height - cardHeight) / 2), width: cardWidth, height: cardHeight };
          }
        }
      }

      const workArea = { x: 0, y: 0, width: 1920, height: 1080 };

      // Right edge
      const rightCollapsed = calculateHubBounds(workArea, 'right', false);
      expect(rightCollapsed).toEqual({ x: 1914, y: 480, width: 6, height: 120 });
      const rightExpanded = calculateHubBounds(workArea, 'right', true);
      expect(rightExpanded).toEqual({ x: 1580, y: 350, width: 340, height: 380 });

      // Left edge
      const leftCollapsed = calculateHubBounds(workArea, 'left', false);
      expect(leftCollapsed).toEqual({ x: 0, y: 480, width: 6, height: 120 });
      const leftExpanded = calculateHubBounds(workArea, 'left', true);
      expect(leftExpanded).toEqual({ x: 0, y: 350, width: 340, height: 380 });

      // Top edge
      const topCollapsed = calculateHubBounds(workArea, 'top', false);
      expect(topCollapsed).toEqual({ x: 900, y: 0, width: 120, height: 6 });

      // Bottom edge
      const bottomCollapsed = calculateHubBounds(workArea, 'bottom', false);
      expect(bottomCollapsed).toEqual({ x: 900, y: 1074, width: 120, height: 6 });
    });

    it('sorts notes correctly according to sortOrder setting', () => {
      const sampleNotes = [
        { id: '1', text: 'Zebra task', createdAt: 100 },
        { id: '2', text: 'Apple task', createdAt: 300 },
        { id: '3', text: 'Banana task', createdAt: 200 }
      ];

      function sortNotes(notes, order) {
        return [...notes].sort((a, b) => {
          if (order === 'oldest') return (a.createdAt || 0) - (b.createdAt || 0);
          if (order === 'alphabetical') return (a.text || '').trim().localeCompare((b.text || '').trim());
          return (b.createdAt || 0) - (a.createdAt || 0);
        });
      }

      const newest = sortNotes(sampleNotes, 'newest');
      expect(newest.map(n => n.id)).toEqual(['2', '3', '1']);

      const oldest = sortNotes(sampleNotes, 'oldest');
      expect(oldest.map(n => n.id)).toEqual(['1', '3', '2']);

      const alphabetical = sortNotes(sampleNotes, 'alphabetical');
      expect(alphabetical.map(n => n.id)).toEqual(['2', '3', '1']);
    });
  });
});
