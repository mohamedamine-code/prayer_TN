import { AlertTriangle, RefreshCw } from 'lucide-react';
import type { ApiError } from '../types/prayer';
import { useSettings } from '../hooks/useSettings';
import { getDict } from '../i18n';
import type { Dict } from '../i18n';

interface Props {
  error: ApiError | null;
  showNoData: boolean;
  onRetry: () => void;
}

function messageFor(t: Dict, error: ApiError | null): string {
  if (!error) return t.noData;
  switch (error.kind) {
    case 'network':
      return t.errorNetwork;
    case 'timeout':
      return t.errorTimeout;
    case 'invalid':
      return t.errorInvalid;
    case 'parse':
      return t.errorParse;
  }
}

export function ErrorView({ error, showNoData, onRetry }: Props): JSX.Element {
  const { settings } = useSettings();
  const t = getDict(settings.language);
  const body = showNoData && !error ? t.noData : messageFor(t, error);
  const isOffline = error?.kind === 'network';

  return (
    <section
      className="mx-4 mb-2 rounded-2xl border px-3 py-4 text-center"
      style={{
        borderColor: isOffline ? 'var(--border-subtle)' : 'rgba(248,113,113,0.35)',
        background: isOffline ? 'var(--bg-card)' : 'rgba(248,113,113,0.08)',
      }}
    >
      <AlertTriangle
        className={`mx-auto h-5 w-5 ${isOffline ? 'text-[var(--text-faint)]' : 'text-[var(--danger)]'}`}
      />
      <div className="mt-2 text-[12px] font-semibold text-[var(--text-primary)]">{t.errorTitle}</div>
      <div className="mt-1 text-[11px] leading-relaxed text-[var(--text-muted)]">{body}</div>
      <button
        type="button"
        onClick={onRetry}
        className="app-no-drag mt-3 inline-flex items-center gap-1.5 rounded-lg bg-[var(--accent-soft)] px-3 py-1.5 text-[11px] font-medium text-[var(--accent)] transition hover:bg-[var(--accent-soft)] hover:brightness-125"
      >
        <RefreshCw className="h-3 w-3" />
        {t.refreshNow}
      </button>
    </section>
  );
}
