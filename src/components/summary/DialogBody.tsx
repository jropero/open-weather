import { useLanguage } from '../../hooks/useLanguage';
import type { DayKey, DaySummary, DayOverview, Highlight } from '../../utils/daySummary';
import { DaySection } from './DaySection';
import { Headline } from './Headline';
import { NightBand } from './NightBand';
import { OverviewCards } from './OverviewCards';
import type { TodayExtras } from './types';

interface Props {
  summary: DaySummary;
  highlights: Highlight[];
  overview: DayOverview[];
  extras: TodayExtras;
}

export function DialogBody({ summary, highlights, overview, extras }: Readonly<Props>) {
  const { t } = useLanguage();
  const code = (day: DayKey) => overview.find((o) => o.day === day)?.weatherCode ?? null;
  const section = (day: DayKey, order: number) => (
    <DaySection
      day={day}
      part={summary[day]}
      summary={summary}
      weatherCode={code(day)}
      extras={day === 'today' ? extras : undefined}
      order={order}
    />
  );
  return (
    <div className="space-y-4 pt-4">
      <Headline highlights={highlights} />
      <OverviewCards items={overview} />
      <NightBand note={summary.earlyNight} labelKey="summary.night.early" delay={140} />
      {summary.today ? (
        section('today', 0)
      ) : (
        <p className="text-xs text-slate-500">{t('summary.today_over')}</p>
      )}
      <NightBand note={summary.night} labelKey="summary.night.overnight" delay={220} />
      {section('tomorrow', 1)}
      <NightBand
        note={summary.nightAfterTomorrow}
        labelKey="summary.night.overnight"
        delay={300}
      />
      {section('dayAfterTomorrow', 2)}
      <p className="pt-1 text-center text-[11px] text-slate-400">{t('summary.footnote.air')}</p>
    </div>
  );
}
