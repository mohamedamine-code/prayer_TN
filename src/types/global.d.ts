import type { SalatiBridge } from '../../electron/preload';

declare global {
  interface Window {
    salati: SalatiBridge;
  }
}

export {};
