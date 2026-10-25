/** Expansion lifecycle state of the widget surface, kept pure and unit-testable:
 *  every transition (including early/late/missing dock:changed events) must
 *  always end in a state where panel visibility matches `expanded`. */

export type DockPhase = 'collapsed' | 'open' | 'opening' | 'closing';

export const OPEN_ANIM_MS = 220;
export const CLOSE_ANIM_MS = 190;

/** Next phase for a dock advancement with the given expanded flag. */
export function nextPhase(prev: DockPhase, expanded: boolean): DockPhase {
  if (expanded) return prev === 'open' ? 'open' : 'opening';
  return prev === 'collapsed' ? 'collapsed' : 'closing';
}

/** Duration after which a phase that got no `animationend` must force-finish,
 *  so a cancelled/never-started keyframe can never leave the panel invisible. */
export function animFallbackMs(phase: DockPhase): number | null {
  if (phase === 'opening') return OPEN_ANIM_MS + 150;
  if (phase === 'closing') return CLOSE_ANIM_MS + 150;
  return null;
}
