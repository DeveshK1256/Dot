import { screen } from 'electron';

export function registerQuickCapture({ globalShortcut, windowManager }) {
  const shortcut = 'CommandOrControl+Shift+Space';

  globalShortcut.register(shortcut, () => {
    const cursor = screen.getCursorScreenPoint();
    const id = `dot-quick-${Date.now()}`;
    const newDot = {
      id,
      position: { x: cursor.x - 24, y: cursor.y - 24 },
      color: '#3b82f6',
      opacity: 0.88,
      blurBackground: true,
      blurRadius: 12,
      expandTimerMs: 4000,
      isPinned: false,
      isEphemeral: true, // Marker for discard-on-empty Escape
      noteIds: []
    };

    windowManager.storage.saveDot(newDot);
    const win = windowManager.createDotWindow(newDot);
    // Expand immediately
    windowManager.setDotState(id, 'EXPANDED');
    win.webContents.once('did-finish-load', () => {
      win.webContents.send('focus-input');
    });
  });
}
