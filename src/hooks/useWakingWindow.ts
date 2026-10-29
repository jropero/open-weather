import { useState } from 'react';
import type { WakingWindow } from '../types/weather';

const STORAGE_KEY = 'waking_window';
export const DEFAULT_WAKING_WINDOW: WakingWindow = { start: 7, end: 23 };

function isValid(w: unknown): w is WakingWindow {
  const { start, end } = (w ?? {}) as Partial<WakingWindow>;
  return Number.isInteger(start) && Number.isInteger(end) && start! >= 0 && end! <= 24 && start! < end!;
}

function readStored(): WakingWindow {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (isValid(stored)) return { start: stored.start, end: stored.end };
  } catch { /* corrupt or unavailable — use default */ }
  return DEFAULT_WAKING_WINDOW;
}

// User's waking hours for the Today & Tomorrow summary, persisted across reloads
export function useWakingWindow() {
  const [wakingWindow, setState] = useState<WakingWindow>(readStored);

  const setWakingWindow = (w: WakingWindow) => {
    if (!isValid(w)) return;
    setState(w);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(w)); } catch { /* storage full */ }
  };

  return { wakingWindow, setWakingWindow };
}
