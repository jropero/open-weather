import { RefreshCw } from 'lucide-react';
import { useLanguage } from '../hooks/useLanguage';

/** Muted "Updated 10:42" (device local time) that doubles as a refresh button. */
export function FreshnessLine({
  fetchedAt,
  refreshing,
  onRefresh,
}: Readonly<{ fetchedAt: number; refreshing: boolean; onRefresh: () => void }>) {
  const { language, t } = useLanguage();
  const time = new Date(fetchedAt).toLocaleTimeString(language === 'en' ? 'en-GB' : 'es-ES', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  return (
    <div className="flex justify-center mt-3">
      <button
        type="button"
        onClick={onRefresh}
        disabled={refreshing}
        aria-label={t('hero.updated.action').replace('{time}', time)}
        className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium text-white/60 hover:text-white/90 hover:bg-white/10 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-white/70"
      >
        <RefreshCw
          size={12}
          strokeWidth={2}
          aria-hidden="true"
          className={refreshing ? 'animate-spin motion-reduce:animate-none' : ''}
        />
        <span aria-hidden="true">{t('hero.updated').replace('{time}', time)}</span>
      </button>
    </div>
  );
}
