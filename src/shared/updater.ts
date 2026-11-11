/**
 * Shared update-system contract (main process + renderer + tests).
 * Pure data only: no electron/electron-updater imports here.
 */

/** GitHub release repository (explicit configuration, same for every version). */
export const GITHUB_OWNER = 'mohamedamine-code';
export const GITHUB_REPO = 'prayer_TN';

/** Public release page for a given version (used by "View release notes"). */
export function releaseUrlFor(version: string): string {
  return `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/tag/v${version}`;
}

/** Automatic re-check cadence while the app runs (6h — avoids API spam). */
export const UPDATE_CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;

/** First check after startup — delayed so it never blocks the widget. */
export const UPDATE_BOOT_CHECK_DELAY_MS = 30_000;

/** Strict semver tag guard: refuse to offer/install malformed versions. */
export function isValidVersion(version: unknown): boolean {
  if (typeof version !== 'string') return false;
  return /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(version);
}

export type UpdaterErrorKind = 'network' | 'metadata' | 'unknown';

/** Classify an updater error message for user-facing i18n text. */
export function classifyUpdaterError(message: string): UpdaterErrorKind {
  const m = message.toLowerCase();
  if (
    /enotfound|enetunreach|econnrefused|econnreset|etimedout|eai_again|econnaborted|err_inernet|err_internet|err_network|err_connection|err_name|getaddrinfo|net::|timed out|socket|offline/.test(
      m,
    )
  ) {
    return 'network';
  }
  if (/app-update|latest\.yml|sha512|checksum|signature|manifest|metadata|release/.test(m)) {
    return 'metadata';
  }
  return 'unknown';
}

/* ------------------------------------------------------------------ */
/* State + reducer (pure, unit-tested)                                 */
/* ------------------------------------------------------------------ */

export type UpdatePhase =
  | 'idle'
  | 'checking'
  | 'available'
  | 'notAvailable'
  | 'downloading'
  | 'downloaded'
  | 'error';

export interface UpdateState {
  /** Current machine phase. */
  phase: UpdatePhase;
  /** Version of the running application (app.getVersion()). */
  currentVersion: string;
  /** Whether the updater service is enabled at all (packaged prod builds). */
  updaterEnabled: boolean;
  /** Latest release version offered by the repository (validated). */
  availableVersion: string | null;
  /** Human-readable release notes (plain text, truncated). */
  releaseNotes: string | null;
  /** URL of the release page on GitHub. */
  releaseUrl: string | null;
  /** Download progress (0-100, -1 while unknown). */
  progressPercent: number;
  /** Bytes transferred / total (0 while unknown). */
  transferredBytes: number;
  totalBytes: number;
  /** Raw error message of the last failure (null when fine). */
  errorMessage: string | null;
  /** Classified error kind for i18n. */
  errorKind: UpdaterErrorKind | null;
  /** Timestamp of the last finished check (epoch ms). */
  lastCheckedAt: number | null;
}

export type UpdateEvent =
  | { type: 'checking' }
  | { type: 'available'; version: string; notes: string | null; url: string | null }
  | { type: 'notAvailable' }
  | { type: 'downloadProgress'; percent: number; transferred: number; total: number }
  | { type: 'downloaded' }
  | { type: 'error'; message: string };

export function initialUpdateState(currentVersion: string): UpdateState {
  return {
    phase: 'idle',
    currentVersion,
    updaterEnabled: false,
    availableVersion: null,
    releaseNotes: null,
    releaseUrl: null,
    progressPercent: -1,
    transferredBytes: 0,
    totalBytes: 0,
    errorMessage: null,
    errorKind: null,
    lastCheckedAt: null,
  };
}

/** Clamp helper: electron-updater can emit NaN / Infinity on broken feeds. */
function clampPercent(percent: number): number {
  if (!Number.isFinite(percent) || percent < 0) return -1;
  return Math.min(100, Math.max(0, Math.round(percent * 10) / 10));
}

function clampBytes(n: number): number {
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

/** Pure state machine over electron-updater events. */
export function reduceUpdateEvent(state: UpdateState, event: UpdateEvent): UpdateState {
  switch (event.type) {
    case 'checking':
      // A new check re-enters 'checking' from any non-download phase.
      if (state.phase === 'downloading' || state.phase === 'downloaded') return state;
      return {
        ...state,
        phase: 'checking',
        errorMessage: null,
        errorKind: null,
      };

    case 'available': {
      if (state.phase === 'downloading' || state.phase === 'downloaded') return state;
      // Refuse to offer an update whose version tag is not valid semver.
      if (!isValidVersion(event.version)) {
        return {
          ...state,
          phase: 'error',
          errorMessage: `Invalid update metadata: version "${String(event.version)}"`,
          errorKind: 'metadata',
          lastCheckedAt: Date.now(),
        };
      }
      return {
        ...state,
        phase: 'available',
        availableVersion: event.version,
        releaseNotes: event.notes,
        releaseUrl: event.url,
        errorMessage: null,
        errorKind: null,
        lastCheckedAt: Date.now(),
      };
    }

    case 'notAvailable':
      if (state.phase === 'downloading' || state.phase === 'downloaded') return state;
      return {
        ...state,
        phase: 'notAvailable',
        availableVersion: null,
        releaseNotes: null,
        releaseUrl: null,
        progressPercent: -1,
        transferredBytes: 0,
        totalBytes: 0,
        errorMessage: null,
        errorKind: null,
        lastCheckedAt: Date.now(),
      };

    case 'downloadProgress': {
      // The first progress event transitions into 'downloading' (also from
      // 'available' and from a failed attempt the user re-triggers).
      const canStart =
        state.phase === 'downloading' ||
        state.phase === 'available' ||
        (state.phase === 'error' && state.availableVersion !== null);
      if (!canStart) return state;
      return {
        ...state,
        phase: 'downloading',
        progressPercent: clampPercent(event.percent),
        transferredBytes: clampBytes(event.transferred),
        totalBytes: clampBytes(event.total),
      };
    }

    case 'downloaded':
      // Fast feeds may complete without any intermediate progress event.
      if (state.phase !== 'downloading' && state.phase !== 'available') return state;
      return {
        ...state,
        phase: 'downloaded',
        progressPercent: 100,
      };

    case 'error': {
      // A failure while the update is already downloaded must not erase the
      // pending install; every other phase surfaces the error to the user.
      if (state.phase === 'downloaded') return state;
      return {
        ...state,
        phase: 'error',
        errorMessage: event.message.slice(0, 500),
        errorKind: classifyUpdaterError(event.message),
        lastCheckedAt: Date.now(),
      };
    }

    default:
      return state;
  }
}
