import { app, BrowserWindow, ipcMain, screen, shell } from 'electron';
import path from 'node:path';
import Store from 'electron-store';
import {
  DEFAULT_SETTINGS,
  WINDOW_BOUNDS_KEY,
  validateSettings,
} from '../src/shared/settings';
import type { Settings } from '../src/types/prayer';
import type { CompletedMap } from '../src/shared/completions';
import { isValidDateKey, validateCompleteDay, validateCompletionsStore } from '../src/shared/completions';
import {
  setLoginItemSetting,
  getCurrentStartupSetting,
} from './startup';
import {
  showPrayerNotification,
  clearNotificationHistory,
  initNotificationDedup,
  setNotificationClickHandler,
} from './notifications';
import { registerTray, updateTrayState, destroyTray } from './tray';
import { initLocation } from './location';
import {
  initMiniWidget,
  setMiniCloseHandler,
  applyMiniVisibility,
  showMiniWidget,
  hideMiniWidget,
  flushMiniBounds,
  destroyMiniWidget,
  popupMiniMenu,
  getDockState,
  toggleDock,
  refreshDockPlacement,
  dockDragStart,
  dockDragMove,
  dockDragEnd,
  collapseFinish,
  notifyDockReady,
} from './miniWidget';

const isDev = !!process.env.VITE_DEV_SERVER_URL;

const COMPLETIONS_STORE_KEY = 'completions';

const store = new Store({
  defaults: {
    settings: DEFAULT_SETTINGS,
    [WINDOW_BOUNDS_KEY]: {},
    [COMPLETIONS_STORE_KEY]: {},
  },
});

// Share the same store instance with the notification de-duplication history.
initNotificationDedup(store);

let mainWindow: BrowserWindow | null = null;
let quitting = false;

function loadSettings(): Settings {
  return validateSettings(store.get('settings'));
}

function saveBounds(): void {
  if (!mainWindow || mainWindow.isMinimized() || mainWindow.isDestroyed() || mainWindow.isMaximized()) return;
  store.set(WINDOW_BOUNDS_KEY, mainWindow.getBounds());
}

function applySettings(s: Settings): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.setAlwaysOnTop(s.alwaysOnTop);
    if (process.platform === 'win32') mainWindow.setOpacity(s.opacity);
    // Keep the opaque base color in sync with the themed shell (P5).
    mainWindow.setBackgroundColor(s.theme === 'light' ? '#e7f0f8' : '#0b111a');
  }
  setLoginItemSetting(s.startWithWindows);
  applyMiniVisibility(s.showFloatingWidget);
}

/** Push settings updates to every open renderer (main + mini). */
function broadcastSettingsChanged(): void {
  mainWindow?.webContents.send('settings:changed');
  const mini = BrowserWindow.getAllWindows().find((w) => !w.isDestroyed() && w !== mainWindow);
  mini?.webContents.send('settings:changed');
}

/* ---- Daily prayer tracker (single source of truth in the main process) ---- */

function loadCompletions(): Record<string, CompletedMap> {
  return validateCompletionsStore(store.get(COMPLETIONS_STORE_KEY));
}

function saveCompletions(next: Record<string, CompletedMap>): void {
  store.set(COMPLETIONS_STORE_KEY, validateCompletionsStore(next));
}

function broadcastCompletionsChanged(): void {
  mainWindow?.webContents.send('completions:changed');
  for (const w of BrowserWindow.getAllWindows()) {
    if (!w.isDestroyed() && w !== mainWindow) w.webContents.send('completions:changed');
  }
}

function createWindow(): void {
  const settings = loadSettings();
  const bounds = store.get(WINDOW_BOUNDS_KEY) as {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
  };

  mainWindow = new BrowserWindow({
    width: bounds.width ?? 340,
    height: bounds.height ?? 460,
    ...(bounds.width && bounds.height && bounds.x !== undefined && bounds.y !== undefined
      ? { x: bounds.x, y: bounds.y }
      : {}),
    minWidth: 300,
    minHeight: 420,
    useContentSize: true,
    // Native Windows behaviour (P2): keep the custom header (frame:false) but
    // use WS_THICKFRAME so the window gets real resize borders, maximize and
    // Win+Arrow snapping. `transparent` was removed because it disables
    // thick-frame/snap/maximize on Windows.
    frame: false,
    resizable: true,
    maximizable: true,
    minimizable: true,
    fullscreenable: false,
    thickFrame: true,
    // Opaque base color matches the widget shell (updated on theme change in
    // applySettings) so rounded corners / first paint never flash white.
    backgroundColor: settings.theme === 'light' ? '#e7f0f8' : '#0b111a',
    alwaysOnTop: true,
    skipTaskbar: false,
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      // Keep geolocation watch + timers reliable while the widget sleeps in
      // the tray (hidden window); location tracking must survive minimization.
      backgroundThrottling: false,
    },
  });

  mainWindow.setMenuBarVisibility(false);

  if (isDev) {
    void mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL!);
  } else {
    void mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }

  // The widget hides instead of closing; quitting goes through the tray menu.
  mainWindow.on('close', (e) => {
    if (!quitting && mainWindow) {
      e.preventDefault();
      if (mainWindow.isMinimized()) mainWindow.restore();
      saveBounds();
      mainWindow.hide();
      updateTrayState();
    }
  });

  mainWindow.on('resize', saveBounds);
  mainWindow.on('move', saveBounds);

  mainWindow.once('ready-to-show', () => {
    if (!settings.launchMinimized) mainWindow?.show();
    updateTrayState();
  });

  setNotificationClickHandler(showMainWindow);
}

export function showMainWindow(): void {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
  } else {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
  }
  updateTrayState();
}

export function hideMainWindow(): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.hide();
    updateTrayState();
  }
}

app.whenReady().then(() => {
  setLoginItemSetting(loadSettings().startWithWindows);
  // Install the strict geolocation permission handlers BEFORE any window exists.
  initLocation(store, isDev ? process.env.VITE_DEV_SERVER_URL! : null);
  initMiniWidget(store, isDev);
  createWindow();
  registerTray({
    showMainWindow,
    hideMainWindow,
    getSettings: loadSettings,
  });
  // Auto-launch the mini widget when enabled in settings.
  const bootSettings = loadSettings();
  if (bootSettings.showFloatingWidget) showMiniWidget();
  setMiniCloseHandler(closeMiniAndSync);
  screen.on('display-metrics-changed', () => refreshDockPlacement());
});

// Single instance lock: avoid duplicated trays and notification spam.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => showMainWindow());
}

app.on('before-quit', () => {
  quitting = true;
  destroyTray();
  flushMiniBounds();
  destroyMiniWidget();
});

// The widget keeps running in the tray; do not quit when the window is hidden.
app.on('window-all-closed', () => {
  /* keep running in tray */
});

// ---------- IPC (renderer -> main, all inputs validated) ----------
ipcMain.handle('settings:get', () => loadSettings());

ipcMain.handle('settings:set', (_ev, partial: unknown) => {
  const current = validateSettings(store.get('settings'));
  const next = validateSettings({
    ...current,
    ...(typeof partial === 'object' && partial !== null ? partial : {}),
  });
  store.set('settings', next);
  applySettings(next);
  broadcastSettingsChanged();
  return next;
});

ipcMain.handle('settings:reset', () => {
  store.set('settings', DEFAULT_SETTINGS);
  applySettings(DEFAULT_SETTINGS);
  store.delete(WINDOW_BOUNDS_KEY);
  broadcastSettingsChanged();
  return DEFAULT_SETTINGS;
});

ipcMain.handle('app:notify', (_ev, payload: unknown) => {
  const p = payload as { key?: unknown; title?: unknown; body?: unknown };
  if (typeof p?.key !== 'string' || typeof p?.title !== 'string' || typeof p?.body !== 'string') {
    return false;
  }
  if (p.key.length > 120 || p.title.length > 120 || p.body.length > 250) return false;
  return showPrayerNotification(p.key, p.title, p.body);
});

ipcMain.handle('app:clearNotifications', () => {
  clearNotificationHistory();
  return true;
});

// "Close" for the widget = hide to tray (quit lives in the tray menu).
ipcMain.handle('app:closeWindow', () => {
  saveBounds();
  hideMainWindow();
});

// Native minimize: the window iconifies to the taskbar; the process and the
// tray keep running. Deliberately distinct from closeWindow (hide-to-tray).
ipcMain.handle('app:minimizeWindow', () => {
  if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isMinimized()) {
    mainWindow.minimize();
  }
});

// Toggle maximize/restore for the native window behavior (P2). Win+Arrow snap
// keys work natively; this backs the header button and double-click.
ipcMain.handle('app:maximizeToggle', () => {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});

// Mini floating widget controls.
function closeMiniAndSync(): void {
  hideMiniWidget();
  const s = loadSettings();
  if (s.showFloatingWidget) {
    store.set('settings', validateSettings({ ...s, showFloatingWidget: false }));
    broadcastSettingsChanged();
  }
}
ipcMain.handle('mini:requestClose', () => {
  closeMiniAndSync();
});
ipcMain.handle('mini:popupMenu', () => {
  popupMiniMenu();
});
ipcMain.on('mini:ready', () => {
  notifyDockReady();
});

// Edge-docked floating icon.
ipcMain.handle('dock:get', () => getDockState());
ipcMain.handle('dock:toggle', () => toggleDock());
ipcMain.handle('dock:dragStart', (_ev, x: unknown, y: unknown) => {
  if (typeof x === 'number' && Number.isFinite(x) && typeof y === 'number' && Number.isFinite(y)) {
    dockDragStart(x, y);
  }
});
ipcMain.handle('dock:dragMove', (_ev, x: unknown, y: unknown) => {
  if (typeof x === 'number' && Number.isFinite(x) && typeof y === 'number' && Number.isFinite(y)) {
    dockDragMove(x, y);
  }
});
ipcMain.handle('dock:dragEnd', () => dockDragEnd());
ipcMain.handle('dock:collapseFinish', () => collapseFinish());

// Daily prayer tracker storage (date-specific, validated, bounded).
ipcMain.handle('completed:get', () => loadCompletions());
ipcMain.handle('completed:set', (_ev, dateKey: unknown, map: unknown) => {
  if (typeof dateKey !== 'string' || !isValidDateKey(dateKey)) return loadCompletions();
  const current = loadCompletions();
  const day = validateCompleteDay(map);
  if (Object.keys(day).length === 0) delete current[dateKey];
  else current[dateKey] = day;
  saveCompletions(current);
  broadcastCompletionsChanged();
  return loadCompletions();
});
ipcMain.handle('completed:setAll', (_ev, raw: unknown) => {
  saveCompletions(validateCompletionsStore(raw));
  broadcastCompletionsChanged();
  return loadCompletions();
});

  ipcMain.handle('app:openExternal', (_ev, url: unknown) => {
  if (typeof url === 'string' && /^https:\/\/(support\.microsoft\.com|aladhan\.com)/.test(url)) {
    void shell.openExternal(url);
    return true;
  }
  return false;
});

ipcMain.handle('app:startupToggle', () => {
  const next = !loadSettings().startWithWindows;
  store.set('settings', validateSettings({ ...loadSettings(), startWithWindows: next }));
  setLoginItemSetting(next);
  return next;
});

ipcMain.handle('app:getStartupState', () => getCurrentStartupSetting());
