import { useEffect, useState } from 'react';

/** Re-renders once per second with the current epoch ms.
 *  The single shared "heartbeat" for countdown + notifications. */
export function useHeartbeat(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}
