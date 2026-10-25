import { contextBridge, ipcRenderer } from 'electron';
import type { Settings } from '../src/types/prayer';
import type { CompletionsStore } from '../src/shared/completions';
import type { DockState } from '../src/mini/dockLogic';

export interface SalatiBridge {
  getSettings(): Promise<Settings>;
  saveSettings(partial: Partial<Settings>): Promise<Settings>;
  resetSettings(): Promise<Settings>;
  /** Hide the widget to the tray (widget behaviour: "close" = hide). */
  closeWindow(): Promise<void>;
  notify(payload: { key: string; title: string; body: string }): Promise<boolean>;
  clearNotifications(): Promise<boolean>;
  openExternal(url: string): Promise<boolean>;
  toggleStartup(): Promise<boolean>;
  onChanged(cb: () => void): () => void;
  /** Mini floating widget bridge. */
  closeMini(): Promise<void>;
  openMiniMenu(): Promise<void>;
  /** Daily prayer tracker bridge (date-specific completion records). */
  getCompleted(): Promise<CompletionsStore>;
  setCompleted(dateKey: string, map: CompletionsStore[string]): Promise<CompletionsStore>;
  setCompletedAll(store: CompletionsStore): Promise<CompletionsStore>;
  onCompletedChanged(cb: () => void): () => void;
  /** Edge-docked floating icon bridge. */
  dockToggle(): Promise<DockState>;
  getDockState(): Promise<DockState>;
  onDockChanged(cb: (s: DockState) => void): () => void;
  dockDragStart(screenX: number, screenY: number): Promise<void>;
  dockDragMove(screenX: number, screenY: number): Promise<void>;
  dockDragEnd(): Promise<void>;
  /** Renderer ack that the retract animation finished (resizes the window). */
  dockCollapseFinish(): Promise<void>;
  /** First paint done with the correct dock phase: safe to show the window. */
  dockReady(): void;
}

const bridge: SalatiBridge = {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (partial) => ipcRenderer.invoke('settings:set', partial),
  resetSettings: () => ipcRenderer.invoke('settings:reset'),
  closeWindow: () => ipcRenderer.invoke('app:closeWindow'),
  notify: (payload) => ipcRenderer.invoke('app:notify', payload),
  clearNotifications: () => ipcRenderer.invoke('app:clearNotifications'),
  openExternal: (url) => ipcRenderer.invoke('app:openExternal', url),
  toggleStartup: () => ipcRenderer.invoke('app:startupToggle'),
  onChanged: (cb) => {
    const fn = () => cb();
    ipcRenderer.on('settings:changed', fn);
    return () => ipcRenderer.removeListener('settings:changed', fn);
  },
  closeMini: () => ipcRenderer.invoke('mini:requestClose'),
  openMiniMenu: () => ipcRenderer.invoke('mini:popupMenu'),
  getCompleted: () => ipcRenderer.invoke('completed:get'),
  setCompleted: (dateKey, map) => ipcRenderer.invoke('completed:set', dateKey, map),
  setCompletedAll: (store) => ipcRenderer.invoke('completed:setAll', store),
  onCompletedChanged: (cb) => {
    const fn = () => cb();
    ipcRenderer.on('completions:changed', fn);
    return () => ipcRenderer.removeListener('completions:changed', fn);
  },
  dockToggle: () => ipcRenderer.invoke('dock:toggle'),
  getDockState: () => ipcRenderer.invoke('dock:get'),
  onDockChanged: (cb) => {
    const fn = (_ev: unknown, s: DockState) => cb(s);
    ipcRenderer.on('dock:changed', fn);
    return () => ipcRenderer.removeListener('dock:changed', fn);
  },
  dockDragStart: (x, y) => ipcRenderer.invoke('dock:dragStart', x, y),
  dockDragMove: (x, y) => ipcRenderer.invoke('dock:dragMove', x, y),
  dockDragEnd: () => ipcRenderer.invoke('dock:dragEnd'),
  dockCollapseFinish: () => ipcRenderer.invoke('dock:collapseFinish'),
  dockReady: () => ipcRenderer.send('mini:ready'),
};

contextBridge.exposeInMainWorld('salati', bridge);
