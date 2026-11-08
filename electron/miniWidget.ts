import { BrowserWindow, Menu, MenuItemConstructorOptions, screen } from 'electron';
import path from 'node:path';
import type { MiniWidgetOptions } from '../src/shared/settings';
import { MINI_WIDGET_BOUNDS_KEY, MINI_WIDGET_OPTIONS_KEY, panelScaleFor, validateMiniOptions, validateSettings } from '../src/shared/settings';
import type { DockEdge, DockState, Rect } from '../src/mini/dockLogic';
import {
  dockIconRect,
  dockStateFromRect,
  expandAnchored,
  nearestEdge,
  tabCenterForWindow,
  validateDockState,
} from '../src/mini/dockLogic';

/** Structural subset of electron-store used here (keeps main store typing intact). */
interface MiniStore {
  get(key: string): unknown;
  set(key: string, value: unknown): void;
  delete(key: string): void;
}

const MINI_OPTIONS_KEY = MINI_WIDGET_OPTIONS_KEY;
const DOCK_KEY = 'miniDock';

let store: MiniStore | null = null;
let miniWin: BrowserWindow | null = null;
let isDev = false;
let dock: DockState = { edge: 'right', along: -1, expanded: false };
let snapTimer: NodeJS.Timeout | null = null;
let animTimer: NodeJS.Timeout | null = null;
let programmaticUntil = 0;
let closeHandler: (() => void) | null = null;
/* open/close transition state: repeated clicks are ignored while a
   transition runs; the close path ends on a renderer ack (or failsafe). */
let transitioning: 'open' | 'close' | null = null;
let transitionTimer: NodeJS.Timeout | null = null;
let closeFailsafe: NodeJS.Timeout | null = null;
/* Until the renderer signals its first (phase-correct) paint, the window must
   stay hidden - showing earlier is what produced the one-shot resize/white
   flash when the widget appeared. */
let pendingDockShow = false;
let readyFailsafe: NodeJS.Timeout | null = null;
const DOCK_READY_FAILSAFE_MS = 1500;
const OPEN_RELEASE_MS = 260;
const CLOSE_FAILSAFE_MS = 450;
const SNAP_MS = 180;

/* ---- manual dragging (CSS app-region drag is broken on transparent windows) ---- */

let dragActive = false;
let dragOffset = { x: 0, y: 0 };
let lastDragApply = 0;

/** Called with renderer `event.screenX/screenY` (CSS px == DIPs) on pointer down. */
export function dockDragStart(gx: number, gy: number): void {
  if (!miniWin || miniWin.isDestroyed()) return;
  if (transitioning) return;
  cancelSnapAnim();
  const pos = miniWin.getPosition();
  dragActive = true;
  dragOffset = { x: gx - pos[0]!, y: gy - pos[1]! };
}

export function dockDragMove(gx: number, gy: number): void {
  if (!dragActive || !miniWin || miniWin.isDestroyed()) return;
  const now = Date.now();
  if (now - lastDragApply < 12) return; // ≤ ~80 Hz; the renderer rAF-batches upstream
  lastDragApply = now;
  try {
    miniWin.setPosition(gx - dragOffset.x, gy - dragOffset.y, false);
  } catch {
    // window beaten up mid-drag: ignore
  }
}

export function dockDragEnd(): void {
  if (!dragActive) return;
  dragActive = false;
  snapAndSave();
}

/** Registered by main.ts: closes the widget and syncs the Settings toggle off. */
export function setMiniCloseHandler(fn: (() => void) | null): void {
  closeHandler = fn;
}

export function initMiniWidget(storeRef: MiniStore, dev: boolean): void {
  store = storeRef;
  isDev = dev;
  dock = loadDockState();
}

export function getMiniOptions(): MiniWidgetOptions {
  return validateMiniOptions(store?.get(MINI_OPTIONS_KEY));
}

/** Panel scale from the shared font-size setting (1 for medium/unknown).
 *  The CSS panel box scales by exactly this factor (mini.css --p-scale). */
function currentPanelScale(): number {
  try {
    return panelScaleFor(validateSettings(store?.get('settings')).fontSize);
  } catch {
    return 1;
  }
}

export function setMiniOptions(partial: { opacity?: number; alwaysOnTop?: boolean }): MiniWidgetOptions {
  const next = validateMiniOptions({ ...getMiniOptions(), ...partial });
  store?.set(MINI_OPTIONS_KEY, next);
  if (miniWin && !miniWin.isDestroyed()) {
    miniWin.setAlwaysOnTop(next.alwaysOnTop, 'screen-saver');
    if (process.platform === 'win32') miniWin.setOpacity(next.opacity);
  }
  return next;
}

/* ---------------- dock state (edge + position + expand flag) ---------------- */

function loadDockState(): DockState {
  let state = validateDockState(store?.get(DOCK_KEY));
  if (state.along < 0) {
    // First run with the dock feature: migrate the old free-floating position
    // into a docked edge, or default to the right edge mid-height.
    const legacy = store?.get(MINI_WIDGET_BOUNDS_KEY) as { x: number; y: number } | undefined;
    if (legacy && typeof legacy.x === 'number' && typeof legacy.y === 'number') {
      const wa = screen.getPrimaryDisplay().workArea;
      state = { ...dockStateFromRect({ x: legacy.x, y: legacy.y, width: 360, height: 160 }, wa), expanded: false };
    } else {
      const wa = screen.getPrimaryDisplay().workArea;
      state = { edge: 'right', along: wa.y + wa.height / 2, expanded: false };
    }
    if (legacy) store?.delete(MINI_WIDGET_BOUNDS_KEY);
    store?.set(DOCK_KEY, state);
  }
  return state;
}

export function getDockState(): DockState {
  return dock;
}

function saveDockState(): void {
  store?.set(DOCK_KEY, dock);
}

function emitDockChanged(): void {
  if (miniWin && !miniWin.isDestroyed()) miniWin.webContents.send('dock:changed', dock);
}

function currentWorkArea(): import('../src/mini/dockLogic').WorkArea {
  if (!miniWin || miniWin.isDestroyed()) return screen.getPrimaryDisplay().workArea;
  const b = miniWin.getBounds();
  return screen.getDisplayNearestPoint({ x: b.x + b.width / 2, y: b.y + b.height / 2 }).workArea;
}

function applyDockRect(opts: { emit?: boolean } = {}): void {
  if (!miniWin || miniWin.isDestroyed()) return;
  const wa = currentWorkArea();
  const anchored = dock.expanded ? expandAnchored(dock.edge, dock.along, wa, currentPanelScale()) : null;
  const rect = anchored ? anchored.rect : dockIconRect(dock.edge, dock.along, wa);
  setWindowRect(rect);
  if (anchored && anchored.along !== dock.along) {
    dock = { ...dock, along: anchored.along };
    saveDockState();
  }
  if (opts.emit !== false) emitDockChanged();
}

function setWindowRect(rect: Rect): void {
  if (!miniWin || miniWin.isDestroyed()) return;
  try {
    miniWin.setBounds(rect);
  } catch {
    // ignore transient WM failures; the settle handler re-applies if needed
  }
  programmaticUntil = Date.now() + 420;
}

/** Smooth, short eased snap tween for the collapsed tab; cancellable at any
 *  moment (drag start, toggle, destroy) so it never fights user input. */
function cancelSnapAnim(): void {
  if (animTimer !== null) {
    clearInterval(animTimer);
    animTimer = null;
  }
}

function animateTo(target: Rect, from: Rect): void {
  cancelSnapAnim();
  const start = Date.now();
  animTimer = setInterval(() => {
    if (!miniWin || miniWin.isDestroyed()) {
      cancelSnapAnim();
      return;
    }
    const t = Math.min(1, (Date.now() - start) / SNAP_MS);
    if (t >= 1) {
      setWindowRect(target);
      cancelSnapAnim();
      return;
    }
    const k = 1 - Math.pow(1 - t, 3);
    setWindowRect({
      x: Math.round(from.x + (target.x - from.x) * k),
      y: Math.round(from.y + (target.y - from.y) * k),
      width: from.width,
      height: from.height,
    });
  }, 16);
}

/* -------- drag handling: CSS drag region moves the window; the main process
   waits for the pointer to settle, then snaps to the nearest work-area edge. */

function onWindowMoved(): void {
  if (snapTimer) clearTimeout(snapTimer);
  snapTimer = setTimeout(settleAndSnap, 220);
}

function settleAndSnap(): void {
  snapTimer = null;
  if (!miniWin || miniWin.isDestroyed() || !miniWin.isVisible()) return;
  if (dragActive) return;
  if (Date.now() < programmaticUntil) return;
  snapAndSave();
}

function snapAndSave(): void {
  if (!miniWin || miniWin.isDestroyed() || !miniWin.isVisible()) return;
  const b = miniWin.getBounds();
  const wa = currentWorkArea();
  const tab = tabCenterForWindow(b, dock.edge);
  const newEdge = nearestEdge(tab.x, tab.y, wa);
  const rawAlong = newEdge === 'left' || newEdge === 'right' ? tab.y : tab.x;
  if (dock.expanded) {
    const anchored = expandAnchored(newEdge, rawAlong, wa, currentPanelScale());
    dock = { edge: newEdge, along: anchored.along, expanded: true };
    saveDockState();
    setWindowRect(anchored.rect);
  } else {
    dock = { edge: newEdge, along: rawAlong, expanded: false };
    saveDockState();
    animateTo(dockIconRect(newEdge, rawAlong, wa), b);
  }
  emitDockChanged();
}

export function flushMiniBounds(): void {
  forceFinishTransition();
  if (snapTimer) {
    clearTimeout(snapTimer);
    snapTimer = null;
    settleAndSnap();
  }
  if (animTimer !== null) cancelSnapAnim();
  saveDockState();
}

/* ------------------------------ window lifecycle ------------------------------ */

function getOrMiniCreate(): void {
  if (miniWin && !miniWin.isDestroyed()) return;
  const opts = getMiniOptions();
  const wa = screen.getPrimaryDisplay().workArea;
  /* Create directly at the CURRENT state's geometry (expanded or collapsed):
     the first visible frame must never require a later resize. */
  const anchored = dock.expanded ? expandAnchored(dock.edge, dock.along, wa, currentPanelScale()) : null;
  const initial = anchored ? anchored.rect : dockIconRect(dock.edge, dock.along, wa);

  miniWin = new BrowserWindow({
    width: initial.width,
    height: initial.height,
    x: initial.x,
    y: initial.y,
    useContentSize: true,
    frame: false,
    transparent: true,
    /* Fully transparent background so a not-yet-styled first frame cannot
       flash white/opaque ("ghost icon" when the widget is opened). */
    backgroundColor: '#00000000',
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    alwaysOnTop: opts.alwaysOnTop,
    skipTaskbar: true,
    hasShadow: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });
  miniWin.setAlwaysOnTop(opts.alwaysOnTop, 'screen-saver');
  if (process.platform === 'win32') miniWin.setOpacity(opts.opacity);
  miniWin.setMenuBarVisibility(false);

  miniWin.on('move', onWindowMoved);
  miniWin.on('close', (e) => {
    if (!e.defaultPrevented && miniWin) {
      e.preventDefault();
      hideMiniWidget();
      closeHandler?.();
    }
  });

  if (isDev) {
    void miniWin.loadURL(`${process.env.VITE_DEV_SERVER_URL!}mini.html`);
  } else {
    void miniWin.loadFile(path.join(__dirname, '..', 'dist', 'mini.html'));
  }
  /* Waiting for ready-to-show is not enough: the renderer must adopt the dock
     phase (React commits) before the first visible frame. It announces that
     via `mini:ready`; a failsafe covers a renderer that never signals. */
  pendingDockShow = true;
  readyFailsafe = setTimeout(() => {
    readyFailsafe = null;
    if (pendingDockShow) notifyDockReady();
  }, DOCK_READY_FAILSAFE_MS);
}

/** Renderer ack that the mini page painted with the correct dock phase:
 *  the first show happens now, at final geometry, with real content. */
export function notifyDockReady(): void {
  if (!miniWin || miniWin.isDestroyed()) return;
  if (!pendingDockShow) return;
  pendingDockShow = false;
  if (readyFailsafe) {
    clearTimeout(readyFailsafe);
    readyFailsafe = null;
  }
  applyDockRect({ emit: false });
  miniWin.show();
  emitDockChanged();
}

export function showMiniWidget(): void {
  getOrMiniCreate();
  if (!miniWin) return;
  if (pendingDockShow) return; // first show waits for the renderer signal
  applyDockRect();
  miniWin.show();
}

export function hideMiniWidget(): void {
  if (miniWin && !miniWin.isDestroyed()) {
    flushMiniBounds();
    miniWin.hide();
  }
}

export function destroyMiniWidget(): void {
  destroySnapTimer();
  pendingDockShow = false;
  if (readyFailsafe) {
    clearTimeout(readyFailsafe);
    readyFailsafe = null;
  }
  if (miniWin && !miniWin.isDestroyed()) miniWin.destroy();
  miniWin = null;
}

function destroySnapTimer(): void {
  if (snapTimer) {
    clearTimeout(snapTimer);
    snapTimer = null;
  }
  clearTransition();
  cancelSnapAnim();
}

export function isMiniVisible(): boolean {
  return !!miniWin && !miniWin.isDestroyed() && miniWin.isVisible();
}

export function applyMiniVisibility(visible: boolean): void {
  if (visible) showMiniWidget();
  else hideMiniWidget();
}

/** Chevron click: toggle between the tiny dock tab and the expanded widget.
 *
 *  Open: resize first (only the opaque tab is visible, so the resize itself is
 *  invisible), then let the renderer unfold the content with a CSS animation.
 *  Close: let the renderer retract the content while the window stays at its
 *  expanded size; on the renderer's `dock:collapseFinish` ack the window is
 *  resized back to the dock tab (visible content identical before/after the
 *  resize, so transparent-window flicker is impossible). Repeated clicks are
 *  ignored while a transition is running. */
export function toggleDock(): DockState {
  if (!miniWin || miniWin.isDestroyed()) return dock;
  if (transitioning) return dock;
  cancelSnapAnim();
  if (dock.expanded) {
    dock = { ...dock, expanded: false };
    saveDockState();
    if (miniWin.isVisible()) {
      transitioning = 'close';
      emitDockChanged();
      closeFailsafe = setTimeout(collapseFinish, CLOSE_FAILSAFE_MS);
    } else {
      setWindowRect(dockIconRect(dock.edge, dock.along, currentWorkArea()));
    }
    return dock;
  }
  transitioning = 'open';
  const wa = currentWorkArea();
  const anchored = expandAnchored(dock.edge, dock.along, wa, currentPanelScale());
  dock = { ...dock, expanded: true, along: anchored.along };
  saveDockState();
  if (!miniWin.isVisible()) miniWin.show();
  setWindowRect(anchored.rect);
  emitDockChanged();
  transitionTimer = setTimeout(() => {
    transitionTimer = null;
    transitioning = null;
  }, OPEN_RELEASE_MS);
  return dock;
}

/** Renderer ack that the close animation finished: now it is safe to shrink
 *  the window (only the tab is visible). Also run by the failsafe timer. */
export function collapseFinish(): void {
  if (transitioning !== 'close') return;
  clearTransition();
  saveDockState();
  if (!miniWin || miniWin.isDestroyed() || !miniWin.isVisible()) return;
  setWindowRect(dockIconRect(dock.edge, dock.along, currentWorkArea()));
  emitDockChanged();
}

/* Jump to the final state of a running transition (display change, quit). */
function forceFinishTransition(): void {
  if (!transitioning) return;
  const wasOpen = transitioning === 'open';
  clearTransition();
  if (!miniWin || miniWin.isDestroyed() || !miniWin.isVisible()) return;
  if (wasOpen) {
    setWindowRect(expandAnchored(dock.edge, dock.along, currentWorkArea(), currentPanelScale()).rect);
  } else {
    setWindowRect(dockIconRect(dock.edge, dock.along, currentWorkArea()));
  }
}

function clearTransition(): void {
  if (transitionTimer !== null) {
    clearTimeout(transitionTimer);
    transitionTimer = null;
  }
  if (closeFailsafe !== null) {
    clearTimeout(closeFailsafe);
    closeFailsafe = null;
  }
  transitioning = null;
}

/** Safe reposition after display changes / monitor unplug. */
export function refreshDockPlacement(): void {
  if (!miniWin || miniWin.isDestroyed()) return;
  if (transitioning) {
    forceFinishTransition();
    emitDockChanged();
  }
  if (!miniWin.isVisible()) return;
  applyDockRect();
}

/** Right-click menu on the widget: Always on top, Opacity, Close. */
export function popupMiniMenu(): void {
  const opts = getMiniOptions();
  const menu = Menu.buildFromTemplate([
    {
      label: 'Always on top',
      type: 'checkbox',
      checked: opts.alwaysOnTop,
      click: () => {
        setMiniOptions({ alwaysOnTop: !opts.alwaysOnTop });
      },
    },
    {
      label: 'Opacity',
      type: 'submenu',
      submenu: [
        0.5, 0.75, 0.9, 1,
      ].map(
        (v: number) =>
          ({
            label: `${Math.round(v * 100)}%`,
            type: 'radio',
            checked: Math.abs(opts.opacity - v) < 0.01,
            click: () => {
              setMiniOptions({ opacity: v });
            },
          }) as MenuItemConstructorOptions,
      ),
    },
    { type: 'separator' },
    {
      label: 'Close',
      click: () => {
        hideMiniWidget();
        closeHandler?.();
      },
    },
  ]);
  menu.popup({ window: miniWin ?? undefined });
}

export type { DockEdge };

