import { useState, useEffect } from 'react';

// Current time as state, refreshed every `intervalMs` — keeps render pure (no Date.now() during render)
// and lets "in 40 min" style labels count down while the page stays open.
export function useNow(intervalMs = 60 * 1000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}
