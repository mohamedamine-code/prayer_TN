import { type ReactNode } from 'react';
import { X, RotateCcw, Bell, BellOff, BellRing } from 'lucide-react';
import type { RadioGroupOptions } from './RadioGroup';
import { RadioGroup } from './RadioGroup';
import { CitySelect } from './CitySelect';
import { useSettings } from '../hooks/useSettings';
import { getDict, RADIO_LANGS, prayerName } from '../i18n';
import type {
  NotifMode,
  PrayerKey,
  Settings,
  ThemeMode,
} from '../types/prayer';
import { CALC_METHODS } from '../shared/settings';

export function SettingsPanel({ onClose }: { onClose: () => void }): JSX.Element {
  const { settings, update, reset } = useSettings();
  const t = getDict(settings.language);
  const rtl = settings.language === 'ar';
  const dir = rtl ? 'rtl' : 'ltr';

  const notifModes: { value: NotifMode; label: string; icon: typeof Bell }[] = [
    { value: 'none', label: t.notifNone, icon: BellOff },
    { value: 'atTime', label: t.notifAtTime, icon: Bell },
    { value: '5min', label: t.notif5min, icon: BellRing },
    { value: '10min', label: t.notif10min, icon: BellRing },
  ];

  const themeOptions: { value: ThemeMode; label: string }[] = [
    { value: 'dark', label: t.themeDark },
    { value: 'light', label: t.themeLight },
    { value: 'system', label: t.themeSystem },
  ];

  const clockOptions = [
    { value: '24h' as const, label: t['24h'] },
    { value: '12h' as const, label: t['12h'] },
  ];

  const methodOptions = CALC_METHODS.map((m) => ({
    value: String(m.id),
    label: `${m.label}${m.params ? ` (${m.params})` : ''}`,
  }));

  const asrOptions: RadioGroupOptions<Settings['asrMadhab']> = [
    { value: 'standard', label: t.asrStandard },
    { value: 'hanafi', label: t.asrHanafi },
  ];

  return (
    <div
      className="absolute inset-0 z-40 flex flex-col"
      style={{ background: 'rgba(6, 20, 13, 0.97)' }}
      dir={dir}
    >
      <div
        className={
          rtl ? '' : 'pattern-islamic pointer-events-none absolute inset-0 opacity-40'
        }
        aria-hidden="true"
      />
      <header className="app-drag flex items-center justify-between border-b border-[var(--border-subtle)] px-4 py-3">
        <h2 className="text-[13px] font-semibold text-[var(--text-primary)]">{t.settings}</h2>
        <button
          type="button"
          onClick={onClose}
          className="app-no-drag rounded-md p-1.5 text-[var(--text-muted)] transition hover:bg-[var(--bg-card-hover)] hover:text-[var(--text-primary)]"
          aria-label={t.close}
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="app-no-drag flex min-h-0 flex-1 flex-col space-y-5 overflow-y-auto px-4 py-4">
        <Field label={t.city}>
          <CitySelect
            value={settings.cityId}
            onChange={(cityId) => update({ cityId })}
            language={settings.language}
          />
        </Field>

        <Field label={t.language}>
          <RadioGroup
            value={settings.language}
            options={RADIO_LANGS as unknown as RadioGroupOptions<Settings['language']>}
            onChange={(v) => update({ language: v as Settings['language'] })}
          />
        </Field>

        <Field label={t.clockFormat}>
          <RadioGroup
            value={settings.clockFormat}
            options={clockOptions as unknown as RadioGroupOptions<Settings['clockFormat']>}
            onChange={(v) => update({ clockFormat: v })}
          />
        </Field>

        <Field label={t.calculationMethod}>
          <RadioGroup
            value={String(settings.calculationMethod)}
            options={methodOptions}
            onChange={(v) => update({ calculationMethod: Number(v) })}
            stacked
          />
        </Field>

        <Field label={t.asrMadhab}>
          <RadioGroup
            value={settings.asrMadhab}
            options={asrOptions}
            onChange={(v) => update({ asrMadhab: v as Settings['asrMadhab'] })}
          />
        </Field>

        <Field label={t.theme}>
          <RadioGroup
            value={settings.theme}
            options={themeOptions as unknown as RadioGroupOptions<ThemeMode>}
            onChange={(v) => update({ theme: v as ThemeMode })}
          />
        </Field>

        <Field label={`${t.opacity} — ${Math.round(settings.opacity * 100)}%`}>
          <input
            type="range"
            min={60}
            max={100}
            value={Math.round(settings.opacity * 100)}
            onChange={(e) => update({ opacity: Number(e.target.value) / 100 })}
            className="w-full accent-[var(--accent)]"
          />
        </Field>

        <section>
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            {t.notifications}
          </h3>
          <PrayerNotificationRows modes={notifModes} rtl={rtl} />
          <p className="mt-2 text-[10px] leading-relaxed text-[var(--text-faint)]">
            {t.notificationHint}
          </p>
        </section>

        <section className="space-y-2.5">
          <ToggleRow
            label={t.showFloatingWidget}
            checked={settings.showFloatingWidget}
            onChange={(v) => update({ showFloatingWidget: v })}
          />
          <ToggleRow
            label={t.alwaysOnTop}
            checked={settings.alwaysOnTop}
            onChange={(v) => update({ alwaysOnTop: v })}
          />
          <ToggleRow
            label={t.startWithWindows}
            checked={settings.startWithWindows}
            onChange={(v) => update({ startWithWindows: v })}
          />
          <ToggleRow
            label={t.launchMinimized}
            checked={settings.launchMinimized}
            onChange={(v) => update({ launchMinimized: v })}
          />
        </section>

        <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-3">
          <div className="text-[11px] font-semibold text-[var(--text-primary)]">{t.about}</div>
          <div className="mt-1 text-[10px] text-[var(--text-muted)]">
            {t.appName} {t.appNameAr} — {t.version} 1.0.0
          </div>
          <div className="text-[10px] text-[var(--text-faint)]">
            {t.lastUpdated}: {new Date().getFullYear()} · {t.methodTunisia}
          </div>
        </section>

        <button
          type="button"
          onClick={reset}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--border-strong)] py-2 text-[12px] font-medium text-[var(--text-muted)] transition hover:bg-[var(--bg-card-hover)] hover:text-[var(--danger)]"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          {t.resetSettings}
        </button>
      </div>
    </div>
  );
}

function PrayerNotificationRows({
  modes,
  rtl,
}: {
  modes: { value: NotifMode; label: string; icon: typeof Bell }[];
  rtl: boolean;
}): JSX.Element {
  const { settings, update } = useSettings();
  const prayers: PrayerKey[] = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
  return (
    <div className="space-y-2">
      {prayers.map((p) => {
        const current = settings.notifications[p];
        return (
          <div
            key={p}
            className="flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-2"
          >
            <span className="flex-1 truncate text-[12px] font-medium text-[var(--text-primary)]">
              {rtl ? prayerName(p, 'ar') : prayerName(p, settings.language)}
            </span>
            <div className="flex gap-1">
              {modes.map((m) => {
                const Icon = m.icon;
                const active = current === m.value;
                return (
                  <button
                    key={m.value}
                    type="button"
                    title={m.label}
                    onClick={() =>
                      update({ notifications: { ...settings.notifications, [p]: m.value } })
                    }
                    className={`rounded-md p-1 transition ${
                      active
                        ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                        : 'text-[var(--text-faint)] hover:bg-[var(--bg-card-hover)] hover:text-[var(--text-muted)]'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
      <div className="text-[9px] text-[var(--text-faint)]">{modes.map((m) => m.label).join(' · ')}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }): JSX.Element {
  return (
    <div>
      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-muted)]">
        {label}
      </div>
      {children}
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}): JSX.Element {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[12px] text-[var(--text-primary)]">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`app-no-drag relative h-5 w-9 shrink-0 rounded-full transition ${
          checked ? 'bg-[var(--accent)]' : 'bg-[var(--bg-input)] border border-[var(--border-strong)]'
        }`}
      >
        <span
          className={`absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white transition-all ${
            checked ? 'left-[18px]' : 'left-[3px]'
          }`}
        />
      </button>
    </div>
  );
}
