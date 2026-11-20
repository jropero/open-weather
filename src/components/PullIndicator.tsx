import { RefreshCw } from 'lucide-react';
import { useLanguage } from '../hooks/useLanguage';
import { PULL_THRESHOLD, usePullToRefresh } from '../hooks/usePullToRefresh';

/** Small pill that follows a pull-down gesture at the top of the page; refreshes on release. */
export function PullIndicator({ onRefresh }: Readonly<{ onRefresh: () => void }>) {
  const { t } = useLanguage();
  const pull = usePullToRefresh(onRefresh);
  if (pull < 12) return null;
  const ready = pull > PULL_THRESHOLD;
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed left-1/2 top-2 z-40 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-slate-900/70 px-3 py-1.5 text-xs font-bold text-white shadow-lg backdrop-blur-md"
      style={{ transform: `translate(-50%, ${Math.round(pull / 3)}px)` }}
    >
      <RefreshCw
        size={13}
        strokeWidth={2}
        style={{ transform: `rotate(${Math.round(pull * 3)}deg)` }}
      />
      {ready ? t('hero.pull.release') : t('hero.pull.drag')}
    </div>
  );
}
