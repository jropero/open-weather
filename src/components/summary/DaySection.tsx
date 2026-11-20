import { useLanguage } from '../../hooks/useLanguage';
import { getWeatherInfo } from '../../utils/weatherCodes';
import type { DayKey, DayPart, DaySummary } from '../../utils/daySummary';
import { cssVar, fmtRange } from './format';
import { FeltRow, RainWindRows, TodayExtraRows } from './DayRows';
import { getTint } from './weatherTint';
import type { TodayExtras } from './types';

function SectionHeader({
  day,
  part,
  weatherCode,
}: Readonly<{ day: DayKey; part: DayPart; weatherCode: number | null }>) {
  const { t, language } = useLanguage();
  return (
    <div className="sticky top-0 z-10 -mx-5 flex items-center gap-2 border-b border-slate-100 bg-white px-5 py-2">
      <span
        aria-hidden="true"
        className={`size-2.5 shrink-0 rounded-full ${getTint(weatherCode).dot}`}
      />
      <h3 id={`summary-${day}`} className="text-base font-bold text-slate-900">
        {t(`summary.${day}`)}{' '}
        <span className="text-sm font-semibold text-slate-400 tabular-nums">
          {fmtRange(part)}
        </span>
      </h3>
      {weatherCode !== null && (
        <span className="ml-auto text-xs font-medium text-slate-500">
          {getWeatherInfo(weatherCode, language).label}
        </span>
      )}
    </div>
  );
}

export function DaySection({
  day,
  part,
  summary,
  weatherCode,
  extras,
  order,
}: Readonly<{
  day: DayKey;
  part: DayPart | null;
  summary: DaySummary;
  weatherCode: number | null;
  extras?: TodayExtras;
  order: number;
}>) {
  const { t } = useLanguage();
  if (!part)
    return (
      <p id={`summary-section-${day}`} className="text-sm text-slate-500">
        {t('summary.no_data_day')}
      </p>
    );
  return (
    <section id={`summary-section-${day}`} aria-labelledby={`summary-${day}`}>
      <SectionHeader day={day} part={part} weatherCode={weatherCode} />
      <ul
        className="summary-stagger divide-y divide-slate-100"
        style={cssVar('--base', `${160 + order * 60}ms`)}
      >
        <RainWindRows part={part} />
        <FeltRow day={day} part={part} summary={summary} />
        {extras && <TodayExtraRows extras={extras} />}
      </ul>
    </section>
  );
}
