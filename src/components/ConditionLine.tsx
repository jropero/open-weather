import { ArrowDown, ArrowUp } from 'lucide-react';
import { useLanguage } from '../hooks/useLanguage';
import { roundHighLow } from '../utils/heroMetrics';

/** Condition label with today's high/low on the same line (wraps to its own centered line if long). */
export function ConditionLine({
  label,
  max,
  min,
}: Readonly<{ label: string; max?: number | null; min?: number | null }>) {
  const { t } = useLanguage();
  const hl = roundHighLow(max, min);
  const aria = hl
    ? t('hero.highlow').replace('{max}', String(hl.max)).replace('{min}', String(hl.min))
    : '';
  return (
    <div className="flex flex-wrap items-baseline justify-center gap-x-2 mb-1">
      <p className="text-xl opacity-90 capitalize">{label}</p>
      {hl && (
        <p className="flex items-center gap-2 text-sm font-semibold opacity-70 tabular-nums whitespace-nowrap">
          <span className="sr-only">{aria}</span>
          <span aria-hidden="true" className="flex items-center gap-1">
            <span aria-hidden="true">·</span>
            <ArrowUp size={14} strokeWidth={2} />
            {hl.max}°
          </span>
          <span aria-hidden="true" className="flex items-center gap-0.5">
            <ArrowDown size={14} strokeWidth={2} />
            {hl.min}°
          </span>
        </p>
      )}
    </div>
  );
}
