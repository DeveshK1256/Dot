/**
 * Dot - Schema definitions and runtime validators
 */

export const DefaultSettings = {
  schemaVersion: 3,
  defaultDotColor: '#3b82f6',
  defaultOpacity: 0.88,
  defaultBlurRadius: 12,
  blurBackgroundDefault: true,
  defaultTextSize: 14,
  defaultTextColor: '#ffffff',
  defaultExpandTimerMs: 4000,
  autoCloseEmptyDot: true,
  deadlineReminderWindowsMin: [1440, 60, 15, 0],
  quickCaptureShortcut: 'CommandOrControl+Shift+Space',
  ghostModeShortcut: 'CommandOrControl+Alt+G',
  soundEnabled: true,
  alarmSound: 'chime',
  launchAtStartup: true
};

export const ALARM_SOUND_PRESETS = [
  { id: 'chime', label: 'Chime' },
  { id: 'bell', label: 'Bell' },
  { id: 'soft-ping', label: 'Soft Ping' }
];

export const HubSettingsSchema = {
  hubEdge: 'right', // 'right' | 'left' | 'top' | 'bottom'
  hubColor: '#4f46e5',
  hubOpacity: 0.92,
  hubBorderStyle: 'solid', // 'solid' | 'dashed' | 'none'
  sortOrder: 'newest', // 'newest' | 'oldest' | 'alphabetical'
  showCompletedChecklists: true
};

export function validateHubSettings(settings) {
  if (!settings || typeof settings !== 'object') throw new Error('Hub settings must be an object');
  if (settings.hubEdge && !['right', 'left', 'top', 'bottom'].includes(settings.hubEdge)) {
    throw new Error("hubEdge must be 'right', 'left', 'top', or 'bottom'");
  }
  if (settings.hubOpacity !== undefined && (typeof settings.hubOpacity !== 'number' || settings.hubOpacity < 0.1 || settings.hubOpacity > 1.0)) {
    throw new Error('hubOpacity must be between 0.1 and 1.0');
  }
  if (settings.hubBorderStyle && !['solid', 'dashed', 'none'].includes(settings.hubBorderStyle)) {
    throw new Error("hubBorderStyle must be 'solid', 'dashed', or 'none'");
  }
  if (settings.sortOrder && !['newest', 'oldest', 'alphabetical'].includes(settings.sortOrder)) {
    throw new Error("sortOrder must be 'newest', 'oldest', or 'alphabetical'");
  }
  return true;
}

export function validateDot(dot) {
  if (!dot || typeof dot !== 'object') throw new Error('Dot must be an object');
  if (typeof dot.id !== 'string' || !dot.id) throw new Error('Invalid or missing dot.id');
  if (dot.position && (typeof dot.position.x !== 'number' || typeof dot.position.y !== 'number')) {
    throw new Error('Dot position must contain numeric x and y');
  }
  if (dot.noteIds !== undefined && !Array.isArray(dot.noteIds)) throw new Error('Dot noteIds must be an array');
  if (dot.opacity !== undefined && (typeof dot.opacity !== 'number' || dot.opacity < 0.1 || dot.opacity > 1.0)) {
    throw new Error('Dot opacity must be between 0.1 and 1.0');
  }
  return true;
}

export const ALERT_WINDOW_PRESETS = [
  { label: 'At deadline', min: 0 },
  { label: '10 min', min: 10 },
  { label: '30 min', min: 30 },
  { label: '1 hour', min: 60 },
  { label: '1 day', min: 1440 }
];

export function validateNote(note) {
  if (!note || typeof note !== 'object') throw new Error('Note must be an object');
  if (typeof note.id !== 'string' || !note.id) throw new Error('Invalid or missing note.id');
  if (note.dotId !== undefined && typeof note.dotId !== 'string') {
    throw new Error('Invalid note.dotId');
  }
  if (note.checklist !== undefined && !Array.isArray(note.checklist)) {
    throw new Error('Checklist must be an array if provided');
  }
  if (note.deadline !== undefined && note.deadline !== null && typeof note.deadline !== 'number') {
    throw new Error('Deadline must be an epoch timestamp or null');
  }
  if (note.alertWindowsMin !== undefined && !Array.isArray(note.alertWindowsMin)) {
    throw new Error('alertWindowsMin must be an array if provided');
  }
  if (note.opacity !== undefined && (typeof note.opacity !== 'number' || note.opacity < 0.1 || note.opacity > 1.0)) {
    throw new Error('Note opacity must be between 0.1 and 1.0');
  }
  if (note.textSize !== undefined && (typeof note.textSize !== 'number' || note.textSize < 8 || note.textSize > 36)) {
    throw new Error('Note textSize must be a number between 8 and 36');
  }
  if (note.blurRadius !== undefined && typeof note.blurRadius !== 'number') {
    throw new Error('Note blurRadius must be a number');
  }
  return true;
}

export function validateSettings(settings) {
  if (!settings || typeof settings !== 'object') throw new Error('Settings must be an object');
  if (typeof settings.schemaVersion !== 'number') throw new Error('Invalid settings schemaVersion');
  return true;
}
