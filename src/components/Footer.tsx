import type { JSX } from 'react';
import { useSettings } from '../hooks/useSettings';
import { getDict } from '../i18n';
import { CALC_METHOD_TUNISIA } from '../shared/settings';

export function Footer({
  lastUpdated,
  refreshing,
  online,
}: {
  lastUpdated: number | null;
  refreshing: boolean;
  online: boolean;
}): JSX.Element {
  const { settings } = useSettings();
  const t = getDict(settings.language);
  const isTunisiaMethod = settings.calculationMethod === CALC_METHOD_TUNISIA;

  const updated = lastUpdated
    ? new Date(lastUpdated).toLocaleTimeString(
        settings.language === 'en' ? 'en-GB' : settings.language === 'ar' ? 'ar-TN' : 'fr-TN',
        { hour: '2-digit', minute: '2-digit' },
      )
    : '—';

  return (
    <footer className="app-no-drag mx-4 mb-3 flex items-center justify-between gap-2 text-[10px] text-[var(--text-faint)]">
      <span className="truncate" title={t.methodTunisia}>
        {isTunisiaMethod ? t.methodTunisia : `${t.calculationMethod}: ${settings.calculationMethod}`}
      </span>
      <span className="flex shrink-0 items-center gap-1.5">
        {refreshing && <span className="animate-pulse-soft">…</span>}
        <span className="truncate">
          {t.lastUpdated} {updated}
        </span>
        <span
          className={`inline-block h-1.5 w-1.5 rounded-full ${
            online ? 'bg-[var(--accent)]' : 'bg-[var(--danger)]'
          }`}
          title={online ? t.connectionOnline : t.connectionOffline}
        />
      </span>
    </footer>
  );
}
