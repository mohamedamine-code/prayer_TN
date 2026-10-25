import { describe, expect, it } from 'vitest';
import {
  CLOSE_ANIM_MS,
  OPEN_ANIM_MS,
  animFallbackMs,
  nextPhase,
  type DockPhase,
} from '../src/mini/dockPhase';

const PHASES: DockPhase[] = ['collapsed', 'open', 'opening', 'closing'];

describe('nextPhase', () => {
  it('opens into "opening" from any non-open state, and stays "open" if already open', () => {
    expect(nextPhase('collapsed', true)).toBe('opening');
    expect(nextPhase('opening', true)).toBe('opening');
    expect(nextPhase('closing', true)).toBe('opening');
    expect(nextPhase('open', true)).toBe('open');
  });

  it('closes into "closing" from any animating/open state, and stays collapsed if already collapsed', () => {
    expect(nextPhase('open', false)).toBe('closing');
    expect(nextPhase('opening', false)).toBe('closing');
    expect(nextPhase('closing', false)).toBe('closing');
    expect(nextPhase('collapsed', false)).toBe('collapsed');
  });

  it('is total: every (phase, expanded) combination yields a defined phase', () => {
    for (const prev of PHASES) {
      for (const expanded of [true, false]) {
        expect(PHASES).toContain(nextPhase(prev, expanded));
      }
    }
  });

  it('recovers from an early/late event pair (expanded toggled twice)', () => {
    // a missed expand event then a late expand event, then collapse
    const a = nextPhase('collapsed', true);
    const b = nextPhase(a, false);
    const c = nextPhase(b, true);
    expect([a, b, c]).toEqual(['opening', 'closing', 'opening']);
  });
});

describe('animFallbackMs', () => {
  it('allocates a failsafe only for animating phases', () => {
    expect(animFallbackMs('collapsed')).toBeNull();
    expect(animFallbackMs('open')).toBeNull();
    expect(animFallbackMs('opening')).toBe(OPEN_ANIM_MS + 150);
    expect(animFallbackMs('closing')).toBe(CLOSE_ANIM_MS + 150);
  });

  it('gives the keyframe headroom to finish (or for animationend to arrive)', () => {
    expect(animFallbackMs('opening')!).toBeGreaterThanOrEqual(OPEN_ANIM_MS);
    expect(animFallbackMs('closing')!).toBeGreaterThanOrEqual(CLOSE_ANIM_MS);
  });
});
