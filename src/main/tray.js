import { Tray, Menu, nativeImage, app } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function setupTray({ windowManager, storage, onOpenSettings }) {
  const isWin = process.platform === 'win32';
  const isMac = process.platform === 'darwin';

  const preferredFiles = isMac
    ? ['tray-Template.png', 'tray-Template@2x.png']
    : isWin
    ? ['tray-32.png', 'tray-16.png']
    : ['tray-16.png', 'tray-32.png'];

  const candidateDirs = [
    path.join(app.getAppPath(), 'assets/icons/tray'),
    path.join(__dirname, '../../assets/icons/tray'),
    path.join(process.resourcesPath, 'assets/icons/tray'),
    path.join(process.resourcesPath, 'app.asar.unpacked/assets/icons/tray')
  ];

  let icon = nativeImage.createEmpty();
  for (const dir of candidateDirs) {
    for (const f of preferredFiles) {
      const full = path.join(dir, f);
      try {
        const img = nativeImage.createFromPath(full);
        if (!img.isEmpty()) {
          icon = img;
          break;
        }
      } catch (_) {}
    }
    if (!icon.isEmpty()) break;
  }

  // Windows fallback to .ico
  if (icon.isEmpty() && isWin) {
    const icoDirs = [
      path.join(app.getAppPath(), 'assets/icons/app/icon.ico'),
      path.join(__dirname, '../../assets/icons/app/icon.ico'),
      path.join(process.resourcesPath, 'assets/icons/app/icon.ico')
    ];
    for (const p of icoDirs) {
      try {
        const img = nativeImage.createFromPath(p);
        if (!img.isEmpty()) {
          icon = img;
          break;
        }
      } catch (_) {}
    }
  }

  let tray = null;
  try {
    tray = new Tray(icon);
  } catch (err) {
    console.error('Tray initialization error:', err);
  }

  function buildMenu() {
    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'New Note',
        accelerator: 'CommandOrControl+Shift+Space',
        click: () => windowManager.openNewNoteInHub()
      },
      {
        label: 'Toggle Ghost Mode (Pass-Through)',
        accelerator: 'CommandOrControl+Alt+G',
        click: () => windowManager.toggleGhostMode()
      },
      { type: 'separator' },
      {
        label: 'Hub Settings...',
        click: onOpenSettings
      },
      { type: 'separator' },
      {
        label: 'Quit Dot',
        click: () => app.quit()
      }
    ]);

    if (tray) {
      tray.setContextMenu(contextMenu);
    }
  }

  buildMenu();
  if (tray) {
    tray.setToolTip('Dot - Minimalist Floating Notes');
    tray.updateDisplayMode = () => {
      buildMenu();
    };
  }

  return tray;
}
