import { describe, it, expect, beforeEach } from 'vitest';
import { StorageEngine } from '../../src/shared/storage.js';
import { DefaultSettings, HubSettingsSchema, validateHubSettings } from '../../src/shared/schema.js';

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

// Simulated WindowManager behavior
class WindowManagerSimulator {
  constructor(storage) {
    this.storage = storage;
    this.windows = new Map(); // dotId -> { visible: boolean, position: {x, y}, expanded: boolean }
    this.hubDotId = null;
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
      color: '#4f46e5',
      noteIds: []
    };
    this.storage.saveDot(hubDot);
    this.hubDotId = hubDot.id;
    return hubDot;
  }

  createDotWindow(dot) {
    const settings = this.storage.getSettings();
    const isHubOnly = settings.displayMode === 'hubOnly';
    const isHub = dot.id === this.hubDotId || dot.isHub;
    const visible = isHub || !isHubOnly;

    this.windows.set(dot.id, {
      visible,
      position: { ...dot.position },
      expanded: false
    });
  }

  applyDisplayMode(mode) {
    for (const [dotId, win] of this.windows) {
      if (dotId === this.hubDotId) {
        win.visible = true;
      } else {
        win.visible = mode !== 'hubOnly';
      }
    }
  }

  bringDotToFront(dotId) {
    let win = this.windows.get(dotId);
    if (!win) {
      const dot = this.storage.getDot(dotId);
      if (dot) {
        this.createDotWindow(dot);
        win = this.windows.get(dotId);
      }
    }
    if (win) {
      win.visible = true;
      win.expanded = true;
    }
  }

  hideDotWindow(dotId) {
    const win = this.windows.get(dotId);
    if (win) {
      win.visible = false;
      win.expanded = false;
    }
  }

  closeDotWindow(dotId) {
    this.windows.delete(dotId);
  }

  showAllHiddenDots() {
    const settings = this.storage.getSettings();
    if (settings.displayMode === 'hubOnly') {
      const updated = { ...settings, displayMode: 'all' };
      this.storage.saveSettings(updated);
    }
    const dots = this.storage.getDots();
    for (const dot of dots) {
      if (dot.isHub || dot.id === this.hubDotId) continue;
      let win = this.windows.get(dot.id);
      if (!win) {
        this.createDotWindow(dot);
        win = this.windows.get(dot.id);
      }
      win.visible = true;
    }
  }

  spawnNewDot(position) {
    const id = `dot-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    const settings = this.storage.getSettings();
    const noteId = `note-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;

    const initialNote = {
      id: noteId,
      dotId: id,
      text: '',
      checklist: []
    };
    this.storage.saveNote(initialNote);

    const newDot = {
      id,
      position: position || { x: 100, y: 100 },
      noteIds: [noteId]
    };
    this.storage.saveDot(newDot);
    this.createDotWindow(newDot);

    return { dot: newDot, note: initialNote };
  }
}

describe('Display Mode & Hub Dot Invariants', () => {
  let store;
  let storage;
  let wm;

  beforeEach(() => {
    store = new MockStore();
    storage = new StorageEngine(store);
    wm = new WindowManagerSimulator(storage);
  });

  it('initializes with default displayMode = all and ensures Hub Dot exists', () => {
    const settings = storage.getSettings();
    expect(settings.displayMode).toBe('all');

    const hubDot = wm.ensureHubDot();
    expect(hubDot.id).toBe('hub-dot');
    expect(hubDot.isHub).toBe(true);
    expect(wm.hubDotId).toBe('hub-dot');
  });

  it('switching to hubOnly hides all floating dot windows while keeping hubDot visible', () => {
    wm.ensureHubDot();
    wm.createDotWindow(storage.getDot('hub-dot'));

    // Create 2 normal floating dots
    const d1 = wm.spawnNewDot({ x: 200, y: 300 });
    const d2 = wm.spawnNewDot({ x: 400, y: 500 });

    // Initially in 'all' mode: all windows are visible
    expect(wm.windows.get('hub-dot').visible).toBe(true);
    expect(wm.windows.get(d1.dot.id).visible).toBe(true);
    expect(wm.windows.get(d2.dot.id).visible).toBe(true);

    // Switch to 'hubOnly'
    storage.saveSettings({ ...storage.getSettings(), displayMode: 'hubOnly' });
    wm.applyDisplayMode('hubOnly');

    // Hub stays visible, floating dots are hidden (not destroyed)
    expect(wm.windows.get('hub-dot').visible).toBe(true);
    expect(wm.windows.get(d1.dot.id).visible).toBe(false);
    expect(wm.windows.get(d2.dot.id).visible).toBe(false);

    // Positions are completely preserved
    expect(wm.windows.get(d1.dot.id).position).toEqual({ x: 200, y: 300 });
    expect(wm.windows.get(d2.dot.id).position).toEqual({ x: 400, y: 500 });
  });

  it('creating a dot in hubOnly mode creates the window hidden and adds it to the hub list', () => {
    wm.ensureHubDot();
    wm.createDotWindow(storage.getDot('hub-dot'));

    storage.saveSettings({ ...storage.getSettings(), displayMode: 'hubOnly' });
    wm.applyDisplayMode('hubOnly');

    // Spawn new dot while in hubOnly mode
    const spawned = wm.spawnNewDot({ x: 600, y: 600 });

    // The newly created window must be hidden
    expect(wm.windows.get(spawned.dot.id).visible).toBe(false);

    // But note and dot exist immediately in storage
    const allNotes = storage.getAllNotes();
    expect(allNotes.map((n) => n.id)).toContain(spawned.note.id);
  });

  it('inline edits in hubOnly persist to note data and remain visible when returning to all', () => {
    wm.ensureHubDot();
    wm.createDotWindow(storage.getDot('hub-dot'));

    const { dot, note } = wm.spawnNewDot({ x: 150, y: 150 });

    // Switch to hubOnly
    storage.saveSettings({ ...storage.getSettings(), displayMode: 'hubOnly' });
    wm.applyDisplayMode('hubOnly');

    // Perform inline edit
    storage.saveNote({ ...note, text: 'Edited inline from Hub view' });

    // Switch back to 'all'
    storage.saveSettings({ ...storage.getSettings(), displayMode: 'all' });
    wm.applyDisplayMode('all');

    // All windows re-shown
    expect(wm.windows.get(dot.id).visible).toBe(true);

    // Content in note reflects the inline edit without loss
    const retrievedNote = storage.getNote(note.id);
    expect(retrievedNote.text).toBe('Edited inline from Hub view');
  });

  it('persists displayMode across app restarts', () => {
    wm.ensureHubDot();
    wm.spawnNewDot({ x: 100, y: 100 });

    // User closes app in hubOnly mode
    storage.saveSettings({ ...storage.getSettings(), displayMode: 'hubOnly' });

    // Simulate app restart with same underlying storage
    const newStorage = new StorageEngine(store);
    expect(newStorage.getSettings().displayMode).toBe('hubOnly');

    const newWm = new WindowManagerSimulator(newStorage);
    newWm.ensureHubDot();
    for (const d of newStorage.getDots()) {
      newWm.createDotWindow(d);
    }

    // Hub is visible, floating dot is created hidden
    expect(newWm.windows.get('hub-dot').visible).toBe(true);
    const nonHubDots = newStorage.getDots().filter((d) => !d.isHub);
    for (const d of nonHubDots) {
      expect(newWm.windows.get(d.id).visible).toBe(false);
    }
  });

  it('Hide to Tray keeps the window object alive, and Hub bringDotToFront un-hides it with notes intact', () => {
    wm.ensureHubDot();
    const { dot, note } = wm.spawnNewDot({ x: 250, y: 350 });

    // Save note text
    storage.saveNote({ ...note, text: 'My secret note content' });

    // User clicks X and selects "Hide to Tray"
    wm.hideDotWindow(dot.id);

    // Window is hidden, but NOT destroyed
    expect(wm.windows.has(dot.id)).toBe(true);
    expect(wm.windows.get(dot.id).visible).toBe(false);

    // Reopen via Hub list bringDotToFront
    wm.bringDotToFront(dot.id);

    // Window is visible and expanded again
    expect(wm.windows.get(dot.id).visible).toBe(true);
    expect(wm.windows.get(dot.id).expanded).toBe(true);

    // Content is completely preserved
    const noteAfter = storage.getNote(note.id);
    expect(noteAfter.text).toBe('My secret note content');
  });

  it('Reopen via bringDotToFront recovers and recreates a window if it was previously destroyed', () => {
    wm.ensureHubDot();
    const { dot, note } = wm.spawnNewDot({ x: 300, y: 400 });
    storage.saveNote({ ...note, text: 'Content survives even if window was destroyed' });

    // Simulate window destruction (e.g. killed by OS / memory reclaim)
    wm.closeDotWindow(dot.id);
    expect(wm.windows.has(dot.id)).toBe(false);

    // Reopen via Hub list
    wm.bringDotToFront(dot.id);

    // Window is recreated from storage
    expect(wm.windows.has(dot.id)).toBe(true);
    expect(wm.windows.get(dot.id).visible).toBe(true);
    expect(wm.windows.get(dot.id).expanded).toBe(true);

    // Content is intact
    const currentNote = storage.getNote(note.id);
    expect(currentNote.text).toBe('Content survives even if window was destroyed');
  });

  it('Show All Hidden Dots unhides all dots at once and preserves content', () => {
    wm.ensureHubDot();
    const d1 = wm.spawnNewDot({ x: 100, y: 100 });
    const d2 = wm.spawnNewDot({ x: 200, y: 200 });
    storage.saveNote({ ...d1.note, text: 'Note 1' });
    storage.saveNote({ ...d2.note, text: 'Note 2' });

    // Hide both dots to tray
    wm.hideDotWindow(d1.dot.id);
    wm.hideDotWindow(d2.dot.id);
    expect(wm.windows.get(d1.dot.id).visible).toBe(false);
    expect(wm.windows.get(d2.dot.id).visible).toBe(false);

    // User chooses "Show All Hidden Dots" from tray menu
    wm.showAllHiddenDots();

    // Both dots become visible again
    expect(wm.windows.get(d1.dot.id).visible).toBe(true);
    expect(wm.windows.get(d2.dot.id).visible).toBe(true);
    expect(storage.getNote(d1.note.id).text).toBe('Note 1');
    expect(storage.getNote(d2.note.id).text).toBe('Note 2');
  });

  describe('Hub-Only Mode Redesign & Hub Settings', () => {
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
