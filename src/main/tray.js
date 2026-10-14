import { Tray, Menu, nativeImage, app } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function setupTray({ windowManager, storage, onOpenSettings }) {
  // Use a fallback transparent 16x16 nativeImage if icon file not yet drawn
  let icon = nativeImage.createEmpty();
  const iconFileName = process.platform === 'darwin' ? 'tray-Template.png' : 'tray-16.png';
  const iconPath = path.join(__dirname, '../../assets/icons/tray', iconFileName);
  try {
    icon = nativeImage.createFromPath(iconPath);
  } catch (e) {
    // Ignore missing asset in initial bootstrap
  }

  const tray = new Tray(icon);

  function buildMenu() {
    const settings = storage ? storage.getSettings() : { displayMode: 'all' };
    const isHubOnly = settings.displayMode === 'hubOnly';

    const contextMenu = Menu.buildFromTemplate([
      {
        label: isHubOnly ? 'Display Mode: Hub Only' : 'Display Mode: Show All Dots',
        sublabel: isHubOnly ? 'Click to show all floating dots' : 'Click to hide dots & use Hub only',
        click: () => {
          if (!storage) return;
          const currentSettings = storage.getSettings();
          const nextMode = currentSettings.displayMode === 'hubOnly' ? 'all' : 'hubOnly';
          const updated = { ...currentSettings, displayMode: nextMode };
          storage.saveSettings(updated);
          windowManager.broadcast('settings-updated', updated);
          windowManager.applyDisplayMode(nextMode);
          buildMenu();
        }
      },
      { type: 'separator' },
      {
        label: 'New Dot at Cursor',
        accelerator: 'CommandOrControl+Shift+Space',
        click: () => windowManager.spawnDotAtCursor()
      },
      {
        label: 'Show All Hidden Dots',
        click: () => {
          windowManager.showAllHiddenDots();
          buildMenu();
        }
      },
      {
        label: 'Toggle Ghost Mode (Pass-Through)',
        accelerator: 'CommandOrControl+Alt+G',
        click: () => windowManager.toggleGhostMode()
      },
      { type: 'separator' },
      {
        label: 'Settings...',
        click: onOpenSettings
      },
      { type: 'separator' },
      {
        label: 'Quit Dot',
        click: () => app.quit()
      }
    ]);

    tray.setContextMenu(contextMenu);
  }

  buildMenu();
  tray.setToolTip('Dot - Minimalist Floating Notes');

  tray.updateDisplayMode = () => {
    buildMenu();
  };

  return tray;
}
