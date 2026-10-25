/** Pure geometry for the edge-docked floating icon. No Electron imports so it
 *  stays unit-testable; the main process feeds in display `workArea` values. */

export type DockEdge = 'left' | 'right' | 'top' | 'bottom';

export interface WorkArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Dock tab size (identical for all four edges: a small tab sideways). */
export const ICON_W = 40;
export const ICON_H = 56;
/** Expanded widget content size. */
export const WIDGET_W = 320;
export const WIDGET_H = 160;
/** Keep-away margins so no pixel of the tab sits outside the work area. */
export const EDGE_INSET = 2;

/** Expanded window dimensions per orientation (tab + widget, seamless). */
export function expandedSize(edge: DockEdge): { width: number; height: number } {
  if (edge === 'left' || edge === 'right') return { width: ICON_W + WIDGET_W, height: WIDGET_H };
  return { width: WIDGET_W, height: ICON_H + WIDGET_H };
}

/** Edge of the work area nearest to a point (ties resolved deterministically). */
export function nearestEdge(px: number, py: number, wa: WorkArea): DockEdge {
  const right = wa.x + wa.width;
  const bottom = wa.y + wa.height;
  const dists: [DockEdge, number][] = [
    ['left', px - wa.x],
    ['right', right - px],
    ['top', py - wa.y],
    ['bottom', bottom - py],
  ];
  dists.sort((a, b) => a[1] - b[1]);
  return dists[0]![0];
}

/** Clamped centre coordinate along the docked edge (keeps the full tab clickable). */
export function clampAlong(edge: DockEdge, along: number, wa: WorkArea): number {
  const right = wa.x + wa.width;
  const bottom = wa.y + wa.height;
  if (edge === 'left' || edge === 'right') {
    return Math.min(Math.max(along, wa.y + ICON_H / 2 + EDGE_INSET), bottom - ICON_H / 2 - EDGE_INSET);
  }
  return Math.min(Math.max(along, wa.x + ICON_W / 2 + EDGE_INSET), right - ICON_W / 2 - EDGE_INSET);
}

/** Collapsed dock tab rect, flush against the edge of the work area. */
export function dockIconRect(edge: DockEdge, along: number, wa: WorkArea): Rect {
  const right = wa.x + wa.width;
  const bottom = wa.y + wa.height;
  const a = clampAlong(edge, along, wa);
  if (edge === 'left') return { x: wa.x, y: a - ICON_H / 2, width: ICON_W, height: ICON_H };
  if (edge === 'right') return { x: right - ICON_W, y: a - ICON_H / 2, width: ICON_W, height: ICON_H };
  if (edge === 'top') return { x: a - ICON_W / 2, y: wa.y, width: ICON_W, height: ICON_H };
  return { x: a - ICON_W / 2, y: bottom - ICON_H, width: ICON_W, height: ICON_H };
}

/** Expanded window rect: widget beside the tab, extending inward, fully inside
 *  the work area (never over the taskbar, never off-screen). */
export function expandedRect(edge: DockEdge, along: number, wa: WorkArea): Rect {
  const size = expandedSize(edge);
  const right = wa.x + wa.width;
  const bottom = wa.y + wa.height;
  let rect: Rect;
  if (edge === 'left') {
    rect = { x: wa.x, y: along - size.height / 2, width: size.width, height: size.height };
  } else if (edge === 'right') {
    rect = { x: right - size.width, y: along - size.height / 2, width: size.width, height: size.height };
  } else if (edge === 'top') {
    rect = { x: along - size.width / 2, y: wa.y, width: size.width, height: size.height };
  } else {
    rect = { x: along - size.width / 2, y: bottom - size.height, width: size.width, height: size.height };
  }
  rect.y = Math.min(Math.max(rect.y, wa.y), bottom - size.height);
  rect.x = Math.min(Math.max(rect.x, wa.x), right - size.width);
  return rect;
}

/** Expanded rect (tab centred inside it, matching the DOM layout) whose
 *  `along` value is synchronised with the clamped rect, so the tab position
 *  recorded in state always matches what is actually rendered. Without the
 *  synchronisation the icon would re-locate itself after an expand near a
 *  screen corner, and a later collapse would restore a different spot. */
export function expandAnchored(edge: DockEdge, along: number, wa: WorkArea): { rect: Rect; along: number } {
  const size = expandedSize(edge);
  const right = wa.x + wa.width;
  const bottom = wa.y + wa.height;
  if (edge === 'left') {
    const y = Math.min(Math.max(along - size.height / 2, wa.y), bottom - size.height);
    return { rect: { x: wa.x, y, width: size.width, height: size.height }, along: y + size.height / 2 };
  }
  if (edge === 'right') {
    const y = Math.min(Math.max(along - size.height / 2, wa.y), bottom - size.height);
    return {
      rect: { x: right - size.width, y, width: size.width, height: size.height },
      along: y + size.height / 2,
    };
  }
  if (edge === 'top') {
    const x = Math.min(Math.max(along - size.width / 2, wa.x), right - size.width);
    return { rect: { x, y: wa.y, width: size.width, height: size.height }, along: x + size.width / 2 };
  }
  const x = Math.min(Math.max(along - size.width / 2, wa.x), right - size.width);
  return { rect: { x, y: bottom - size.height, width: size.width, height: size.height }, along: x + size.width / 2 };
}

/** Screen position of the dock tab while the window has `rect` (any edge). */
export function tabCenterForWindow(rect: Rect, edge: DockEdge): { x: number; y: number } {
  if (edge === 'left') return { x: rect.x + ICON_W / 2, y: rect.y + rect.height / 2 };
  if (edge === 'right') return { x: rect.x + rect.width - ICON_W / 2, y: rect.y + rect.height / 2 };
  if (edge === 'top') return { x: rect.x + rect.width / 2, y: rect.y + ICON_H / 2 };
  return { x: rect.x + rect.width / 2, y: rect.y + rect.height - ICON_H / 2 };
}

/** Nearest display work area for a point (falls back to the primary display). */
export function workAreaForPoint(displays: { workArea: WorkArea; bounds: WorkArea }[], px: number, py: number): WorkArea {
  const inside = displays.find((d) => {
    const b = d.bounds;
    return px >= b.x && px < b.x + b.width && py >= b.y && py < b.y + b.height;
  });
  return inside?.workArea ?? displays[0]!.workArea;
}

/* ---- persistence shape ---- */

export interface DockState {
  edge: DockEdge;
  /** Centre coordinate along the docked edge (y for left/right, x for top/bottom). */
  along: number;
  expanded: boolean;
}

const EDGES: readonly DockEdge[] = ['left', 'right', 'top', 'bottom'];

export function validateDockState(raw: unknown): DockState {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const edge = EDGES.includes(obj.edge as DockEdge) ? (obj.edge as DockEdge) : 'right';
  const along = typeof obj.along === 'number' && Number.isFinite(obj.along) ? obj.along : -1;
  return { edge, along, expanded: obj.expanded === true };
}

/** Derive a dock state from a stored free-floating position (pre-dock era). */
export function dockStateFromRect(rect: { x: number; y: number; width: number; height: number }, wa: WorkArea): DockState {
  const edge = nearestEdge(rect.x + rect.width / 2, rect.y + rect.height / 2, wa);
  const along = edge === 'left' || edge === 'right' ? rect.y + rect.height / 2 : rect.x + rect.width / 2;
  return { edge, along, expanded: false };
}
