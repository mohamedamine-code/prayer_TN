# Salati Tunisia — صلاتي تونس

A lightweight Windows desktop widget that shows the five daily Islamic prayer
times for cities across Tunisia, with a live countdown to the next prayer,
optional desktop notifications, and full offline caching.

Built with **Electron + React + TypeScript + Vite + Tailwind CSS**, using the
[Aladhan API](https://aladhan.com/prayer-times-api) with the official
**Tunisian Ministry of Religious Affairs method (ID 18, Fajr 18° / Isha 18°)**.

---

## Features

- **Five daily prayers** — Fajr, Dhuhr, Asr, Maghrib, Isha in Arabic + French/English,
  24 h or 12 h display, next prayer highlighted, optional completed markers.
- **16 Tunisian cities** with real coordinates (Tunis, Sfax, Sousse, Gabès,
  Bizerte, Kairouan, Gafsa, Tozeur, Médenine, Djerba, Tataouine, Kasserine,
  Béja, Nabeul, Monastir, Mahdia) — searchable dropdown, persisted between runs.
- **Live countdown** — updates every second, switches automatically at prayer
  time, and continues to **next-day Fajr after Isha** (including past midnight).
- **Gregorian + Hijri dates** from the API.
- **Per-prayer notifications** — at prayer time, 5 or 10 minutes before, or off.
  De-duplicated across restarts.
- **Desktop widget behavior** — frameless, draggable, always-on-top option,
  system tray icon (show / hide / quit), remembered position & size,
  opacity control, start-with-Windows option.
- **Offline cache** — prayer times cached per city/method/madhab/date; works
  with no connection and never invents times (clear error state + retry).
- **Language** — French, Arabic (full RTL), or English.

> Note: prayer times come from Aladhan with the Tunisian calculation method.
> They are *not* certified by any official Tunisian authority — compare with
> your local mosque timetable if exactness matters to you.

---

## Quick start (development)

Requirements: **Node.js 18+** (Node 20/22 recommended) and Windows 10/11.

```bash
cd salati-tunisia
npm install      # downloads dependencies + the Electron binary (~110 MB, may be slow)
npm run dev      # starts Vite + Electron with hot reload
```

If the Electron binary download stalls (slow networks), download it manually
and re-run the installer:

```bash
curl.exe -L -o electron.zip ^
  https://github.com/electron/electron/releases/download/v33.4.11/electron-v33.4.11-win32-x64.zip
npm run  install   # or: node node_modules/electron/install.js after seeding ~\AppData\Local\electron\Cache
```

## Scripts

| Script               | What it does                                        |
| -------------------- | --------------------------------------------------- |
| `npm run dev`        | Development with hot reload (Vite + Electron)       |
| `npm run build`      | Type-check + compile electron main + build renderer |
| `npm run test`       | Unit tests (Vitest) for countdown/date logic        |
| `npm run dist`       | Windows NSIS installer into `release/`              |
| `npm run dist:dir`   | Unpacked build (quick packaging sanity check)       |
| `npm start`          | Run the built app from `dist/` + `dist-electron/`   |

## Build the Windows installer

```bash
npm run dist
```

Output: `release/Salati Tunisia Setup 1.0.0.exe` (NSIS installer, x64).
Use `npm run dist:dir` to produce an unpacked folder first if you want to test
quickly without installing.

## Debugging in VS Code

A launch configuration is provided (`.vscode/launch.json`):

1. Build once: `npm run build:electron`
2. Press **F5** — it compiles and starts the Electron main process with the
   VS Code debugger attached (breakpoints in `electron/main.ts` work thanks to
   sourcemaps from esbuild).
3. For the renderer, use `npm run dev` and Chrome DevTools
   (`Ctrl+Shift+I` is enabled in dev builds).

## Project structure

```
salati-tunisia/
├── electron/            # Main process (TypeScript, compiled by esbuild)
│   ├── main.ts          # Window, IPC handlers, settings store
│   ├── preload.ts       # contextBridge API (window.salati)
│   ├── notifications.ts # Windows notifications + de-duplication
│   ├── tray.ts          # Tray icon/menu
│   └── startup.ts       # Start-with-Windows registration
├── src/                 # Renderer (React + TypeScript + Tailwind)
│   ├── components/      # Header, DateDisplay, NextPrayer, PrayerList,
│   │                    # SettingsPanel, CitySelect, ErrorView, Footer
│   ├── hooks/           # usePrayerTimes, usePrayerCountdown,
│   │                    # usePrayerNotifications, useSettings, useHeartbeat
│   ├── services/        # prayerTimes (API + cache), storage (completed flags)
│   ├── data/            # tunisianCities.ts (16 cities + coordinates)
│   ├── logic/           # Pure countdown/timezone math (unit-tested)
│   ├── shared/          # Settings model shared by both processes
│   ├── types/           # TypeScript types
│   └── App.tsx, main.tsx
├── tests/               # Vitest unit tests
├── scripts/make-icons.js
└── build/               # Generated app icons
```

## How prayer times work

- On start, the app requests today's (and tomorrow's) timings from
  `https://api.aladhan.com/v1` with the selected city's **real
  latitude/longitude**, `method=18` (Tunisia), and the Asr madhab choice
  (`school=0` standard / `1` hanafi).
- All times are converted to **absolute UTC epoch values** using Africa/Tunis
  (UTC+1, no DST), so the countdown is correct at midnight, after sleep/wake,
  and after day rollovers — verified by unit tests in `tests/`.
- A **watchdog re-checks the Tunis-local date every 30 s**, on browser
  `online` events and on tab visibility changes, so the widget recovers after
  the PC wakes from sleep.
- Responses are cached in `localStorage`, keyed by
  `city + method + madhab + date`. Offline → cache; no cache → explicit error
  screen with a retry button (times are never faked).

## Notifications on Windows

The app uses standard Windows toast notifications. If nothing appears:

1. Windows Settings → **System → Notifications** → make sure notifications
   are on.
2. Ensure notifications for **Salati Tunisia** (or *Electron* in dev) are not
   disabled.
3. Use Focus assist exclusions if you run Focus sessions.

Notifications fire from the tray process even while the widget is hidden, and
a persisted "already notified" list prevents duplicates after restarts.

## Settings reference

City, language (FR/AR/EN), 12/24 h clock, calculation method (5 methods,
Tunisia default), Asr madhab, per-prayer notification mode, theme
(dark/light/system), widget opacity, always-on-top, start with Windows,
launch minimized to tray, and reset-to-defaults.

## Security model

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.
- The renderer only talks to the main process through the narrow `window.salati`
  bridge (validated IPC handlers, whitelisted external URLs).
- CSP set in `index.html` allowing API calls only to `api.aladhan.com`.

## Known limitations

- The desktop binary download during `npm install` can be slow on some
  networks (see Quick start).
- In development, Windows shows notifications as coming from *Electron*;
  the installed app uses the proper app identity.
- "Start with Windows" uses `app.setLoginItemSettings`, which registers the
  running executable — during development it registers the dev binary.
