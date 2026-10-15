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

    // Check if migration to v3 is needed (or missing schemaVersion)
    const settings = this.store.get('settings') || {};
    if (!settings.schemaVersion || settings.schemaVersion < 3) {
      this.migrateToV3();
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

    if (deleteNotes) {
      const noteIdsToDelete = new Set(Array.isArray(dot.noteIds) ? dot.noteIds : []);
      const allNotes = this.getAllNotes();
      for (const n of allNotes) {
        if (n.dotId === dotId) {
          noteIdsToDelete.add(n.id);
        }
      }
      for (const noteId of noteIdsToDelete) {
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
    if (dotId === 'hub-dot') {
      return Object.values(notesObj);
    }
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
      dotId: note.dotId || 'hub-dot',
      createdAt: existing?.createdAt || note.createdAt || now,
      updatedAt: note.updatedAt || now
    };
    this.store.set(`notes.${note.id}`, updated);

    // Link to target dot noteIds
    const targetDotId = updated.dotId;
    const targetDot = this.getDot(targetDotId);
    if (targetDot) {
      if (!Array.isArray(targetDot.noteIds)) targetDot.noteIds = [];
      if (!targetDot.noteIds.includes(note.id)) {
        targetDot.noteIds.push(note.id);
        this.saveDot(targetDot);
      }
    }

    // Also link to hub-dot if target is different and hub-dot exists
    if (targetDotId !== 'hub-dot') {
      const hubDot = this.getDot('hub-dot');
      if (hubDot) {
        if (!Array.isArray(hubDot.noteIds)) hubDot.noteIds = [];
        if (!hubDot.noteIds.includes(note.id)) {
          hubDot.noteIds.push(note.id);
          this.saveDot(hubDot);
        }
      }
    }

    return updated;
  }

  deleteNote(noteId) {
    const note = this.getNote(noteId);
    if (note && note.dotId) {
      const parentDot = this.getDot(note.dotId);
      if (parentDot && Array.isArray(parentDot.noteIds)) {
        parentDot.noteIds = parentDot.noteIds.filter((id) => id !== noteId);
        this.saveDot(parentDot);
      }
    }
    const hubDot = this.getDot('hub-dot');
    if (hubDot && Array.isArray(hubDot.noteIds)) {
      hubDot.noteIds = hubDot.noteIds.filter((id) => id !== noteId);
      this.saveDot(hubDot);
    }

    this.store.delete(`notes.${noteId}`);
    return true;
  }

  // Migration to V3 (Single Hub architecture)
  migrateToV3() {
    // 1. Back up pre-migration data
    this.store.set('backup_pre_hub_only', {
      settings: this.store.get('settings'),
      dots: this.store.get('dots'),
      notes: this.store.get('notes'),
      timestamp: Date.now()
    });

    const settings = this.getSettings();
    const dotsObj = this.store.get('dots') || {};
    const notesObj = this.store.get('notes') || {};
    const allDots = Object.values(dotsObj);
    const allNotes = Object.values(notesObj);

    // 2. Identify or create the Hub dot
    let hubDot = allDots.find((d) => d.isHub || d.id === 'hub-dot');
    if (!hubDot) {
      hubDot = {
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
    }
    const allHubNoteIds = new Set(Array.isArray(hubDot.noteIds) ? hubDot.noteIds : []);

    // 3. For each non-hub dot, copy style overrides to its notes
    const nonHubDots = allDots.filter((d) => !d.isHub && d.id !== 'hub-dot');
    for (const dot of nonHubDots) {
      const dotNotes = allNotes.filter(
        (n) => n.dotId === dot.id || (Array.isArray(dot.noteIds) && dot.noteIds.includes(n.id))
      );
      for (const note of dotNotes) {
        note.color = note.color || dot.color || settings.defaultDotColor || '#3b82f6';
        note.opacity = note.opacity ?? dot.opacity ?? settings.defaultOpacity ?? 0.88;
        note.textSize = note.textSize ?? dot.textSize ?? settings.defaultTextSize ?? 14;
        note.textColor = note.textColor || dot.textColor || settings.defaultTextColor || '#ffffff';
        note.blurRadius = note.blurRadius ?? dot.blurRadius ?? settings.defaultBlurRadius ?? 12;
        note.dotId = 'hub-dot';

        notesObj[note.id] = note;
        allHubNoteIds.add(note.id);
      }
    }

    // Ensure any remaining notes point to hub-dot
    for (const note of Object.values(notesObj)) {
      if (!note.dotId || note.dotId !== 'hub-dot') {
        note.dotId = 'hub-dot';
      }
      allHubNoteIds.add(note.id);
    }

    // 4. Update Hub dot with all noteIds and keep ONLY hub-dot in dots
    hubDot.noteIds = Array.from(allHubNoteIds);
    this.store.set('dots', { 'hub-dot': hubDot });
    this.store.set('notes', notesObj);

    // 5. Upgrade settings to schemaVersion 3 and strip obsolete fields
    const updatedSettings = {
      ...DefaultSettings,
      ...settings,
      schemaVersion: 3
    };
    delete updatedSettings.displayMode;
    delete updatedSettings.showPlusButton;
    delete updatedSettings.plusButtonCorner;
    this.store.set('settings', updatedSettings);
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
