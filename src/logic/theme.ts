import type { ThemeMode } from '../types/prayer';

/**
 * Single shared theme resolution used by BOTH windows (principal widget and
 * floating widget): writes the resolved mode onto `html[data-theme]`, which
 * the CSS variable palettes read. Keeps one source of truth for themes.
 */
export type ResolvedTheme = 'dark' | 'light' | 'emerald-glass';

export const THEME_STORAGE_KEY = 'salati-theme';

const RESOLVED_THEMES: ResolvedTheme[] = ['dark', 'light', 'emerald-glass'];

export function resolveTheme(theme: ThemeMode): ResolvedTheme {
  if (theme === 'light' || theme === 'dark' || theme === 'emerald-glass') return theme;
  // 'system': follow the OS scheme when matchMedia is available.
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function applyTheme(theme: ThemeMode): void {
  const resolved = resolveTheme(theme);
  document.documentElement.dataset.theme = resolved;
  // Mirror the resolved theme so the choice survives reloads and is restored
  // before the async settings bridge answers (no flash of the wrong theme).
  try {
    localStorage.setItem(THEME_STORAGE_KEY, resolved);
  } catch {
    /* storage unavailable (plain browser privacy mode) — ignore */
  }
}

/** Restore the last applied theme from localStorage, if it is a known value. */
export function restoreStoredTheme(): void {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (RESOLVED_THEMES.includes(stored as ResolvedTheme)) {
      document.documentElement.dataset.theme = stored as ResolvedTheme;
    }
  } catch {
    /* ignore */
  }
}

/** Apply the shared font-size token (small/medium/big) onto `html[data-font]`. */
export function applyFontSize(mode: 'small' | 'medium' | 'big' | undefined): void {
  document.documentElement.dataset.font = mode ?? 'medium';
}
