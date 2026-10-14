import { describe, it, expect, beforeEach } from 'vitest';
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

describe('StorageEngine Unit Tests', () => {
  let mockStore;
  let storage;

  beforeEach(() => {
    mockStore = new MockStore();
    storage = new StorageEngine(mockStore);
  });

  it('initializes default settings, dots, and notes', () => {
    const settings = storage.getSettings();
    expect(settings).toBeDefined();
    expect(settings.defaultOpacity).toBe(0.88);
    expect(storage.getDots()).toEqual([]);
  });

  it('saves and retrieves dot and cascades note links', () => {
    const dot = {
      id: 'dot-1',
      position: { x: 50, y: 80 },
      color: '#ff0000',
      opacity: 0.9,
      noteIds: []
    };
    storage.saveDot(dot);

    const note = {
      id: 'note-1',
      dotId: 'dot-1',
      text: 'First test note',
      checklist: [],
      firedReminders: []
    };
    storage.saveNote(note);

    const updatedDot = storage.getDot('dot-1');
    expect(updatedDot.noteIds).toContain('note-1');

    const notes = storage.getNotesByDot('dot-1');
    expect(notes.length).toBe(1);
    expect(notes[0].text).toBe('First test note');
  });

  it('deletes dot and removes all child notes safely', () => {
    storage.saveDot({ id: 'dot-2', position: { x: 10, y: 10 }, noteIds: [] });
    storage.saveNote({ id: 'note-2', dotId: 'dot-2', checklist: [], firedReminders: [] });

    expect(storage.getNote('note-2')).toBeDefined();

    storage.deleteDot('dot-2', true);

    expect(storage.getDot('dot-2')).toBeNull();
    expect(storage.getNote('note-2')).toBeNull();
  });

  it('supports displayMode in settings and validates valid options', () => {
    const defaultSettings = storage.getSettings();
    expect(defaultSettings.displayMode).toBe('all');

    // Update to hubOnly
    storage.saveSettings({ ...defaultSettings, displayMode: 'hubOnly' });
    expect(storage.getSettings().displayMode).toBe('hubOnly');

    // Switch back to all
    storage.saveSettings({ ...defaultSettings, displayMode: 'all' });
    expect(storage.getSettings().displayMode).toBe('all');

    // Rejects invalid mode
    expect(() => {
      storage.saveSettings({ ...defaultSettings, displayMode: 'invalidMode' });
    }).toThrow();
  });

  it('retrieves all notes across multiple dots via getAllNotes', () => {
    storage.saveDot({ id: 'dot-a', position: { x: 0, y: 0 }, noteIds: [] });
    storage.saveDot({ id: 'dot-b', position: { x: 10, y: 10 }, noteIds: [] });

    storage.saveNote({ id: 'note-a1', dotId: 'dot-a', text: 'Note A1' });
    storage.saveNote({ id: 'note-b1', dotId: 'dot-b', text: 'Note B1' });

    const all = storage.getAllNotes();
    expect(all.length).toBe(2);
    const ids = all.map((n) => n.id);
    expect(ids).toContain('note-a1');
    expect(ids).toContain('note-b1');
  });
});
