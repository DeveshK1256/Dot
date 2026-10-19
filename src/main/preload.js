const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Hub state & window bounds
  setDotState: (dotId, state) => ipcRenderer.send('set-dot-state', { dotId, state }),
  openNewNote: () => ipcRenderer.send('open-new-note'),
  closeSettings: () => ipcRenderer.send('close-settings'),
  
  // Storage operations
  getSettings: () => ipcRenderer.invoke('storage:getSettings'),
  saveSettings: (settings) => ipcRenderer.invoke('storage:saveSettings', settings),
  getDots: () => ipcRenderer.invoke('storage:getDots'),
  saveDot: (dot) => ipcRenderer.invoke('storage:saveDot', dot),
  deleteDot: (dotId, deleteNotes) => ipcRenderer.invoke('storage:deleteDot', { dotId, deleteNotes }),
  getNotesByDot: (dotId) => ipcRenderer.invoke('storage:getNotesByDot', dotId),
  getAllNotes: () => ipcRenderer.invoke('storage:getAllNotes'),
  saveNote: (note) => ipcRenderer.invoke('storage:saveNote', note),
  deleteNote: (noteId) => ipcRenderer.invoke('storage:deleteNote', noteId),

  // Events & Notifications
  onUrgencyUpdate: (callback) => {
    const subscription = (_event, data) => callback(data);
    ipcRenderer.on('urgency-update', subscription);
    return () => ipcRenderer.removeListener('urgency-update', subscription);
  },
  onSettingsUpdated: (callback) => {
    const subscription = (_event, data) => callback(data);
    ipcRenderer.on('settings-updated', subscription);
    return () => ipcRenderer.removeListener('settings-updated', subscription);
  },
  onDotUpdated: (callback) => {
    const subscription = (_event, data) => callback(data);
    ipcRenderer.on('dot-updated', subscription);
    return () => ipcRenderer.removeListener('dot-updated', subscription);
  },
  onNoteUpdated: (callback) => {
    const subscription = (_event, data) => callback(data);
    ipcRenderer.on('note-updated', subscription);
    return () => ipcRenderer.removeListener('note-updated', subscription);
  },
  onNoteDeleted: (callback) => {
    const subscription = (_event, data) => callback(data);
    ipcRenderer.on('note-deleted', subscription);
    return () => ipcRenderer.removeListener('note-deleted', subscription);
  },
  onFocusInput: (callback) => {
    const subscription = () => callback();
    ipcRenderer.on('focus-input', subscription);
    return () => ipcRenderer.removeListener('focus-input', subscription);
  },
  onCollapseHub: (callback) => {
    const subscription = () => callback();
    ipcRenderer.on('collapse-hub', subscription);
    return () => ipcRenderer.removeListener('collapse-hub', subscription);
  },
  onPlayAlarmSound: (callback) => {
    const subscription = (_event, data) => callback(data);
    ipcRenderer.on('play-alarm-sound', subscription);
    return () => ipcRenderer.removeListener('play-alarm-sound', subscription);
  }
});
