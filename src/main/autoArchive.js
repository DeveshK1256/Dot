export class AutoArchiver {
  constructor(storage, archiveStore) {
    this.storage = storage;
    this.archiveStore = archiveStore; // Separate store or file
    this.checkIntervalMs = 24 * 60 * 60 * 1000; // Once a day
    this.intervalId = null;
  }

  start() {
    this.runArchiveJob();
    this.intervalId = setInterval(() => {
      this.runArchiveJob();
    }, this.checkIntervalMs);
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  runArchiveJob(daysThreshold = 14, now = Date.now()) {
    const cutoffMs = now - daysThreshold * 24 * 60 * 60 * 1000;
    const dots = this.storage.getDots();
    let archivedCount = 0;

    for (const dot of dots) {
      const notes = this.storage.getNotesByDot(dot.id);
      for (const note of notes) {
        // If all checklist items are done and updated before cutoff
        const isChecklistDone =
          Array.isArray(note.checklist) &&
          note.checklist.length > 0 &&
          note.checklist.every((item) => item.done);

        if (isChecklistDone && note.updatedAt <= cutoffMs) {
          // Move to archive store
          this.archiveStore.set(`archivedNotes.${note.id}`, {
            ...note,
            archivedAt: now
          });
          // Remove from active store
          this.storage.deleteNote(note.id);
          archivedCount++;
        }
      }
    }
    return archivedCount;
  }

  getArchivedNotes() {
    const raw = this.archiveStore.get('archivedNotes') || {};
    return Object.values(raw);
  }
}
