import { ipcMain, session, BrowserWindow } from 'electron';

import type {
  StoredLocation,
  LocationConsent,
} from '../src/shared/location';
import {
  DEFAULT_LOCATION,
  LOCATION_STORE_KEY,
  validateLocationState,
} from '../src/shared/location';

/** Structural subset of electron-store used by this module. */
interface MainStore {
  get(key: string): unknown;
  set(key: string, value: unknown): void;
}

/**
 * Location feature (main process).
 *
 * The most strict permission policy available in Electron is installed on the
 * default session:
 *
 *  - ONLY geolocation may ever be requested; every other Chromium permission
 *    (media, notifications, midi, ...) is denied outright.
 *  - The requesting renderer must be one of this app's own trusted origins
 *    (Vite dev server origin in dev, a packaged file:// page in production).
 *  - Even for trusted origins, geolocation is only approved when the user has
 *    explicitly granted consent via the in-app dialog, so coordinates can
 *    never be silently obtained before consent.
 *
 * The custom dialog in the renderer intentionally runs BEFORE any
 * `navigator.geolocation` call; the Electron permission machinery below is the
 * real gate, not a fake.
 */
export function initLocation(store: MainStore, devOrigin: string | null): void {
  const ses = session.defaultSession;

  const isTrustedSender = (wc: Electron.WebContents): boolean => {
    try {
      const url = new URL(wc.getURL());
      if (url.protocol === 'devtools:' || url.protocol === 'chrome:' || url.protocol === 'chrome-extension:') {
        return false;
      }
      if (devOrigin && url.origin === devOrigin.replace(/\/$/, '')) return true;
      // Packaged application pages are loaded from the app resources via file://
      if (!devOrigin && url.protocol === 'file:') return true;
      return false;
    } catch {
      return false;
    }
  };

  const consentAllowsGeolocation = (): boolean => {
    return validateLocationState(store.get(LOCATION_STORE_KEY)).consent === 'granted';
  };

  // Chromium consults this synchronous handler FIRST for geolocation; a false
  // answer fails the call with PERMISSION_DENIED without ever showing anything.
  ses.setPermissionCheckHandler((_wc, permission, requestingOrigin) => {
    if (permission !== 'geolocation') return false;
    const devOk = devOrigin && requestingOrigin === devOrigin.replace(/\/$/, '');
    const fileOk = !devOrigin && requestingOrigin === 'file://';
    if (!devOk && !fileOk) return false;
    return consentAllowsGeolocation();
  });

  ses.setPermissionRequestHandler((wc, permission, callback) => {
    if (permission !== 'geolocation' || !isTrustedSender(wc) || !consentAllowsGeolocation()) {
      callback(false);
      return;
    }
    callback(true);
  });

  const broadcast = (state: StoredLocation): void => {
    for (const w of BrowserWindow.getAllWindows()) {
      if (!w.isDestroyed()) w.webContents.send('location:changed', state);
    }
  };

  const read = (): StoredLocation => validateLocationState(store.get(LOCATION_STORE_KEY));

  ipcMain.handle('location:getState', (_ev): StoredLocation => read());

  ipcMain.handle('location:setConsent', (ev, c: unknown): StoredLocation => {
    if (!isTrustedSender(ev.sender)) return read();
    const next: LocationConsent = c === 'granted' ? 'granted' : c === 'declined' ? 'declined' : 'unset';
    const merged = validateLocationState({
      ...read(),
      consent: next,
      // A fresh consent cycle starts with no coordinates until a fix arrives.
      ...(next === 'granted' ? {} : { lat: null, lon: null, accuracyM: null, updatedAt: null }),
    });
    store.set(LOCATION_STORE_KEY, merged);
    broadcast(merged);
    return merged;
  });

  ipcMain.handle('location:pushFix', (ev, fix: unknown): StoredLocation => {
    if (!isTrustedSender(ev.sender)) return read();
    const current = read();
    // Hard gate: never persist coordinates without explicit consent.
    if (current.consent !== 'granted') return current;
    const f = (typeof fix === 'object' && fix !== null ? fix : {}) as Record<string, unknown>;
    const accRaw = typeof f.accuracyM === 'number' ? f.accuracyM : f.accuracy;
    const merged = validateLocationState({
      ...current,
      lat: typeof f.lat === 'number' ? f.lat : current.lat,
      lon: typeof f.lon === 'number' ? f.lon : current.lon,
      accuracyM: typeof accRaw === 'number' ? accRaw : current.accuracyM,
      updatedAt: typeof f.timestamp === 'number' ? f.timestamp : Date.now(),
    });
    store.set(LOCATION_STORE_KEY, merged);
    broadcast(merged);
    return merged;
  });

  ipcMain.handle('location:setCity', (ev, labels: unknown): StoredLocation => {
    if (!isTrustedSender(ev.sender)) return read();
    const l = (typeof labels === 'object' && labels !== null ? labels : {}) as Record<string, unknown>;
    const current = read();
    const merged = validateLocationState({
      ...current,
      city: typeof l.city === 'string' ? l.city : current.city,
      country: typeof l.country === 'string' ? l.country : current.country,
    });
    store.set(LOCATION_STORE_KEY, merged);
    broadcast(merged);
    return merged;
  });

  ipcMain.handle('location:clear', (ev): StoredLocation => {
    if (!isTrustedSender(ev.sender)) return read();
    const current = read();
    const merged = validateLocationState({ ...current, ...DEFAULT_LOCATION, consent: current.consent });
    store.set(LOCATION_STORE_KEY, merged);
    broadcast(merged);
    return merged;
  });
}
