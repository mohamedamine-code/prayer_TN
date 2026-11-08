import type { ThemeMode } from '../types/prayer';

/**
 * Single shared theme resolution used by BOTH windows (principal widget and
 * floating widget): writes the resolved mode onto `html[data-theme]`, which
 * the CSS variable palettes read. Keeps one source of truth for themes.
 */
export function resolveTheme(theme: ThemeMode): 'dark' | 'light' {
  if (theme === 'light' || theme === 'dark') return theme;
  // 'system': follow the OS scheme when matchMedia is available.
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function applyTheme(theme: ThemeMode): void {
  document.documentElement.dataset.theme = resolveTheme(theme);
}

/** Apply the shared font-size token (small/medium/big) onto `html[data-font]`. */
export function applyFontSize(mode: 'small' | 'medium' | 'big' | undefined): void {
  document.documentElement.dataset.font = mode ?? 'medium';
}
