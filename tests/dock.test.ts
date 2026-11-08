import { describe, expect, it } from 'vitest';
import {
  ICON_H,
  ICON_W,
  WIDGET_H,
  WIDGET_W,
  clampAlong,
  dockIconRect,
  dockStateFromRect,
  expandAnchored,
  expandedRect,
  expandedSize,
  nearestEdge,
  tabCenterForWindow,
  validateDockState,
  type DockEdge,
  type WorkArea,
} from '../src/mini/dockLogic';

const WA: WorkArea = { x: 0, y: 0, width: 1920, height: 1040 }; // taskbar assumed at bottom

describe('nearestEdge', () => {
  it('picks the closest side', () => {
    expect(nearestEdge(3, 500, WA)).toBe('left');
    expect(nearestEdge(1917, 500, WA)).toBe('right');
    expect(nearestEdge(960, 2, WA)).toBe('top');
    expect(nearestEdge(960, 1038, WA)).toBe('bottom');
    expect(nearestEdge(960, 520, WA)).toBe('top'); // virtual tie -> top by order
  });

  it('takes the taskbar into account via the work area', () => {
    // Point near the bottom of the *work area* (taskbar excluded).
    expect(nearestEdge(960, WA.height - 6, WA)).toBe('bottom');
    expect(nearestEdge(960, 400, WA)).not.toBe('bottom'); // upper half
  });
});

describe('dockIconRect', () => {
  it('snaps flush against each edge', () => {
    const right = dockIconRect('right', 520, WA);
    expect(right.x).toBe(WA.width - ICON_W);
    expect(right.height).toBe(ICON_H);

    const left = dockIconRect('left', 520, WA);
    expect(left.x).toBe(WA.x);

    const top = dockIconRect('top', 600, WA);
    expect(top.y).toBe(WA.y);
    expect(top.width).toBe(ICON_W);

    const bottom = dockIconRect('bottom', 600, WA);
    expect(bottom.y).toBe(WA.height - ICON_H); // above the taskbar
  });

  it('keeps the whole tab inside the work area when clamping along the edge', () => {
    const low = dockIconRect('left', -999, WA);
    expect(low.y).toBeGreaterThanOrEqual(0);
    expect(low.y + ICON_H).toBeLessThanOrEqual(WA.height);

    const high = dockIconRect('top', 99_999, WA);
    expect(high.x + ICON_W).toBeLessThanOrEqual(WA.width);
    expect(high.x).toBeGreaterThanOrEqual(0);
  });
});

describe('clampAlong', () => {
  it('bounds the centre to keep the tab fully visible', () => {
    expect(clampAlong('left', 0, WA)).toBe(ICON_H / 2 + 2);
    expect(clampAlong('right', WA.height * 2, WA)).toBe(WA.height - ICON_H / 2 - 2);
    expect(clampAlong('bottom', -40, WA)).toBe(ICON_W / 2 + 2);
  });
});

describe('expandedRect', () => {
  it('extends inward from the docked edge and stays in the work area', () => {
    const right = expandedRect('right', 520, WA);
    expect(right.width).toBe(WIDGET_W + ICON_W);
    expect(right.x + right.width).toBe(WA.width);
    expect(right.height).toBe(WIDGET_H);

    const left = expandedRect('left', 520, WA);
    expect(left.x).toBe(WA.x);

    const top = expandedRect('top', 600, WA);
    expect(top.height).toBe(WIDGET_H + ICON_H);
    expect(top.y).toBe(WA.y);

    const bottom = expandedRect('bottom', 600, WA);
    expect(bottom.y + bottom.height).toBe(WA.height); // above the taskbar
  });

  it('keeps the expanded widget fully visible near screen corners', () => {
    const corner = expandedRect('right', 0, WA); // along clamped to top
    expect(corner.y).toBeGreaterThanOrEqual(WA.y);
    expect(corner.y + corner.height).toBeLessThanOrEqual(WA.height);

    const wide = expandedRect('top', 99_999, WA);
    expect(wide.x + wide.width).toBeLessThanOrEqual(WA.width);
  });
});

describe('tabCenterForWindow', () => {
  it('locates the tab for every orientation', () => {
    const right = tabCenterForWindow(expandedRect('right', 520, WA), 'right');
    expect(right.x).toBe(WA.width - ICON_W / 2);
    const top = tabCenterForWindow(expandedRect('top', 600, WA), 'top');
    expect(top.y).toBe(WA.y + ICON_H / 2);
  });
});

describe('expandedSize', () => {
  it('adds the tab along the dock axis only', () => {
    expect(expandedSize('left')).toEqual({ width: WIDGET_W + ICON_W, height: WIDGET_H });
    expect(expandedSize('bottom')).toEqual({ width: WIDGET_W, height: WIDGET_H + ICON_H });
  });
});

describe('validateDockState', () => {
  it('falls back to safe defaults on invalid input', () => {
    expect(validateDockState(undefined)).toEqual({ edge: 'right', along: -1, expanded: false });
    expect(validateDockState({ edge: 'diagonal', along: 'x', expanded: 1 })).toEqual({
      edge: 'right',
      along: -1,
      expanded: false,
    });
    expect(validateDockState({ edge: 'top', along: 420, expanded: false })).toEqual({
      edge: 'top',
      along: 420,
      expanded: false,
    });
  });
});

describe('dockStateFromRect', () => {
  it('migrates a legacy free-floating position to the nearest edge', () => {
    const s = dockStateFromRect({ x: 1880, y: 900, width: 320, height: 160 }, WA);
    expect(s.edge).toBe('right');
    expect(s.along).toBe(980);
    expect(s.expanded).toBe(false);
  });
});

describe('expandAnchored', () => {
  const EDGES: DockEdge[] = ['left', 'right', 'top', 'bottom'];

  it('keeps the tab pinned to the edge for left/right docking', () => {
    const left = expandAnchored('left', 520, WA);
    expect(left.rect.x).toBe(WA.x);
    expect(left.rect.width).toBe(WIDGET_W + ICON_W);
    expect(tabCenterForWindow(left.rect, 'left').y).toBe(520);

    const right = expandAnchored('right', 520, WA);
    expect(right.rect.x + right.rect.width).toBe(WA.width);
    expect(tabCenterForWindow(right.rect, 'right').x).toBe(WA.width - ICON_W / 2);
  });

  it('keeps the tab centred on its docked position when there is room', () => {
    const top = expandAnchored('top', 900, WA);
    expect(top.rect.x).toBe(900 - WIDGET_W / 2);
    expect(top.along).toBe(900);
    expect(tabCenterForWindow(top.rect, 'top').x).toBe(900);
    expect(top.rect.y).toBe(WA.y);
    expect(top.rect.width).toBe(WIDGET_W);
    expect(top.rect.height).toBe(WIDGET_H + ICON_H);

    const bottom = expandAnchored('bottom', 1500, WA);
    expect(bottom.rect.x).toBe(1500 - WIDGET_W / 2);
    expect(bottom.rect.y + bottom.rect.height).toBe(WA.height); // above the taskbar
  });

  it('clamps near screen corners and synchronises the along value with the rect', () => {
    const topCorner = expandAnchored('top', WA.width - 5, WA); // tab near right edge
    expect(topCorner.rect.x + topCorner.rect.width).toBe(WA.width);
    expect(topCorner.along).toBe(WA.width - WIDGET_W / 2);
    expect(tabCenterForWindow(topCorner.rect, 'top').x).toBe(topCorner.along);

    const leftCorner = expandAnchored('left', -999, WA); // clamped to top
    expect(leftCorner.rect.y).toBe(WA.y);
    expect(leftCorner.along).toBe(leftCorner.rect.y + WIDGET_H / 2); // expanded height / 2
    expect(tabCenterForWindow(leftCorner.rect, 'left').y).toBe(leftCorner.along);
  });

  it('always returns a rect fully inside the work area for every edge', () => {
    for (const edge of EDGES) {
      for (const along of [-999, 0, 500, 1000, 2000, 99_999]) {
        const fit = expandAnchored(edge, along, WA);
        expect(fit.along).toBeGreaterThanOrEqual(0);
        expect(fit.rect.x).toBeGreaterThanOrEqual(WA.x);
        expect(fit.rect.y).toBeGreaterThanOrEqual(WA.y);
        expect(fit.rect.x + fit.rect.width).toBeLessThanOrEqual(WA.x + WA.width);
        expect(fit.rect.y + fit.rect.height).toBeLessThanOrEqual(WA.y + WA.height);
      }
    }
  });

  it('keeps state and geometry consistent: tabCenterForWindow(anchored on collapsed) == tabCenterForWindow(anchored on expanded)', () => {
    for (const edge of EDGES) {
      const along = 1234;
      const fit = expandAnchored(edge, along, WA);
      const collapsed = dockIconRect(edge, fit.along, WA);
      const tabCollapsed = tabCenterForWindow(collapsed, edge);
      const tabExpanded = tabCenterForWindow(fit.rect, edge);
      // Along a docked edge, the tab must be at the same coordinate in both states.
      const coordCollapsed = edge === 'left' || edge === 'right' ? tabCollapsed.y : tabCollapsed.x;
      const coordExpanded = edge === 'left' || edge === 'right' ? tabExpanded.y : tabExpanded.x;
      expect(Math.abs(coordExpanded - coordCollapsed)).toBeLessThanOrEqual(1);
    }
  });
});
