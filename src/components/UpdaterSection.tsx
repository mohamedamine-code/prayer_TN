import { type ReactNode } from 'react';
import { Download, ExternalLink, RefreshCw, RotateCw } from 'lucide-react';
import { useUpdater } from '../hooks/useUpdater';
import { useSettings } from '../hooks/useSettings';
import { classifyUpdaterError, type UpdateState } from '../shared/updater';
import { getDict } from '../i18n';

function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '—';
  const mb = n / (1024 * 1024);
  if (mb < 1) return `${Math.round(n / 1024)} KB`;
  return `${mb.toFixed(1)} MB`;
}

function statusText(state: UpdateState, dict: ReturnType<typeof getDict>): string {
  if (!state.updaterEnabled) return dict.updaterDisabled;
  switch (state.phase) {
    case 'checking':
      return dict.updaterChecking;
    case 'available':
      return dict.updaterAvailable;
    case 'notAvailable':
      return dict.updaterUpToDate;
    case 'downloading':
      return dict.updaterDownloading;
    case 'downloaded':
      return dict.updaterDownloaded;
    case 'error': {
      const kind = state.errorKind ?? classifyUpdaterError(state.errorMessage ?? '');
      if (kind === 'network') return dict.updaterErrorNetwork;
      if (kind === 'metadata') return dict.updaterErrorMetadata;
      return dict.updaterErrorUnknown;
    }
    default:
      return dict.updaterAutoHint;
  }
}

/** Update section of the settings panel (About area). Pure view over the
 *  main-process updater state; every action is an explicit user click and
 *  the app is never restarted without confirmation. */
export function UpdaterSection({ onClose }: { onClose: () => void }): ReactNode {
  const { state, check, download, install } = useUpdater();
  const { settings } = useSettings();
  const t = getDict(settings.language);
  const rtl = settings.language === 'ar';

  const busy = state.phase === 'checking' || state.phase === 'downloading';
  const notes = state.releaseNotes?.trim() ?? '';

  return (
    <div className="space-y-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-3">
      <div className="space-y-1 text-[10px] leading-relaxed text-[var(--text-muted)]">
        <div className="flex justify-between gap-2">
          <span className="text-[var(--text-faint)]">{t.version}</span>
          <span className="font-semibold tabular-nums text-[var(--text-primary)]">{state.currentVersion || '—'}</span>
        </div>
        {state.availableVersion && (
          <div className="flex justify-between gap-2">
            <span className="text-[var(--text-faint)]">{t.updaterNewVersion}</span>
            <span className="font-semibold tabular-nums text-[var(--accent)]">{state.availableVersion}</span>
          </div>
        )}
        {state.lastCheckedAt !== null && (
          <div className="flex justify-between gap-2">
            <span className="text-[var(--text-faint)]">{t.updaterLastCheck}</span>
            <span>{new Date(state.lastCheckedAt).toLocaleTimeString()}</span>
          </div>
        )}
      </div>

      <div className="text-[10px] leading-relaxed text-[var(--text-muted)]" role="status">
        {statusText(state, t)}
        {state.phase === 'error' && state.errorMessage && (
          <span className="text-[var(--text-faint)]" title={state.errorMessage}>
            {' '}(?)
          </span>
        )}
      </div>

      {state.phase === 'downloading' && (
        <div>          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-input)]"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.max(0, state.progressPercent)}
          >
            <div
              className="h-full rounded-full bg-[var(--accent)] transition-all"
              style={{ width: `${Math.max(0, Math.min(100, state.progressPercent))}%` }}
            />
          </div>
          <div className="mt-1 text-[9px] tabular-nums text-[var(--text-faint)]">
            {state.progressPercent >= 0 ? `${state.progressPercent}%` : '…'} · {formatBytes(state.transferredBytes)}{' '}
            {t.updaterProgressOf} {formatBytes(state.totalBytes)}
          </div>
        </div>
      )}

      {(state.phase === 'available' || state.phase === 'error') && notes && (
        <div className="rounded-lg bg-[var(--bg-card-hover)] px-2.5 py-2 text-[10px] leading-relaxed text-[var(--text-muted)]">
          <div className="font-medium text-[var(--text-primary)]">{t.updaterReleaseNotes}</div>
          <p className="mt-1 line-clamp-4 whitespace-pre-line">{notes.slice(0, 400)}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-1.5">
        {state.phase !== 'downloaded' && (
          <button
            type="button"
            onClick={check}
            disabled={!state.updaterEnabled || busy}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-[var(--border-subtle)] py-1.5 text-[10px] text-[var(--text-muted)] transition hover:bg-[var(--bg-card-hover)] hover:text-[var(--accent)] disabled:opacity-40 disabled:hover:bg-transparent"
          >
            <RefreshCw className={`h-3 w-3 ${state.phase === 'checking' ? 'animate-spin' : ''}`} />
            {state.phase === 'checking' ? t.updaterChecking : t.updaterCheck}
          </button>
        )}

        {(state.phase === 'available' || (state.phase === 'error' && state.availableVersion !== null)) && (
          <button
            type="button"
            onClick={download}
            className="flex items-center justify-center gap-1.5 rounded-lg bg-[var(--accent-soft)] py-1.5 text-[10px] font-medium text-[var(--accent)] transition hover:brightness-110"
          >
            <Download className="h-3 w-3" />
            {t.updaterDownload}
          </button>
        )}

        {state.phase === 'downloaded' && (
          <>
            <button
              type="button"
              onClick={install}
              className="flex items-center justify-center gap-1.5 rounded-lg bg-[var(--accent-soft)] py-1.5 text-[10px] font-medium text-[var(--accent)] transition hover:brightness-110"
            >
              <RotateCw className="h-3 w-3" />
              {t.updaterRestartInstall}
            </button>
            <button
              type="button"
              onClick={() => dismissLater(onClose)}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-[var(--border-subtle)] py-1.5 text-[10px] text-[var(--text-muted)] transition hover:bg-[var(--bg-card-hover)]"
            >
              {t.updaterLater}
            </button>
          </>
        )}

        {state.releaseUrl && state.phase !== 'downloaded' && (
          <button
            type="button"
            onClick={() => void window.salati.openExternal(state.releaseUrl!)}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-[var(--border-subtle)] py-1.5 text-[10px] text-[var(--text-muted)] transition hover:bg-[var(--bg-card-hover)] hover:text-[var(--text-primary)]"
          >
            <ExternalLink className="h-3 w-3" />
            {t.updaterReleaseNotes}
          </button>
        )}
      </div>

      {!state.updaterEnabled && <p className="text-[9px] text-[var(--text-faint)]">{t.updaterDisabled}</p>}
      {state.phase === 'downloaded' && (
        <p className="text-[9px] leading-relaxed text-[var(--text-faint)]">
          {t.updaterLater}: {rtl ? 'سيُثبَّت التحديث عند الإغلاق التالي.' : 'l’installation se fera à la prochaine fermeture.'}
        </p>
      )}
    </div>
  );
}

/** "Later": dismiss the panel and keep working. The downloaded update is
 *  applied automatically on the next normal quit (autoInstallOnAppQuit). */
function dismissLater(onClose: () => void): void {
  onClose();
}
