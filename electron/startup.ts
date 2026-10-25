import { app } from 'electron';

/**
 * Windows "start with Windows" via the supported Electron API
 * (registry Run key through app.setLoginItemSettings — no external dependency).
 * Works reliably for the installed app; in development it registers the
 * electron.exe path of the dev binary.
 */
export function setLoginItemSetting(enable: boolean): void {
  try {
    app.setLoginItemSettings({
      openAtLogin: enable,
      path: process.execPath,
      args: process.platform === 'win32' ? ['--hidden'] : [],
    });
  } catch {
    // Registry access can fail in restricted environments; non-fatal.
  }
}

export function getCurrentStartupSetting(): boolean {
  try {
    return app.getLoginItemSettings({
      path: process.execPath,
      args: process.platform === 'win32' ? ['--hidden'] : [],
    }).openAtLogin;
  } catch {
    return false;
  }
}
