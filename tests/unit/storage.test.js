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

  it('migrates v2 data to v3: copies dot styles to notes, keeps only hub-dot, and creates backup', () => {
    const rawStore = new MockStore();
    rawStore.set('settings', { schemaVersion: 2, defaultDotColor: '#3b82f6' });
    rawStore.set('dots', {
      'dot-old-1': {
        id: 'dot-old-1',
        position: { x: 200, y: 300 },
        color: '#ef4444',
        opacity: 0.75,
        textSize: 16,
        textColor: '#fef08a',
        blurRadius: 8,
        noteIds: ['note-old-1']
      }
    });
    rawStore.set('notes', {
      'note-old-1': {
        id: 'note-old-1',
        dotId: 'dot-old-1',
        text: 'Migrated content'
      }
    });

    const v3Storage = new StorageEngine(rawStore);

    // Verify backup created
    const backup = rawStore.get('backup_pre_hub_only');
    expect(backup).toBeDefined();
    expect(backup.dots['dot-old-1']).toBeDefined();

    // Verify note received dot styling and points to hub-dot
    const note = v3Storage.getNote('note-old-1');
    expect(note.color).toBe('#ef4444');
    expect(note.opacity).toBe(0.75);
    expect(note.textSize).toBe(16);
    expect(note.textColor).toBe('#fef08a');
    expect(note.blurRadius).toBe(8);
    expect(note.dotId).toBe('hub-dot');

    // Verify only hub-dot remains in dots
    const dots = v3Storage.getDots();
    expect(dots.length).toBe(1);
    expect(dots[0].id).toBe('hub-dot');
    expect(dots[0].isHub).toBe(true);
    expect(dots[0].noteIds).toContain('note-old-1');

    // Verify settings updated to schemaVersion 3
    expect(v3Storage.getSettings().schemaVersion).toBe(3);
    expect(v3Storage.getSettings().displayMode).toBeUndefined();
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
