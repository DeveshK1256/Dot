import { validateDot, validateNote, validateSettings, DefaultSettings } from './schema.js';

export class StorageEngine {
  constructor(storeInstance) {
    this.store = storeInstance;
    this.init();
  }

  init() {
    if (!this.store.get('settings')) {
      this.store.set('settings', DefaultSettings);
    } else {
      // Ensure all default keys exist if upgrading from older config
      const current = this.store.get('settings');
      this.store.set('settings', { ...DefaultSettings, ...current });
    }
    if (!this.store.get('dots')) {
      this.store.set('dots', {});
    }
    if (!this.store.get('notes')) {
      this.store.set('notes', {});
    }
  }

  // Settings
  getSettings() {
    const s = this.store.get('settings') || {};
    return { ...DefaultSettings, ...s };
  }

  saveSettings(settings) {
    validateSettings(settings);
    this.store.set('settings', settings);
    return settings;
  }

  // Dots
  getDots() {
    const dotsObj = this.store.get('dots') || {};
    return Object.values(dotsObj);
  }

  getDot(dotId) {
    return this.store.get(`dots.${dotId}`) || null;
  }

  saveDot(dot) {
    validateDot(dot);
    const existing = this.getDot(dot.id);
    const now = Date.now();
    const updated = {
      ...dot,
      createdAt: existing?.createdAt || dot.createdAt || now,
      updatedAt: now
    };
    this.store.set(`dots.${dot.id}`, updated);
    return updated;
  }

  deleteDot(dotId, deleteNotes = true) {
    const dot = this.getDot(dotId);
    if (!dot) return false;

    if (deleteNotes && Array.isArray(dot.noteIds)) {
      for (const noteId of dot.noteIds) {
        this.deleteNote(noteId);
      }
    }
    this.store.delete(`dots.${dotId}`);
    return true;
  }

  // Notes
  getAllNotes() {
    const notesObj = this.store.get('notes') || {};
    return Object.values(notesObj);
  }

  getNotesByDot(dotId) {
    const notesObj = this.store.get('notes') || {};
    return Object.values(notesObj).filter((n) => n.dotId === dotId);
  }

  getNote(noteId) {
    return this.store.get(`notes.${noteId}`) || null;
  }

  saveNote(note) {
    validateNote(note);
    const existing = this.getNote(note.id);
    const now = Date.now();
    const updated = {
      ...note,
      createdAt: existing?.createdAt || note.createdAt || now,
      updatedAt: note.updatedAt || now
    };
    this.store.set(`notes.${note.id}`, updated);

    // Link to Dot noteIds if not present
    const dot = this.getDot(note.dotId);
    if (dot && !dot.noteIds.includes(note.id)) {
      dot.noteIds.push(note.id);
      this.saveDot(dot);
    }

    return updated;
  }

  deleteNote(noteId) {
    const note = this.getNote(noteId);
    if (!note) return false;

    // Remove from dot noteIds array
    const dot = this.getDot(note.dotId);
    if (dot && Array.isArray(dot.noteIds)) {
      dot.noteIds = dot.noteIds.filter((id) => id !== noteId);
      this.saveDot(dot);
    }

    this.store.delete(`notes.${noteId}`);
    return true;
  }

  // Migration V1 to V2
  migrateV1toV2(rawV1Data) {
    if (!rawV1Data) return;
    // Creates independent note objects for embedded notes
    if (Array.isArray(rawV1Data.dots)) {
      for (const d of rawV1Data.dots) {
        const noteIds = [];
        if (d.text || d.notes) {
          const notes = d.notes || [{ id: `migrated-${d.id}`, text: d.text }];
          for (const n of notes) {
            const noteObj = {
              id: n.id || `migrated-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
              dotId: d.id,
              text: n.text || '',
              checklist: n.checklist || [],
              deadline: n.deadline || null,
              firedReminders: [],
              textSize: 14,
              textColor: '#ffffff',
              createdAt: Date.now(),
              updatedAt: Date.now()
            };
            this.saveNote(noteObj);
            noteIds.push(noteObj.id);
          }
        }
        this.saveDot({
          id: d.id,
          position: d.position || { x: 100, y: 100 },
          color: d.color || '#3b82f6',
          opacity: d.opacity ?? 0.88,
          blurBackground: true,
          blurRadius: 12,
          expandTimerMs: 4000,
          isPinned: false,
          noteIds
        });
      }
    }
  }
}
