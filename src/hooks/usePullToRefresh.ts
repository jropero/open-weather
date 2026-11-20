import { useEffect, useRef, useState } from 'react';

/** Raw finger travel (px) that triggers a refresh on release. */
export const PULL_THRESHOLD = 70;
const MAX_PULL = 110;

/**
 * Touch pull-to-refresh: only when the page is at the top, no dialog is open and the gesture
 * starts as a downward drag. Passive listeners only (scrolling is never blocked; the browser's own
 * overscroll refresh is disabled in CSS). Returns the current pull distance (0 when idle).
 */
export function usePullToRefresh(onRefresh: () => void): number {
  const [pull, setPull] = useState(0);
  const cb = useRef(onRefresh);
  useEffect(() => {
    cb.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    const g = { startY: null as number | null, last: 0 };
    const canStart = () => window.scrollY <= 0 && !document.querySelector('dialog[open]');
    const reset = () => {
      g.startY = null;
      g.last = 0;
      setPull(0);
    };
    const onStart = (e: TouchEvent) => {
      g.startY = e.touches.length === 1 && canStart() ? e.touches[0].clientY : null;
    };
    const onMove = (e: TouchEvent) => {
      if (g.startY === null) return;
      const dy = e.touches[0].clientY - g.startY;
      if (dy <= 0 || window.scrollY > 0) return reset();
      g.last = dy;
      setPull(Math.min(dy, MAX_PULL));
    };
    const onEnd = () => {
      const fire = g.startY !== null && g.last > PULL_THRESHOLD;
      reset();
      if (fire) cb.current();
    };
    const opt = { passive: true } as const;
    window.addEventListener('touchstart', onStart, opt);
    window.addEventListener('touchmove', onMove, opt);
    window.addEventListener('touchend', onEnd, opt);
    window.addEventListener('touchcancel', reset, opt);
    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
      window.removeEventListener('touchcancel', reset);
    };
  }, []);

  return pull;
}
