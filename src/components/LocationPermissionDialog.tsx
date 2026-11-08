import { MapPin, ShieldCheck } from 'lucide-react';
import { useLocation } from '../hooks/useLocation';

/**
 * First-use location permission dialog (renderer UI only — the actual gate
 * is the Electron permission handler; coordinates are requested through
 * navigator.geolocation ONLY after the user clicks "Allow Location").
 */
export function LocationPermissionDialog(): JSX.Element | null {
  const { t, dialogOpen, allowLocation, notNow, dismissDialog } = useLocation();
  if (!dialogOpen) return null;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center p-3" style={{ background: 'rgba(6, 20, 13, 0.92)' }} role="dialog" aria-modal="true" aria-label={t.locPermTitle}>
      <div className="w-full rounded-2xl border border-[var(--border-strong)] bg-gradient-to-b from-[var(--shell-from)] to-[var(--bg-card)] p-4 shadow-2xl">
        <div className="flex items-center gap-2">
          <span className="rounded-xl bg-[var(--accent-soft)] p-2 text-[var(--accent)]">
            <MapPin className="h-5 w-5" />
          </span>
          <h2 className="text-[13px] font-semibold leading-snug text-[var(--text-primary)]">{t.locPermTitle}</h2>
        </div>

        <p className="mt-3 text-[11px] leading-relaxed text-[var(--text-muted)]">{t.locPermBody}</p>

        <p className="mt-2 flex items-start gap-1.5 text-[10px] leading-relaxed text-[var(--text-faint)]">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          {t.locPermPrivacy}
        </p>

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={notNow}
            className="rounded-lg border border-[var(--border-strong)] px-3 py-1.5 text-[11px] font-medium text-[var(--text-muted)] transition hover:bg-[var(--bg-card-hover)] hover:text-[var(--text-primary)]"
          >
            {t.locNotNow}
          </button>
          <button
            type="button"
            onClick={allowLocation}
            className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-[11px] font-semibold text-white transition hover:opacity-90"
          >
            {t.locAllow}
          </button>
        </div>

        <button
          type="button"
          onClick={dismissDialog}
          className="mt-3 w-full text-center text-[9px] text-[var(--text-faint)] underline-offset-2 hover:underline"
        >
          {t.locPermLater}
        </button>
      </div>
    </div>
  );
}
