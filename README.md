# Dot — Minimal Glassmorphic Desktop Notes Widget

<p align="center">
  <strong>A sleek, edge-docked, frosted-glass desktop notes widget built for Windows.</strong><br>
  Always accessible. Completely unobtrusive. 100% private and offline.
</p>

---

## ✨ Features

- **🪟 Edge-Docked & Unobtrusive**: Dot rests discreetly at the edge of your screen as a thin frosted strip. Hover or click to smoothly expand the full note flyout; move away to automatically collapse it back.
- **💎 Refined Glassmorphism Aesthetic**: Designed with modern frosted-glass styling (`backdrop-filter: blur`), subtle specular borders, ambient depth shadows, and customizable accent tints.
- **📝 Flexible Note Management**:
  - Create standard notes or interactive checklists.
  - Per-note customization: custom accent colors, background opacity, font size, and text contrast.
  - Search, filter, and prioritize notes with immediate response.
- **⏰ Deadlines & Audible Alarm System**:
  - Set specific deadlines on tasks.
  - Native Windows desktop banner notifications before and at due time.
  - Bundled pleasant audio alarm tones (`chime`, `bell`, `soft-ping`) with an in-app audio preview tester.
- **🚀 Windows Launch at Startup**:
  - Built-in toggle to automatically launch Dot whenever Windows boots or logs in (after shutdown, restart, or sleep).
  - Automatically restores your notes and docks to your preferred screen edge.
- **🔒 Private & Local First**:
  - Zero cloud dependencies, zero external tracking, zero analytics.
  - All notes and preferences are saved locally on your machine using persistent JSON storage with atomic writes and automated backups.

---

## 📥 How to Install

### Option 1: Standalone Windows Installer (Recommended)

1. Download **`Dot Setup 1.0.0.exe`** from the [`installer/`](./installer/Dot%20Setup%201.0.0.exe) directory (or from GitHub Releases).
2. Double-click **`Dot Setup 1.0.0.exe`** to install.
3. **Windows SmartScreen Note**: Because this open-source build is self-packaged and not signed with an enterprise EV code-signing certificate, Windows may display a *"Windows protected your PC"* banner on first run. Simply click:
   > **More info** ➔ **Run anyway**
4. Dot will install cleanly into your user profile (`%LOCALAPPDATA%\Programs\Dot`) and start docked to your screen edge. A desktop shortcut and start menu entry will be created.

---

### Option 2: Run & Build from Source (Developers)

#### Prerequisites
- [Node.js](https://nodejs.org/) (v18.0.0 or higher recommended)
- `npm` (included with Node)
- Git

#### 1. Clone the Repository
```bash
git clone https://github.com/DeveshK1256/Dot.git
cd Dot
```
*(If opening from a subfolder, navigate to `dot-app`)*

#### 2. Install Dependencies
```bash
npm install
```

#### 3. Run in Development Mode
```bash
# Terminal 1: Start the Vite renderer dev server
npm run dev

# Terminal 2: Launch Electron connected to the dev server
npm start
```

#### 4. Run Automated Tests
```bash
# Run unit & fuzz test suites
npm test
```

#### 5. Build Production Installer
```bash
# 1. Compile the React frontend with Vite
npm run build:renderer

# 2. Package with electron-builder into an NSIS Windows installer
npm run dist
```
The output installer executable will be created in `dist-package/Dot Setup 1.0.0.exe`.

---

## 🛠️ Tech Stack

- **Runtime**: [Electron](https://www.electronjs.org/) (v33)
- **Frontend Framework**: [React](https://react.dev/) (v18)
- **Build Tool**: [Vite](https://vitejs.dev/) (v6)
- **Icons**: [Lucide React](https://lucide.dev/)
- **State & Storage**: [electron-store](https://github.com/sindresorhus/electron-store) (local atomic persistence)
- **Notifications & Audio**: Native Web Audio API synthesis / bundled alert assets & Windows `node-notifier`
- **Testing**: [Vitest](https://vitest.dev/) (Unit & Invariant Fuzz Testing)

---

## ⚙️ Configuration & Customization

Open **Dot Settings** (via the gear icon in the flyout header or right-click the system tray icon):
- **Dock Edge**: Choose between Right, Left, Top, or Bottom screen edges.
- **Dot Accent Color**: Pick your favorite accent theme.
- **Dot Opacity & Blur**: Dial in your preferred glass transparency level.
- **Sound Alerts**: Toggle audio notifications on/off, choose your preferred tone (`chime`, `bell`, `soft-ping`), and test it with the **Preview** button.
- **Launch at Startup**: Toggle whether Dot starts automatically when you log into Windows.

---

## 📄 License

MIT License. Feel free to use, modify, and distribute.
