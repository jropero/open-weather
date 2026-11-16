import { RefreshCw, WifiOff } from 'lucide-react';
import { useLanguage } from '../hooks/useLanguage';

interface Props {
  fetchedAt: number;
  now: number;
  refreshing: boolean;
  onRetry: () => void;
}

/** Shown when the data on screen is out of date (refresh failed / offline fallback). */
export function StaleDataBanner({ fetchedAt, now, refreshing, onRetry }: Props) {
  const { language, t } = useLanguage();
  const locale = language === 'en' ? 'en-GB' : 'es-ES';
  const sameDay = new Date(fetchedAt).toDateString() === new Date(now).toDateString();
  const when = new Date(fetchedAt).toLocaleString(locale, {
    ...(sameDay ? {} : { weekday: 'short', day: 'numeric', month: 'short' }),
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div
      className="mx-2 sm:mx-0 mb-2 flex items-center gap-2 rounded-xl bg-slate-900/70 border border-amber-300/40 px-3 py-2 text-xs text-amber-50 backdrop-blur-md"
      aria-live="polite"
    >
      <WifiOff size={14} className="shrink-0 text-amber-300" aria-hidden="true" />
      <span className="flex-1 min-w-0">{t('app.stale').replace('{time}', when)}</span>
      <button
        type="button"
        onClick={onRetry}
        disabled={refreshing}
        className="shrink-0 flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 font-bold hover:bg-white/25 disabled:opacity-60 transition-colors"
      >
        <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} aria-hidden="true" />
        {t('app.retry')}
      </button>
    </div>
  );
}
