# How to Run — Salati Tunisia (صلاتي تونس)

Simple step-by-step guide in plain English.

---

## 1. Requirements

| Requirement | Details |
|---|---|
| Operating system | Windows 10 or Windows 11 |
| Node.js | Version 18 or newer (20 / 22 recommended) — https://nodejs.org |
| Internet | Needed the first time only, and to refresh prayer times |
| Disk space | About 1 GB (Electron is large) |

Check that Node.js is installed:

```powershell
node --version
```

You should see something like `v22.16.0`.

---

## 2. Open the project folder

```powershell
cd C:\Users\moham\OneDrive\Desktop\project\prayer\salati-tunisia
```

---

## 3. Install dependencies (first time only)

```powershell
npm install
```

Notes:

- This downloads about 400 packages **plus the Electron binary (~110 MB)**.
- On slow networks the Electron download may look frozen for several minutes — that is normal.
- If it fails with a network error, just run `npm install` again.

---

## 4. Run in development mode (with hot reload)

```powershell
npm run dev
```

What happens:

1. Vite starts a dev server on port 5173.
2. Electron opens the widget window.
3. Any change in `src/` refreshes the UI instantly.

Close the widget window to hide it — it keeps running in the system tray.
Right-click the tray icon to show it again or quit.

---

## 5. Run tests

```powershell
npm run test
```

Expected result:

```
Test Files  1 passed (1)
Tests       20 passed (20)
```

These tests cover the countdown logic: midnight rollover, the switch to
next-day Fajr after Isha, timezone handling, and date math.

---

## 6. Build for production

```powershell
npm run build
```

This does three things: type-checks the code, compiles the Electron main
process, and builds the React UI into `dist/`.

---

## 7. Run the production build (without installing)

```powershell
npm start
```

Or run the unpacked packaged app directly:

```powershell
release\win-unpacked\Salati Tunisia.exe
```

---

## 8. Create the Windows installer

```powershell
npm run dist
```

When it finishes, the installer is here:

```
release\Salati Tunisia Setup 1.0.0.exe
```

Run it and follow the steps (choose the install folder, desktop shortcut,
Start menu shortcut).

To only get the unpacked folder without the installer:

```powershell
npm run dist:dir
```

---

## 9. Daily usage after installing

| Action | How |
|---|---|
| Show widget | Click the tray icon, or open from the desktop shortcut |
| Hide widget | Close (X) button — the app stays in the tray |
| Quit completely | Tray icon → Quit |
| Change city, language, theme | Gear icon in the header |

Allow Windows notifications: **Settings → System → Notifications** must be
enabled, and the app should not be in "Do not disturb" exclusions.

---

## 10. Troubleshooting

| Problem | Fix |
|---|---|
| `npm install` freezes at the Electron download | Wait longer (slow networks), or run `npm install` again |
| App opens with no prayer times | Check your Internet connection, then press the refresh button (circular arrow) |
| No notifications | Windows Settings → System → Notifications → allow the app |
| Widget does not start with Windows | Settings → "Start with Windows" toggle |
| Wrong times | Settings → Calculation method → keep "Tunisia — Ministry of Religious Affairs" selected |

---

## Script summary

```text
npm run dev      → development with hot reload
npm run test     → unit tests (Vitest)
npm run build    → type-check + production build
npm start        → run the built app
npm run dist     → Windows installer (release folder)
npm run dist:dir → unpacked build only
```
