import { describe, it, expect, vi } from 'vitest';
import { StorageEngine } from '../../src/shared/storage.js';
import { DefaultSettings, ALARM_SOUND_PRESETS } from '../../src/shared/schema.js';
import { DeadlineScheduler } from '../../src/main/deadlineScheduler.js';

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

describe('Deadline Alarm Sound System', () => {
  it('includes soundEnabled = true and alarmSound = chime in DefaultSettings', () => {
    expect(DefaultSettings.soundEnabled).toBe(true);
    expect(DefaultSettings.alarmSound).toBe('chime');
    expect(DefaultSettings.launchAtStartup).toBe(true);
    expect(ALARM_SOUND_PRESETS.map((p) => p.id)).toEqual(['chime', 'bell', 'soft-ping']);
  });

  it('broadcasts play-alarm-sound with configured preset when soundEnabled is true', () => {
    const store = new MockStore();
    const storage = new StorageEngine(store);
    storage.saveSettings({
      ...storage.getSettings(),
      soundEnabled: true,
      alarmSound: 'bell'
    });

    const mockWindowManager = {
      windows: new Map(),
      broadcast: vi.fn(),
      openNewNoteInHub: vi.fn()
    };

    const scheduler = new DeadlineScheduler(storage, mockWindowManager);

    const now = Date.now();
    // Create note with deadline 10 minutes out
    const note = {
      id: 'note-sound-test',
      dotId: 'hub-dot',
      text: 'Submit tax return',
      deadline: now + 10 * 60 * 1000,
      alertWindowsMin: [10],
      firedReminders: []
    };
    storage.saveNote(note);

    scheduler.checkDeadlines();

    // Verify broadcast was called with 'bell'
    expect(mockWindowManager.broadcast).toHaveBeenCalledWith('play-alarm-sound', { sound: 'bell' });

    // Verify reminder was recorded as fired so it doesn't double-fire
    const updatedNote = storage.getNote('note-sound-test');
    expect(updatedNote.firedReminders).toContain(10);
  });

  it('does NOT broadcast play-alarm-sound when soundEnabled is false (silent notification)', () => {
    const store = new MockStore();
    const storage = new StorageEngine(store);
    storage.saveSettings({
      ...storage.getSettings(),
      soundEnabled: false,
      alarmSound: 'soft-ping'
    });

    const mockWindowManager = {
      windows: new Map(),
      broadcast: vi.fn(),
      openNewNoteInHub: vi.fn()
    };

    const scheduler = new DeadlineScheduler(storage, mockWindowManager);

    const now = Date.now();
    const note = {
      id: 'note-silent-test',
      dotId: 'hub-dot',
      text: 'Silent notification task',
      deadline: now + 30 * 60 * 1000,
      alertWindowsMin: [30],
      firedReminders: []
    };
    storage.saveNote(note);

    scheduler.checkDeadlines();

    // Verify play-alarm-sound was NOT called
    expect(mockWindowManager.broadcast).not.toHaveBeenCalledWith('play-alarm-sound', expect.anything());

    // Verify reminder was still recorded as fired
    const updatedNote = storage.getNote('note-silent-test');
    expect(updatedNote.firedReminders).toContain(30);
  });

  it('respects per-note alertWindowsMin correctly across multiple windows (10m, 30m, 1h, 1d)', () => {
    const store = new MockStore();
    const storage = new StorageEngine(store);
    storage.saveSettings({
      ...storage.getSettings(),
      soundEnabled: true,
      alarmSound: 'chime'
    });

    const mockWindowManager = {
      windows: new Map(),
      broadcast: vi.fn(),
      openNewNoteInHub: vi.fn()
    };

    const scheduler = new DeadlineScheduler(storage, mockWindowManager);
    const now = Date.now();

    // Note 1: 1 hour window firing
    const note1 = {
      id: 'note-1hr',
      dotId: 'hub-dot',
      text: '1 hour notice task',
      deadline: now + 60 * 60 * 1000,
      alertWindowsMin: [60],
      firedReminders: []
    };
    // Note 2: 1 day window NOT firing yet (deadline in 2 days)
    const note2 = {
      id: 'note-future',
      dotId: 'hub-dot',
      text: 'Far future task',
      deadline: now + 48 * 60 * 60 * 1000,
      alertWindowsMin: [1440],
      firedReminders: []
    };

    storage.saveNote(note1);
    storage.saveNote(note2);

    scheduler.checkDeadlines();

    expect(mockWindowManager.broadcast).toHaveBeenCalledWith('play-alarm-sound', { sound: 'chime' });
    expect(storage.getNote('note-1hr').firedReminders).toContain(60);
    expect(storage.getNote('note-future').firedReminders).toEqual([]);
  });

  it('triggers sound alongside notification when deadline is ~1 minute out', () => {
    const store = new MockStore();
    const storage = new StorageEngine(store);
    storage.saveSettings({
      ...storage.getSettings(),
      soundEnabled: true,
      alarmSound: 'soft-ping'
    });

    const mockWindowManager = {
      windows: new Map(),
      broadcast: vi.fn(),
      openNewNoteInHub: vi.fn()
    };

    const scheduler = new DeadlineScheduler(storage, mockWindowManager);
    const now = Date.now();

    // Set deadline 1 minute out with 1-min alert window
    const note = {
      id: 'note-1min-due',
      dotId: 'hub-dot',
      text: 'Urgent: meeting starts in 1 minute',
      deadline: now + 60 * 1000,
      alertWindowsMin: [1],
      firedReminders: []
    };
    storage.saveNote(note);

    scheduler.checkDeadlines();

    expect(mockWindowManager.broadcast).toHaveBeenCalledWith('play-alarm-sound', { sound: 'soft-ping' });
    expect(storage.getNote('note-1min-due').firedReminders).toContain(1);
  });
});
