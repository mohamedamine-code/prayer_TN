/**
 * Automatic update service (main process only — never exposed to the
 * renderer beyond the typed IPC bridge).
 *
 * Provider: GitHub Releases (mohamedamine-code/prayer_TN), Windows NSIS.
 * The feed configuration is baked into resources/app-update.yml by
 * electron-builder from the explicit `build.publish` section of
 * package.json — no tokens, no runtime override.
 */
import { app, BrowserWindow, Notification } from 'electron';
import { autoUpdater } from 'electron-updater';
import {
  UPDATE_BOOT_CHECK_DELAY_MS,
  UPDATE_CHECK_INTERVAL_MS,
  initialUpdateState,
  releaseUrlFor,
  reduceUpdateEvent,
  type UpdateEvent,
  type UpdateState,
} from '../src/shared/updater';

const MAX_RELEASE_NOTES_LENGTH = 2000;

let state: UpdateState = initialUpdateState('0.0.0');
let started = false;
let checkTimer: NodeJS.Timeout | null = null;
let bootTimer: NodeJS.Timeout | null = null;
let updateClickHandler: (() => void) | null = null;

/** Windows notification when the download finishes (the widget often hides
 *  in the tray; the user must learn the update is ready). Clicking the
 *  notification opens the main window. Never forces a restart. */
function notifyUpdateReady(version: string): void {
  if (!Notification.isSupported()) return;
  const n = new Notification({
    title: 'Salati Tunisia',
    body: `${version ? `v${version} — ` : ''}Mise à jour prête à installer · Update ready to install`,
  });
  if (updateClickHandler) n.on('click', () => updateClickHandler!());
  n.show();
}

/** Wired by main.ts so a notification click opens the widget. */
export function setUpdateClickHandler(fn: () => void): void {
  updateClickHandler = fn;
}

/** Updater runs only in packaged production builds unless explicitly
 *  enabled for development testing via SALATI_UPDATER_DEV=1. */
function canAutoUpdate(): boolean {
  if (process.env.SALATI_UPDATER_DEV === '1') return true;
  return app.isPackaged && !process.env.VITE_DEV_SERVER_URL;
}

function broadcast(): void {
  for (const w of BrowserWindow.getAllWindows()) {
    if (!w.isDestroyed()) w.webContents.send('update:state', state);
  }
}

function apply(event: UpdateEvent): void {
  state = reduceUpdateEvent(state, event);
  broadcast();
}

/** electron-updater release notes can be a plain string or ReleaseNoteInfo[]. */
function extractReleaseNotes(raw: unknown): string | null {
  let text: string | null = null;
  if (typeof raw === 'string') {
    text = raw;
  } else if (Array.isArray(raw)) {
    text = raw
      .map((n) => (typeof n === 'object' && n !== null && typeof (n as { note?: unknown }).note === 'string' ? (n as { note: string }).note : ''))
      .join('\n');
  }
  if (!text) return null;
  // Strip markdown headings/bullets lightly; the UI shows a short excerpt.
  return text.replace(/\r\n/g, '\n').slice(0, MAX_RELEASE_NOTES_LENGTH);
}

function scheduleBootCheck(): void {
  bootTimer = setTimeout(() => {
    void checkForUpdates(true);
  }, UPDATE_BOOT_CHECK_DELAY_MS);
  bootTimer.unref?.();
}

/** Public: manual check from the renderer ("Check for updates" button). */
export function manualCheck(): UpdateState {
  if (!state.updaterEnabled) return state;
  void checkForUpdates(false);
  return state;
}

/** Public: download the offered update (user-decided, never automatic). */
export function manualDownload(): UpdateState {
  if (!state.updaterEnabled) return state;
  const canDownload =
    state.phase === 'available' || (state.phase === 'error' && state.availableVersion !== null);
  if (!canDownload) return state;
  autoUpdater
    .downloadUpdate()
    .then(() => {
      /* success surfaces via the update-downloaded event */
    })
    .catch(() => {
      /* failures surface via the 'error' event and are reduced there */
    });
  return state;
}

/** Public: restart and install. Only ever called from an explicit user
 *  action — the app never restarts on its own when an update is ready. */
export function installUpdate(): UpdateState {
  if (!state.updaterEnabled || state.phase !== 'downloaded') return state;
  // Silent NSIS install, application relaunched afterwards.
  autoUpdater.quitAndInstall(true, true);
  return state;
}

async function checkForUpdates(automatic: boolean): Promise<void> {
  if (!state.updaterEnabled) return;
  // Never disturb an in-flight download or a pending install.
  if (state.phase === 'downloading' || state.phase === 'downloaded') return;
  try {
    await autoUpdater.checkForUpdates();
  } catch {
    // The 'error' event already carries the failure into the state machine.
    if (!automatic) return;
  }
}

export function getUpdateState(): UpdateState {
  return state;
}

export function initUpdater(): UpdateState {
  if (started) return state;
  started = true;

  state = {
    ...initialUpdateState(app.getVersion()),
    updaterEnabled: canAutoUpdate(),
  };

  if (!state.updaterEnabled) {
    broadcast();
    return state;
  }

  // User-decided downloads; installs on quit are fine (no forced restart).
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  // Stable channel only; GitHub provider needs no credentials for a public repo.
  autoUpdater.allowPrerelease = false;
  autoUpdater.logger = console;

  autoUpdater.on('checking-for-update', () => apply({ type: 'checking' }));

  autoUpdater.on('update-available', (info) => {
    const version = typeof (info as { version?: unknown })?.version === 'string' ? (info as { version: string }).version : '';
    const notes = extractReleaseNotes((info as { releaseNotes?: unknown })?.releaseNotes);
    const pageUrl = (info as { releasePageUrl?: unknown })?.releasePageUrl;
    const url = typeof pageUrl === 'string' && pageUrl.startsWith('https://') ? pageUrl : releaseUrlFor(version);
    apply({ type: 'available', version, notes, url });
  });

  autoUpdater.on('update-not-available', () => apply({ type: 'notAvailable' }));

  autoUpdater.on('download-progress', (progress) => {
    const p = progress as { percent?: number; transferred?: number; total?: number };
    apply({
      type: 'downloadProgress',
      percent: typeof p.percent === 'number' ? p.percent : -1,
      transferred: typeof p.transferred === 'number' ? p.transferred : 0,
      total: typeof p.total === 'number' ? p.total : 0,
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    apply({ type: 'downloaded' });
    notifyUpdateReady(typeof (info as { version?: unknown })?.version === 'string' ? (info as { version: string }).version : state.availableVersion ?? '');
  });

  autoUpdater.on('error', (err) => {
    const message = err instanceof Error ? err.message : String(err);
    apply({ type: 'error', message });
  });

  scheduleBootCheck();
  checkTimer = setInterval(() => {
    void checkForUpdates(true);
  }, UPDATE_CHECK_INTERVAL_MS);
  checkTimer.unref?.();

  broadcast();
  return state;
}

export function stopUpdaterTimers(): void {
  if (bootTimer) clearTimeout(bootTimer);
  if (checkTimer) clearInterval(checkTimer);
  bootTimer = null;
  checkTimer = null;
}
