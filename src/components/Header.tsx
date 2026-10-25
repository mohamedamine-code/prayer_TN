import { Settings, X, Minus, RefreshCw } from 'lucide-react';
import { getCity } from '../data/tunisianCities';
import { useSettings } from '../hooks/useSettings';
import { getDict } from '../i18n';
import { CrescentIcon } from './CrescentIcon';

interface Props {
  onOpenSettings: () => void;
  onRefresh: () => void;
}

export function Header({ onOpenSettings, onRefresh }: Props): JSX.Element {
  const { settings } = useSettings();
  const t = getDict(settings.language);
  const city = getCity(settings.cityId);
  const cityName = settings.language === 'ar' ? city.nameAr : city.nameFr;

  return (
    <header className="app-drag relative z-10 flex items-center gap-2 px-4 pt-3 pb-2">
      <CrescentIcon className="h-6 w-6 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-semibold tracking-wide text-[var(--text-primary)]">
          {settings.language === 'ar' ? t.appNameAr : t.appName}
          {settings.language === 'ar' ? '' : ' · ' + t.appNameAr}
        </div>
        <div className="truncate text-[10px] text-[var(--text-muted)]">{cityName}</div>
      </div>
      <div className="app-no-drag flex items-center gap-1">
        <button
          type="button"
          onClick={onRefresh}
          title={t.refresh}
          className="rounded-md p-1.5 text-[var(--text-muted)] transition hover:bg-[var(--bg-card-hover)] hover:text-[var(--accent)]"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onOpenSettings}
          title={t.settings}
          className="rounded-md p-1.5 text-[var(--text-muted)] transition hover:bg-[var(--bg-card-hover)] hover:text-[var(--accent)]"
        >
          <Settings className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => void window.salati?.closeWindow()}
          title={t.minimize}
          className="rounded-md p-1.5 text-[var(--text-muted)] transition hover:bg-[var(--bg-card-hover)] hover:text-[var(--text-primary)]"
        >
          <Minus className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => void window.salati?.closeWindow()}
          title={t.close}
          className="rounded-md p-1.5 text-[var(--text-muted)] transition hover:bg-[var(--bg-card-hover)] hover:text-[var(--danger)]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}
