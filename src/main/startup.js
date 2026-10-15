import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import { execFile } from 'child_process';

/**
 * Configure Dot to start automatically on Windows/macOS login.
 * Uses native Electron app.setLoginItemSettings and creates/removes
 * a startup shortcut in Windows Startup folder for 100% reliability.
 */
export function setStartupEnabled(enabled) {
  try {
    if (app && typeof app.setLoginItemSettings === 'function') {
      app.setLoginItemSettings({
        openAtLogin: Boolean(enabled),
        path: process.execPath
      });
    }
  } catch (err) {
    console.warn('[Startup] setLoginItemSettings error:', err);
  }

  // Windows Startup folder shortcut handling
  if (process.platform === 'win32') {
    try {
      const appData = process.env.APPDATA;
      if (appData) {
        const startupDir = path.join(appData, 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup');
        const shortcutPath = path.join(startupDir, 'Dot.lnk');

        if (enabled) {
          const exePath = process.execPath;
          const workingDir = path.dirname(exePath);
          const script = `$ws = New-Object -ComObject WScript.Shell
$s = $ws.CreateShortcut("${shortcutPath}")
$s.TargetPath = "${exePath}"
$s.WorkingDirectory = "${workingDir}"
$s.Save()`;
          const encoded = Buffer.from(script, 'utf16le').toString('base64');
          execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', encoded], (err) => {
            if (err) console.warn('[Startup] Failed to create Windows startup shortcut:', err);
          });
        } else {
          if (fs.existsSync(shortcutPath)) {
            fs.unlinkSync(shortcutPath);
          }
        }
      }
    } catch (err) {
      console.warn('[Startup] Windows startup shortcut handling error:', err);
    }
  }
}
