import { useEffect, useState } from 'react';

const PORTRAIT_PHONE = '(orientation: portrait) and (max-width: 767px)';

/**
 * True while the device is a phone held in portrait (the wide chart wants landscape). The user
 * can dismiss it for the lifetime of the component; rotating to landscape clears it by itself.
 */
export function useOrientationPrompt(): {
  prompt: boolean;
  portrait: boolean;
  dismiss: () => void;
} {
  const [portrait, setPortrait] = useState(() => matchesPortrait());
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia(PORTRAIT_PHONE);
    const onChange = (e: MediaQueryListEvent) => setPortrait(e.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return { prompt: portrait && !dismissed, portrait, dismiss: () => setDismissed(true) };
}

function matchesPortrait(): boolean {
  return (
    typeof window !== 'undefined' &&
    !!window.matchMedia &&
    window.matchMedia(PORTRAIT_PHONE).matches
  );
}
