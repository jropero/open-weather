import React, { lazy, Suspense, useState } from 'react';
import { useAllPeriodRanks } from '../hooks/useAllPeriodRanks';
import {
  CalendarRange,
  Thermometer,
  CloudRain,
  Gauge,
  Sun,
  Snowflake,
  ChevronDown,
  type LucideIcon,
} from 'lucide-react';
import type {
  Location,
  SeasonalPeriod,
  SeasonalVariable,
  ConfidenceLevel,
} from '../types/weather';
import { useLanguage } from '../hooks/useLanguage';
import { useNow } from '../hooks/useNow';
import { useSeasonalForecast } from '../hooks/useSeasonalForecast';
import { ensembleDaysInWeek, MIN_ENSEMBLE_DAYS_IN_WEEK } from '../utils/ensembleStats';
import {
  SEASONAL_VARIABLES,
  classifyAnomaly,
  formatAbsolute,
  getAnomalyClass,
  getSeasonName,
  hasMeaningfulRow,
} from '../utils/seasonal';
import { SeasonalAttribution } from './SeasonalAttribution';

// Drill-down dialogs load on first tap (own chunks)
const EnsembleDetailView = lazy(() =>
  import('./EnsembleDetailView').then((m) => ({ default: m.EnsembleDetailView })),
);
const ClimateDetailView = lazy(() =>
  import('./ClimateDetailView').then((m) => ({ default: m.ClimateDetailView })),
);

type Tier = 'weeks' | 'months' | 'seasons';

const TIERS: Tier[] = ['weeks', 'months', 'seasons'];

const VAR_ICONS: Record<SeasonalVariable, LucideIcon> = {
  temperature: Thermometer,
  precipitation: CloudRain,
  pressure: Gauge,
  sunshine: Sun,
  snowfall: Snowflake,
};

const CONFIDENCE_DOTS: Record<ConfidenceLevel, string> = {
  high: '●●●',
  medium: '●●○',
  low: '●○○',
};

// Low-confidence cells get a neutral grey hatch (visible on light and dark cell colours)
const LOW_CONFIDENCE_HATCH: React.CSSProperties = {
  backgroundImage:
    'repeating-linear-gradient(135deg, rgba(127,127,127,0.28) 0 2px, transparent 2px 6px)',
};

interface LongRangeOutlookProps {
  location: Location;
}

// eslint-disable-next-line sonarjs/cognitive-complexity
export function LongRangeOutlook({ location }: LongRangeOutlookProps) {
  const { language, t } = useLanguage();
  const now = useNow();
  const { outlook, loading, error, retry } = useSeasonalForecast(location);
  const [tier, setTier] = useState<Tier>('weeks');
  const [expanded, setExpanded] = useState(true);
  const [selected, setSelected] = useState<{ col: number; variable: SeasonalVariable } | null>(
    null,
  );

  const [drillTarget, setDrillTarget] = useState<{
    weekIndex: number;
    period: SeasonalPeriod;
    variable: SeasonalVariable;
  } | null>(null);
  const [climateTarget, setClimateTarget] = useState<{ period: SeasonalPeriod } | null>(null);

  const locale = language === 'en' ? 'en-GB' : 'es-ES';
  const fmt = (d: string, opts: Intl.DateTimeFormatOptions) =>
    new Date(`${d}T00:00:00Z`).toLocaleDateString(locale, { ...opts, timeZone: 'UTC' });
  const monthRange = (a: string, b: string) => {
    const from = fmt(a, { month: 'short' });
    const to = fmt(b, { month: 'short' });
    return from === to ? from : `${from}–${to}`;
  };

  const switchTier = (next: Tier) => {
    setTier(next);
    setSelected(null);
  };

  const periods: SeasonalPeriod[] = outlook ? outlook[tier] : [];
  const isSeasonal = tier === 'seasons';
  const periodRanks = useAllPeriodRanks(
    location.latitude,
    location.longitude,
    tier !== 'weeks' ? periods : [],
    isSeasonal,
  );
  const rows = SEASONAL_VARIABLES.filter((v) => hasMeaningfulRow(v, periods));
  const hasAnyData = !!outlook && (outlook.weeks.length > 0 || outlook.months.length > 0);

  // eslint-disable-next-line sonarjs/cognitive-complexity
  const periodLabel = (p: SeasonalPeriod): { main: string; sub: string } => {
    if (tier === 'weeks')
      return {
        main: fmt(p.start, { day: 'numeric', month: 'short' }),
        sub: `– ${fmt(p.end, { day: 'numeric', month: 'short' })}`,
      };
    if (tier === 'months')
      return { main: fmt(p.start, { month: 'short' }), sub: fmt(p.start, { year: 'numeric' }) };
    const season = p.season!;
    const name = getSeasonName(season.key, outlook!.zone);
    if (season.kind === 'rest') {
      const months = season.months;
      return {
        main: t(`seasonal.rest.${name ?? 'tropical'}`),
        sub: months.length ? monthRange(months[0], months[months.length - 1]) : '',
      };
    }
    return {
      main: name ? t(`seasonal.season.${name}`) : t('seasonal.next.tropical'),
      sub: monthRange(p.start, p.end),
    };
  };

  const wordFor = (variable: SeasonalVariable, level: number) => {
    if (level === 0) return t('seasonal.word.normal');
    const direction = level > 0 ? 'above' : 'below';
    return t(`seasonal.word.${variable}.${direction}`);
  };

  // "Warmer than in 9 of the last 10 years" (same wording as the climate drill-down)
  const rankText = ({ above, total }: { above: number; total: number }) => {
    const adj = (dir: 'above' | 'below') => t(`climate.adj.temperature.${dir}`);
    let s: string;
    if (above >= total) s = t('climate.cmp.all').replace('{adj}', adj('above'));
    else if (above === 0) s = t('climate.cmp.all').replace('{adj}', adj('below'));
    else s = t('climate.cmp.some').replace('{adj}', adj('above')).replace('{n}', String(above));
    s = s.replace('{m}', String(total));
    return s.charAt(0).toUpperCase() + s.slice(1);
  };

  const renderHeader = (p: SeasonalPeriod, col: number) => {
    const { main, sub } = periodLabel(p);
    const season = p.season;
    const partial = season?.kind === 'next' && season.months.length < season.monthsExpected;
    const ending = season?.kind === 'rest' && season.monthsExpected === 0;
    return (
      <th
        key={col}
        scope="col"
        className={`align-bottom text-center font-normal px-0.5 pb-1 ${tier === 'seasons' ? 'min-w-[112px]' : 'min-w-[64px]'}`}
      >
        <div className="text-[11px] font-bold text-white leading-tight capitalize">{main}</div>
        {sub && <div className="text-[10px] text-slate-300 leading-tight">{sub}</div>}
        {p.inProgress && tier !== 'seasons' && (
          <div className="text-[9px] font-bold uppercase tracking-wider text-amber-200 leading-tight mt-0.5">
            {t('seasonal.in_progress')}
          </div>
        )}
        {season && !ending && (
          <div
            className={`text-[9px] font-bold leading-tight mt-0.5 ${partial ? 'text-amber-200' : 'text-slate-300'}`}
            title={partial ? t('seasonal.coverage_partial') : undefined}
          >
            {partial && <span aria-hidden="true">⚠ </span>}
            {t('seasonal.coverage')
              .replace('{n}', String(season.months.length))
              .replace('{m}', String(season.monthsExpected))}
            {partial && <span className="sr-only"> — {t('seasonal.coverage_partial')}</span>}
          </div>
        )}
        {ending && (
          <div className="text-[9px] font-bold text-amber-200 leading-tight mt-0.5">
            {t('seasonal.season_ending').replace('{n}', String(p.days))}
          </div>
        )}
        <div
          className="mt-1 flex flex-col items-center"
          title={`${t('seasonal.confidence')}: ${t('seasonal.confidence.' + p.confidence)}`}
        >
          <span
            aria-hidden="true"
            className="text-[10px] tracking-[0.15em] text-white leading-none"
          >
            {CONFIDENCE_DOTS[p.confidence]}
          </span>
          {/* The level word lives in the title / screen-reader text; cells carry the hatch */}
          <span className="sr-only">
            {t('seasonal.confidence')}: {t(`seasonal.confidence.${p.confidence}`)}
          </span>
          {p.agreement !== null && (
            <span className="text-[9px] text-slate-300 leading-tight">
              {t('seasonal.agreement').replace('{n}', String(p.agreement))}
            </span>
          )}
        </div>
      </th>
    );
  };

  // eslint-disable-next-line sonarjs/cognitive-complexity
  const renderCell = (p: SeasonalPeriod, col: number, variable: SeasonalVariable) => {
    const d = classifyAnomaly(variable, p.values[variable], p.days);
    if (!d) {
      return (
        <td key={col} className="p-0">
          <div
            className="rounded-lg py-2 text-center text-xs font-bold text-slate-400 bg-white/5"
            aria-label={t('label.info_unavailable')}
          >
            —
          </div>
        </td>
      );
    }
    const word = wordFor(variable, d.level);
    const isSel = selected?.col === col && selected.variable === variable;
    const { mean, anomaly } = p.values[variable];
    const normal = mean !== null && anomaly !== null ? mean - anomaly : null;

    // Weekly cells open the hourly ensemble only where it actually has data (15-day window);
    // weeks beyond it toggle the inline EC46 detail instead of opening an empty chart.
    const isDrillableEnsemble =
      tier === 'weeks' && ensembleDaysInWeek(p.start, now) >= MIN_ENSEMBLE_DAYS_IN_WEEK;
    const isDrillableClimate = tier === 'months' || tier === 'seasons';
    const opensDialog = isDrillableEnsemble || isDrillableClimate;

    const periodKey = `${p.start}_${isSeasonal ? 'seas' : 'month'}`;
    const rank =
      isDrillableClimate && variable === 'temperature'
        ? periodRanks?.get(periodKey)
        : undefined;

    const handleClick = () => {
      if (isDrillableEnsemble) {
        setDrillTarget({ weekIndex: col, period: p, variable });
      } else if (isDrillableClimate) {
        setClimateTarget({ period: p });
      } else {
        setSelected(isSel ? null : { col, variable });
      }
    };

    const { main, sub } = periodLabel(p);
    const absolutes = `${t('seasonal.detail.forecast')}: ${formatAbsolute(variable, mean)} · ${t('seasonal.detail.normal')}: ${formatAbsolute(variable, normal)}`;
    const ariaParts = [
      `${main} ${sub}, ${t('seasonal.var.' + variable)}: ${d.value}${d.unit}, ${word}`,
      `${t('seasonal.confidence')}: ${t('seasonal.confidence.' + p.confidence)}`,
      rank ? rankText(rank) : null,
    ].filter(Boolean);

    return (
      <td key={col} className="p-0 relative">
        <button
          type="button"
          onClick={handleClick}
          {...(opensDialog
            ? { 'aria-haspopup': 'dialog' as const }
            : { 'aria-pressed': isSel })}
          aria-label={ariaParts.join('. ')}
          title={rank ? `${absolutes}\n${rankText(rank)}` : absolutes}
          style={p.confidence === 'low' ? LOW_CONFIDENCE_HATCH : undefined}
          className={`w-full rounded-lg px-1 py-1.5 flex flex-col items-center transition-transform active:scale-95 ${getAnomalyClass(variable, d.level)} ${isSel ? 'outline-2 outline-white outline-offset-1' : ''}`}
        >
          <span className="text-xs font-black leading-none whitespace-nowrap">
            {d.value}
            <span className="text-[9px] font-bold ml-px">{d.unit}</span>
          </span>
          <span className="text-[9px] font-semibold leading-tight mt-0.5 whitespace-nowrap">
            {word}
          </span>
          {rank && (
            // One dot per historical year; filled = years the forecast is warmer than
            <span aria-hidden="true" className="flex gap-px mt-1">
              {Array.from({ length: rank.total }, (_, k) => (
                <span
                  key={k}
                  className={`w-[3px] h-[3px] rounded-full bg-current ${k < rank.above ? '' : 'opacity-25'}`}
                />
              ))}
            </span>
          )}
          {opensDialog && (
            <span aria-hidden="true" className="text-[9px] leading-none mt-1 opacity-80">
              {t(isDrillableEnsemble ? 'seasonal.drill.ensemble' : 'seasonal.drill.history')}
            </span>
          )}
        </button>
      </td>
    );
  };

  const renderDetail = () => {
    if (!selected || !periods[selected.col]) {
      return <p className="text-[11px] text-slate-300 mt-2 px-1">{t('seasonal.tap_hint')}</p>;
    }
    const p = periods[selected.col];
    const v = selected.variable;
    const d = classifyAnomaly(v, p.values[v], p.days);
    const { mean, anomaly, probAbove } = p.values[v];
    const normal = mean !== null && anomaly !== null ? mean - anomaly : null;
    const { main, sub } = periodLabel(p);
    return (
      <div
        className="mt-3 rounded-xl bg-white/10 border border-white/10 p-3 text-xs text-slate-100 flex flex-col gap-1"
        aria-live="polite"
      >
        <span className="font-bold text-white capitalize">
          {t(`seasonal.var.${v}`)} · {main} {sub}
        </span>
        <span>
          {t('seasonal.detail.forecast')}:{' '}
          <b className="text-white">{formatAbsolute(v, mean)}</b>
          {' · '}
          {t('seasonal.detail.normal')}:{' '}
          <b className="text-white">{formatAbsolute(v, normal)}</b>
          {d && (
            <>
              {' '}
              {' · '}
              <b className="text-white">
                {d.value}
                {d.unit}
              </b>{' '}
              {wordFor(v, d.level)}
            </>
          )}
        </span>
        {probAbove !== null && (
          <span className="text-slate-300">
            {t('seasonal.detail.prob_above').replace('{n}', String(Math.round(probAbove)))}
          </span>
        )}
        <span className="text-slate-400">{t('seasonal.beyond_ensemble')}</span>
      </div>
    );
  };

  let outlookBody: React.ReactNode;
  if (loading) {
    outlookBody = (
      <div className="flex flex-col items-center justify-center p-6 bg-white/5 rounded-2xl border border-white/10 text-center gap-2">
        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-sky-300"></div>
        <p className="text-sm font-semibold text-slate-200">{t('seasonal.loading')}</p>
      </div>
    );
  } else if (error) {
    outlookBody = (
      <div
        className="flex flex-col items-center justify-center p-6 bg-white/5 rounded-2xl border border-white/10 text-center gap-2"
        role="alert"
      >
        <span className="text-2xl" aria-hidden="true">
          ⚠️
        </span>
        <p className="text-sm font-semibold text-slate-200">{t('seasonal.error')}</p>
        <button
          type="button"
          onClick={retry}
          className="mt-1 px-3 py-1 rounded-full bg-white text-slate-900 text-xs font-bold hover:bg-sky-100 transition-colors"
        >
          {t('seasonal.retry')}
        </button>
      </div>
    );
  } else if (!hasAnyData || periods.length === 0 || rows.length === 0) {
    outlookBody = (
      <div className="flex flex-col items-center justify-center p-6 bg-white/5 rounded-2xl border border-white/10 text-center gap-2">
        <span className="text-2xl" aria-hidden="true">
          🛰️
        </span>
        <p className="text-sm font-semibold text-slate-200">{t('seasonal.no_data')}</p>
      </div>
    );
  } else {
    outlookBody = (
      <>
        <div className="relative overflow-x-auto -mx-1 px-1 pb-1">
          <table className="w-full border-separate border-spacing-1">
            <caption className="sr-only">{`${t('title.long_range')} — ${t('seasonal.tier.' + tier)}`}</caption>
            <thead>
              <tr>
                <th scope="col">
                  <span className="sr-only">{t('seasonal.confidence')}</span>
                </th>
                {periods.map(renderHeader)}
              </tr>
            </thead>
            <tbody>
              {rows.map((variable) => {
                const Icon = VAR_ICONS[variable];
                return (
                  <tr key={variable}>
                    <th
                      scope="row"
                      className="sticky left-0 z-10 bg-slate-800/95 rounded-lg px-1.5 text-left font-normal"
                    >
                      <span className="flex items-center gap-1 text-[10px] font-bold text-slate-100 leading-tight max-w-[76px]">
                        <Icon
                          size={12}
                          className="shrink-0 text-slate-300"
                          aria-hidden="true"
                        />
                        {t(`seasonal.var.${variable}`)}
                      </span>
                    </th>
                    {periods.map((p, col) => renderCell(p, col, variable))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {renderDetail()}
        <div className="mt-3 px-1 flex flex-col gap-1 text-[10px] leading-snug text-slate-300">
          <p>{t('seasonal.legend')}</p>
          <p className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="inline-block w-4 h-3 rounded-sm bg-white/10 shrink-0"
              style={LOW_CONFIDENCE_HATCH}
            />
            {t('seasonal.legend.confidence')}
          </p>
          <p>
            {t(
              tier === 'weeks'
                ? 'seasonal.confidence_note.weeks'
                : 'seasonal.confidence_note.months',
            )}
          </p>
          {tier === 'seasons' && outlook!.zone === 'tropical' && (
            <p className="text-amber-100">{t('seasonal.tropical_note')}</p>
          )}
        </div>
      </>
    );
  }

  return (
    <>
      <Suspense fallback={null}>
        {drillTarget && (
          <EnsembleDetailView
            location={location}
            period={drillTarget.period}
            weekIndex={drillTarget.weekIndex}
            initialVariable={drillTarget.variable}
            lowConfidence={drillTarget.weekIndex >= 2}
            onClose={() => setDrillTarget(null)}
          />
        )}
        {climateTarget && (
          <ClimateDetailView
            location={location}
            period={climateTarget.period}
            onClose={() => setClimateTarget(null)}
          />
        )}
      </Suspense>
      <section className="bg-slate-900/60 backdrop-blur-md rounded-3xl p-4 sm:p-6 shadow-xl mt-4 text-white border border-slate-700/50">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="min-w-0">
            <h3 className="text-sm uppercase tracking-wider opacity-90 font-semibold flex items-center">
              <CalendarRange className="inline-block mr-2 text-sky-300 shrink-0" size={18} />
              {t('title.long_range')}
            </h3>
            <p className="text-xs text-slate-300 mt-0.5">{t('seasonal.subtitle')}</p>
          </div>
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            aria-expanded={expanded}
            aria-label={t('title.long_range')}
            className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 transition-colors shrink-0"
          >
            <ChevronDown
              size={16}
              className={`transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`}
            />
          </button>
        </div>

        {expanded && (
          <>
            {/* Tier switcher */}
            <fieldset
              className="bg-white/10 p-0.5 rounded-full grid grid-cols-3 gap-1 border border-white/5 mb-4 min-w-0 m-0"
              aria-label={t('title.long_range')}
            >
              {TIERS.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => switchTier(key)}
                  aria-pressed={tier === key}
                  className={`px-2 py-1 rounded-full text-xs font-bold transition-all duration-300 ${tier === key ? 'bg-white text-slate-900 shadow-md' : 'text-white hover:bg-white/5'}`}
                >
                  {t(`seasonal.tier.${key}`)}
                </button>
              ))}
            </fieldset>

            {outlookBody}

            <SeasonalAttribution variant="full" seas5Issue={outlook?.seas5Issue} />
          </>
        )}
      </section>
    </>
  );
}
