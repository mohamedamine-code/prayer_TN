import { useState } from 'react';
import { type ReactNode } from 'react';
import { X, RotateCcw, Bell, BellOff, BellRing, MapPin, RefreshCw, ClipboardList, Trash2, Hand, Clock4, Sun, Moon, Sparkles, Monitor } from 'lucide-react';
import type { RadioGroupOptions } from './RadioGroup';
import { RadioGroup } from './RadioGroup';
import { CitySelect } from './CitySelect';
import { useSettings } from '../hooks/useSettings';
import { useLocation } from '../hooks/useLocation';
import { useUpdater } from '../hooks/useUpdater';
import { UpdaterSection } from './UpdaterSection';
import { getDict, RADIO_LANGS, prayerName } from '../i18n';
import type {
  FontSizeMode,
  NotifMode,
  PrayerKey,
  Settings,
  ThemeMode,
} from '../types/prayer';
import {
  CALC_METHODS,
  DEFAULT_IQAMA_DELAYS,
  parseIqamaDelayInput,
} from '../shared/settings';

export function SettingsPanel({ onClose }: { onClose: () => void }): JSX.Element {
  const { settings, update, reset } = useSettings();
  const { state } = useUpdater();
  const t = getDict(settings.language);
  const rtl = settings.language === 'ar';
  const dir = rtl ? 'rtl' : 'ltr';

  const notifModes: { value: NotifMode; label: string; icon: typeof Bell }[] = [
    { value: 'none', label: t.notifNone, icon: BellOff },
    { value: 'atTime', label: t.notifAtTime, icon: Bell },
    { value: '5min', label: t.notif5min, icon: BellRing },
    { value: '10min', label: t.notif10min, icon: BellRing },
  ];

  const themeOptions: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
    { value: 'light', label: t.themeLight, icon: Sun },
    { value: 'dark', label: t.themeDark, icon: Moon },
    { value: 'emerald-glass', label: t.themeEmerald, icon: Sparkles },
    { value: 'system', label: t.themeSystem, icon: Monitor },
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

  const fontOptions: { value: FontSizeMode; label: string }[] = [
    { value: 'small', label: t.fontSmall },
    { value: 'medium', label: t.fontMedium },
    { value: 'big', label: t.fontBig },
  ];

  return (
    <div
      className="absolute inset-0 z-40 flex flex-col"
      style={{ background: 'var(--bg-body-2)' }}
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
        <AutomaticLocationSection />

        <Field label={t.city}>
          <CitySelect
            value={settings.cityId}
            onChange={(cityId) => update({ cityId })}
            language={settings.language}
          />
        </Field>

        <Field label={t.iqamaConfig}>
          <IqamaConfigSection />
        </Field>

        <Field label={t.iqamaFocus}>
          <FocusModeSection />
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

        <Field label={t.fontSize}>
          <RadioGroup
            value={settings.fontSize}
            options={fontOptions as unknown as RadioGroupOptions<FontSizeMode>}
            onChange={(v) => update({ fontSize: v as FontSizeMode })}
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
            {t.appName} {t.appNameAr} — {t.version} {state.currentVersion || '—'}
          </div>
          <div className="text-[10px] text-[var(--text-faint)]">
            {t.lastUpdated}: {new Date().getFullYear()} · {t.methodTunisia}
          </div>
        </section>

        <Field label={t.updaterSection}>
          <UpdaterSection onClose={onClose} />
        </Field>

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

/** Manual Iqama delays: one independent numeric input per prayer (minutes).
 *  Mandatory minimum of 5 minutes; whole minutes only. Invalid values show
 *  an error and are never saved (the shared settings service re-validates
 *  as well). Iqama = daily prayer time + configured delay. */
function IqamaConfigSection(): JSX.Element {
  const { settings, update } = useSettings();
  const t = getDict(settings.language);
  const rtl = settings.language === 'ar';
  const prayers: PrayerKey[] = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];

  // Local drafts so typing an in-progress value never persists an invalid one.
  const [drafts, setDrafts] = useState<Partial<Record<PrayerKey, string>>>({});
  const [errors, setErrors] = useState<Partial<Record<PrayerKey, string>>>({});

  const commit = (p: PrayerKey, raw: string): void => {
    const parsed = parseIqamaDelayInput(raw);
    if (parsed.ok) {
      setErrors((prev) => ({ ...prev, [p]: undefined }));
      if (parsed.value !== settings.iqamaDelays[p]) {
        update({ iqamaDelays: { ...settings.iqamaDelays, [p]: parsed.value } });
      }
    } else {
      setErrors((prev) => ({ ...prev, [p]: convertedError(parsed.error, t) }));
    }
  };

  const valueFor = (p: PrayerKey): string => {
    const draft = drafts[p];
    if (draft !== undefined) return draft;
    const saved = settings.iqamaDelays[p];
    return typeof saved === 'number' ? String(saved) : '';
  };

  return (
    <div className="space-y-2">
      {prayers.map((p) => {
        const err = errors[p];
        return (
          <div key={p} className="space-y-1">
            <div className="flex items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] px-3 py-2">
              <Clock4 className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" />
              <span className="flex-1 truncate text-[12px] font-medium text-[var(--text-primary)]">
                {prayerName(p, rtl ? 'ar' : settings.language)}
              </span>
              <button
                type="button"
                title={t.minusDelay}
                onClick={() => {
                  const saved = typeof settings.iqamaDelays[p] === 'number' ? (settings.iqamaDelays[p] as number) : 5;
                  const next = String(Math.max(5, saved - 1));
                  setDrafts((prev) => ({ ...prev, [p]: next }));
                  setErrors((prev) => ({ ...prev, [p]: undefined }));
                  commit(p, next);
                }}
                disabled={(typeof settings.iqamaDelays[p] === 'number' ? (settings.iqamaDelays[p] as number) : 5) <= 5}
                className="rounded-md px-1.5 text-[12px] leading-none text-[var(--text-muted)] transition hover:bg-[var(--bg-card-hover)] hover:text-[var(--text-primary)] disabled:opacity-30"
              >
                −
              </button>
              <input
                type="number"
                inputMode="numeric"
                min={5}
                max={120}
                step={1}
                value={valueFor(p)}
                placeholder="5"
                onChange={(e) => {
                  const v = e.target.value;
                  setDrafts((prev) => ({ ...prev, [p]: v }));
                  if (v.trim() === '') setErrors((prev) => ({ ...prev, [p]: t.iqamaErrorMin }));
                  else commit(p, v);
                }}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v !== '' && parseIqamaDelayInput(v).ok) commit(p, v);
                  // Revert invalid drafts to the saved value on blur.
                  setDrafts((prev) => ({ ...prev, [p]: undefined }));
                  setErrors((prev) => ({ ...prev, [p]: undefined }));
                }}
                className={`w-14 rounded-lg border bg-[var(--bg-input)] px-2 py-1 text-center text-[12px] font-semibold tabular-nums text-[var(--text-primary)] outline-none transition focus:border-[var(--accent)] ${
                  err ? 'border-[var(--danger)] focus:border-[var(--danger)]' : 'border-[var(--border-subtle)]'
                } ${rtl ? 'text-left' : ''}`}
              />
              <button
                type="button"
                title={t.plusDelay}
                onClick={() => {
                  const saved = typeof settings.iqamaDelays[p] === 'number' ? (settings.iqamaDelays[p] as number) : 5;
                  const next = String(Math.min(120, saved + 1));
                  setDrafts((prev) => ({ ...prev, [p]: next }));
                  setErrors((prev) => ({ ...prev, [p]: undefined }));
                  commit(p, next);
                }}
                className="rounded-md px-1.5 text-[12px] leading-none text-[var(--text-muted)] transition hover:bg-[var(--bg-card-hover)] hover:text-[var(--text-primary)]"
              >
                +
              </button>
              <span className="w-9 text-right text-[10px] text-[var(--text-faint)]">{t.minutes}</span>
            </div>
            {err && (
              <div className="pl-8 text-[10px] font-medium text-[var(--danger)]" role="alert">
                {err}
              </div>
            )}
          </div>
        );
      })}
      <div className="flex items-center justify-between gap-2 pt-0.5">
        <p className="text-[9px] leading-relaxed text-[var(--text-faint)]">{t.iqamaDelayHint}</p>
        <button
          type="button"
          onClick={() => {
            setDrafts({});
            setErrors({});
            update({ iqamaDelays: { ...DEFAULT_IQAMA_DELAYS } });
          }}
          className="shrink-0 rounded-lg border border-[var(--border-strong)] px-2.5 py-1 text-[10px] text-[var(--text-muted)] transition hover:bg-[var(--bg-card-hover)] hover:text-[var(--danger)]"
        >
          {t.iqamaResetDefaults}
        </button>
      </div>
    </div>
  );
}

function convertedError(error: 'invalid' | 'min' | 'max', t: ReturnType<typeof getDict>): string {
  if (error === 'invalid') return t.iqamaErrorInvalid;
  if (error === 'min') return t.iqamaErrorMin;
  return t.iqamaErrorMax;
}

/** Iqama Focus Mode: dedicated countdown/progress view from Adhan until
 *  Iqama plus a single-per-day Windows notification. The active focus
 *  duration is derived per prayer (Iqama − prayer timestamp, honouring the
 *  5-min minimum of the manual delay); no fixed duration applies. */
function FocusModeSection(): JSX.Element {
  const { settings, update } = useSettings();
  const t = getDict(settings.language);

  return (
    <div className="space-y-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-3">
      <ToggleRow
        label={t.iqamaFocus}
        checked={settings.iqamaFocusEnabled}
        onChange={(v) => update({ iqamaFocusEnabled: v })}
      />
      <p className="text-[9px] leading-relaxed text-[var(--text-faint)]">{t.iqamaFocusHint}</p>
    </div>
  );
}

/** Automatic Location control group (Section 6 of the location feature). */
function AutomaticLocationSection(): JSX.Element {
  const { settings } = useSettings();
  const loc = useLocation();
  const t = getDict(settings.language);
  const s = loc.state;

  const permLabel =
    s.consent === 'granted' ? t.locPermGranted : s.consent === 'declined' ? t.locPermDeclined : t.locPermNotAsked;

  const lastCity =
    s.city && s.country ? `${s.city}, ${s.country}` : s.city ?? loc.placeLabel ?? '—';
  const lastUpdate = s.updatedAt !== null ? new Date(s.updatedAt).toLocaleTimeString() : '—';
  const statusText =
    loc.status === 'detecting'
      ? t.locDetecting
      : loc.status === 'unavailable'
        ? `${t.locUnavailable}${loc.errorDetail ? ` — ${loc.errorDetail}` : ''}`
        : loc.status === 'prompt' || loc.status === 'denied'
          ? `${t.locLocked} — ${permLabel}`
          : loc.status === 'active'
            ? t.locActive
            : t.locManualHint;

  return (
    <Field label={t.locSection}>
      <div className="space-y-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-card)] p-3">
        <ToggleRow
          label={t.locToggle}
          checked={settings.locationEnabled}
          onChange={(v) => loc.setEnabled(v)}
        />

        <div className="space-y-1 text-[10px] leading-relaxed text-[var(--text-muted)]">
          <div className="flex justify-between gap-2">
            <span className="text-[var(--text-faint)]">{t.locPermission}</span>
            <span>{permLabel}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-[var(--text-faint)]">{t.locLastCity}</span>
            <span className="max-w-[60%] truncate" title={lastCity}>{lastCity}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-[var(--text-faint)]">{t.locLastUpdate}</span>
            <span>{lastUpdate}</span>
          </div>
          {s.accuracyM !== null && (
            <div className="flex justify-between gap-2">
              <span className="text-[var(--text-faint)]">GPS ±</span>
              <span>±{s.accuracyM} m</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={loc.refresh}
            disabled={s.consent !== 'granted' || !settings.locationEnabled}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-[var(--border-subtle)] py-1.5 text-[10px] text-[var(--text-muted)] transition hover:bg-[var(--bg-card-hover)] hover:text-[var(--accent)] disabled:opacity-40 disabled:hover:bg-transparent"
          >
            <RefreshCw className="h-3 w-3" />
            {t.locRefresh}
          </button>
          <button
            type="button"
            onClick={loc.useManualCity}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-[var(--border-subtle)] py-1.5 text-[10px] text-[var(--text-muted)] transition hover:bg-[var(--bg-card-hover)] hover:text-[var(--text-primary)]"
          >
            <Hand className="h-3 w-3" />
            {t.locManualBtn}
          </button>
          <button
            type="button"
            onClick={loc.clearStored}
            disabled={s.lat === null && s.updatedAt === null}
            className="col-span-2 flex items-center justify-center gap-1.5 rounded-lg border border-[var(--border-subtle)] py-1.5 text-[10px] text-[var(--text-muted)] transition hover:bg-[var(--bg-card-hover)] hover:text-[var(--danger)] disabled:opacity-40 disabled:hover:bg-transparent"
          >
            <Trash2 className="h-3 w-3" />
            {t.locClear}
          </button>
        </div>

        {/* Denied explanation (no auto retry, manual path offered). */}
        {(loc.status === 'denied' || loc.status === 'prompt') && settings.locationEnabled && (
          <div className="rounded-lg bg-[var(--bg-card-hover)] px-2.5 py-2 text-[10px] leading-relaxed text-[var(--text-muted)]">
            <div className="flex items-center gap-1.5 font-medium text-[var(--text-primary)]">
              <MapPin className="h-3 w-3" />
              {t.locDenyTitle}
            </div>
            <p className="mt-1">{t.locDenyBody}</p>
            <p className="mt-1 text-[var(--text-faint)]">{t.locWindowsHint}</p>
            <button
              type="button"
              onClick={loc.openDialog}
              className="mt-2 rounded-md border border-[var(--border-strong)] px-2 py-1 text-[10px] text-[var(--text-primary)] transition hover:bg-[var(--bg-card)]"
            >
              {t.locRetry}
            </button>
          </div>
        )}

        {/* Unavailable error (device could not fix a position): no crash, manual retry. */}
        {loc.status === 'unavailable' && (
          <div className="flex items-center justify-between gap-2 rounded-lg bg-[var(--bg-card-hover)] px-2.5 py-2 text-[10px] text-[var(--text-muted)]">
            <span className="truncate">{loc.errorDetail ?? t.locUnavailable}</span>
            <button
              type="button"
              onClick={loc.refresh}
              className="shrink-0 rounded-md border border-[var(--border-strong)] px-2 py-1 text-[10px] text-[var(--text-primary)] transition hover:bg-[var(--bg-card)]"
            >
              {t.locRetry}
            </button>
          </div>
        )}

        <p className="text-[9px] leading-relaxed text-[var(--text-faint)]">{statusText}</p>
      </div>
      <p className="mt-1.5 flex items-start gap-1.5 text-[10px] leading-relaxed text-[var(--text-faint)]">
        <ClipboardList className="mt-0.5 h-3 w-3 shrink-0" />
        {t.locManualHint}
      </p>
    </Field>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }): JSX.Element {  return (
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
