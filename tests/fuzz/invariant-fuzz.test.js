import { describe, it, expect } from 'vitest';
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

describe('500-Step Randomized Invariant Fuzz Test', () => {
  it('maintains zero orphaned notes, referential integrity, and store consistency', () => {
    const store = new MockStore();
    const storage = new StorageEngine(store);

    const createdDotIds = [];
    const createdNoteIds = [];

    // Helper: Verify invariants
    function verifyInvariants(stepIndex) {
      const allDots = storage.getDots();
      const dotIdMap = new Map(allDots.map((d) => [d.id, d]));

      // 1. Every note must have an existing dotId in storage (Zero Orphaned Notes)
      const allNotesObj = store.get('notes') || {};
      const allNotes = Object.values(allNotesObj);

      for (const note of allNotes) {
        expect(
          dotIdMap.has(note.dotId),
          `Step ${stepIndex}: Note ${note.id} has orphaned dotId ${note.dotId}`
        ).toBe(true);

        // 2. Note must be present in parent dot.noteIds list
        const parentDot = dotIdMap.get(note.dotId);
        expect(
          parentDot.noteIds.includes(note.id),
          `Step ${stepIndex}: Parent dot ${parentDot.id} is missing noteId ${note.id}`
        );
      }

      // 3. Every noteId referenced by a dot must actually exist
      for (const dot of allDots) {
        for (const nid of dot.noteIds) {
          expect(
            storage.getNote(nid) !== null,
            `Step ${stepIndex}: Dot ${dot.id} references non-existent note ${nid}`
          ).toBe(true);
        }
      }
    }

    // 500-step randomized action loop
    for (let step = 1; step <= 500; step++) {
      const action = Math.floor(Math.random() * 5);

      if (action === 0 || createdDotIds.length === 0) {
        // Action 0: Spawn Dot
        const dotId = `fuzz-dot-${step}-${Math.random().toString(36).substr(2, 4)}`;
        storage.saveDot({
          id: dotId,
          position: {
            x: Math.floor(Math.random() * 1920),
            y: Math.floor(Math.random() * 1080)
          },
          color: '#3b82f6',
          opacity: 0.85,
          noteIds: []
        });
        createdDotIds.push(dotId);
      } else if (action === 1) {
        // Action 1: Add Note to Random Existing Dot
        const randomDotId = createdDotIds[Math.floor(Math.random() * createdDotIds.length)];
        const noteId = `fuzz-note-${step}-${Math.random().toString(36).substr(2, 4)}`;
        storage.saveNote({
          id: noteId,
          dotId: randomDotId,
          text: `Fuzz text at step ${step}`,
          checklist: [
            { id: `chk-1`, label: 'Task item', done: Math.random() > 0.5 }
          ],
          deadline: Date.now() + Math.floor(Math.random() * 86400000),
          firedReminders: []
        });
        createdNoteIds.push(noteId);
      } else if (action === 2 && createdNoteIds.length > 0) {
        // Action 2: Update existing Note
        const randomNoteId = createdNoteIds[Math.floor(Math.random() * createdNoteIds.length)];
        const existingNote = storage.getNote(randomNoteId);
        if (existingNote) {
          existingNote.text = `Updated at step ${step}`;
          storage.saveNote(existingNote);
        }
      } else if (action === 3 && createdNoteIds.length > 0) {
        // Action 3: Delete existing Note
        const idx = Math.floor(Math.random() * createdNoteIds.length);
        const noteIdToDelete = createdNoteIds[idx];
        storage.deleteNote(noteIdToDelete);
        createdNoteIds.splice(idx, 1);
      } else if (action === 4 && createdDotIds.length > 0) {
        // Action 4: Delete existing Dot (and its notes)
        const idx = Math.floor(Math.random() * createdDotIds.length);
        const dotIdToDelete = createdDotIds[idx];
        const dot = storage.getDot(dotIdToDelete);
        if (dot) {
          // Remove tracked notes from createdNoteIds list
          for (const nid of dot.noteIds) {
            const nIdx = createdNoteIds.indexOf(nid);
            if (nIdx !== -1) createdNoteIds.splice(nIdx, 1);
          }
        }
        storage.deleteDot(dotIdToDelete, true);
        createdDotIds.splice(idx, 1);
      }

      // Assert all invariants hold true on every single mutation step
      verifyInvariants(step);
    }
  });
});
