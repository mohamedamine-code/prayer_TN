import { useCallback, useEffect, useState } from 'react';
import { initialUpdateState, type UpdateState } from '../shared/updater';

/** Renderer-side view of the main-process updater. Reads the current state
 *  once, then follows 'update:state' broadcasts. Never touches the updater
 *  library itself — all work happens in the main process. */
export function useUpdater(): {
  state: UpdateState;
  check: () => void;
  download: () => void;
  install: () => void;
} {
  const [state, setState] = useState<UpdateState>(() => initialUpdateState(''));

  useEffect(() => {
    let disposed = false;
    void window.salati
      .getUpdateState()
      .then((s) => {
        if (!disposed) setState(s);
      })
      .catch(() => undefined);

    const dispose = window.salati.onUpdateState((s) => setState(s));
    return () => {
      disposed = true;
      dispose();
    };
  }, []);

  const check = useCallback(() => {
    setState((prev) => ({ ...prev, phase: 'checking', errorMessage: null, errorKind: null }));
    void window.salati
      .checkForUpdates()
      .then(setState)
      .catch(() => undefined);
  }, []);

  const download = useCallback(() => {
    void window.salati
      .downloadUpdate()
      .then(setState)
      .catch(() => undefined);
  }, []);

  const install = useCallback(() => {
    void window.salati.installUpdate().catch(() => undefined);
  }, []);

  return { state, check, download, install };
}
