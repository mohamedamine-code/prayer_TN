import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { Settings } from '../types/prayer';
import { DEFAULT_SETTINGS } from '../shared/settings';

interface SettingsApi {
  settings: Settings;
  ready: boolean;
  update: (partial: Partial<Settings>) => void;
  reset: () => void;
}

const SettingsContext = createContext<SettingsApi | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let disposed = false;
    void window.salati
      .getSettings()
      .then((s) => {
        if (!disposed) setSettings(s);
      })
      .catch(() => {
        // Keep defaults if the bridge is unavailable (e.g. plain browser dev).
      })
      .finally(() => {
        if (!disposed) setReady(true);
      });

    const disposables: (() => void)[] = [];
    disposables.push(window.salati.onChanged(() => {
      void window.salati
        .getSettings()
        .then((s) => setSettings(s))
        .catch(() => undefined);
    }));

    return () => {
      disposed = true;
      disposables.forEach((d) => d());
    };
  }, []);

  const update = useCallback((partial: Partial<Settings>) => {
    setSettings((prev) => ({ ...prev, ...partial }));
    void window.salati.saveSettings(partial).catch(() => undefined);
  }, []);

  const reset = useCallback(() => {
    void window.salati
      .resetSettings()
      .then((s) => setSettings(s))
      .catch(() => undefined);
  }, []);

  return (
    <SettingsContext.Provider value={{ settings, ready, update, reset }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsApi {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside SettingsProvider');
  return ctx;
}
