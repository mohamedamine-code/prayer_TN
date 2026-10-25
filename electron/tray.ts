import { Menu, Tray, app, nativeImage } from 'electron';
import path from 'node:path';
import type { Settings } from '../src/types/prayer';
import { showMainWindow, hideMainWindow } from './main';
import { TUNISIAN_CITIES } from '../src/data/tunisianCities';

let tray: Tray | null = null;

interface TrayDeps {
  showMainWindow: () => void;
  hideMainWindow: () => void;
  getSettings: () => Settings;
}

let deps: TrayDeps | null = null;

function iconPath(): string {
  // Works both in dev (project root) and packaged (asar contains build/icon.png).
  const base = app.isPackaged ? path.join(app.getAppPath()) : app.getAppPath();
  return path.join(base, 'build', 'icon.png');
}

function createTrayIcon(): Tray {
  const icon = nativeImage
    .createFromPath(iconPath())
    .resize({ width: 16, height: 16 });

  const t = new Tray(icon);
  t.setToolTip('Salati Tunisia');
  registerTrayMenu(t);
  return t;
}

function registerTrayMenu(t: Tray): void {
  const settings = deps?.getSettings();
  const city =
    TUNISIAN_CITIES.find((c) => c.id === settings?.cityId)?.nameFr ?? '—';

  const menu = Menu.buildFromTemplate([
    { label: 'Salati Tunisia', enabled: false },
    { type: 'separator' },
    {
      label: 'Show widget',
      click: () => showMainWindow(),
    },
    {
      label: 'Hide widget',
      click: () => hideMainWindow(),
    },
    { type: 'separator' },
    {
      label: `City: ${city}`,
      enabled: false,
    },
    {
      label: `Always on top: ${settings?.alwaysOnTop ? 'on' : 'off'}`,
      enabled: false,
    },
    {
      label: 'Quit',
      click: () => {
        app.quit();
      },
    },
  ]);
  t.setContextMenu(menu);
}

export function registerTray(depsIn: TrayDeps): void {
  deps = depsIn;
  if (!tray) {
    tray = createTrayIcon();
  } else {
    registerTrayMenu(tray);
  }
}

export function updateTrayState(): void {
  if (tray) registerTrayMenu(tray);
}

export function destroyTray(): void {
  if (tray) {
    tray.destroy();
    tray = null;
  }
}
