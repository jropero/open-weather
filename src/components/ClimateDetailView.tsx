import { useEffect, useRef } from 'react';
import {
  ComposedChart,
  Bar,
  Cell,
  LabelList,
  XAxis,
  YAxis,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import {
  X,
  Thermometer,
  CloudRain,
  Gauge,
  Sun,
  Snowflake,
  type LucideIcon,
} from 'lucide-react';
import type { Location, SeasonalPeriod, SeasonalVariable } from '../types/weather';
import { useLanguage } from '../hooks/useLanguage';
import { useHistoricalClimate } from '../hooks/useHistoricalClimate';
import {
  getHolisticSummaryKey,
  ALL_VARS,
  type ClimateDetailResult,
  type AnalogueYear,
} from '../utils/climateStats';
import {
  classifyAnomaly,
  formatAbsolute,
  getAnomalyHex,
  getClimateZone,
  getSeasonName,
  hasMeaningfulRow,
  type AnomalyLevel,
} from '../utils/seasonal';

type T = (key: string) => string;

// ---- Meta ----------------------------------------------------------------

const VAR_ICONS: Record<SeasonalVariable, LucideIcon> = {
  temperature: Thermometer,
  precipitation: CloudRain,
  pressure: Gauge,
  sunshine: Sun,
  snowfall: Snowflake,
};

/** Temperature (a mean) is drawn as the deviation from the ERA5 mean; totals grow from 0. */
const DIVERGING: ReadonlySet<SeasonalVariable> = new Set(['temperature', 'pressure']);

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Same thresholds as the heatmap, applied to "value vs. ERA5 mean". */
function levelOf(
  variable: SeasonalVariable,
  value: number | null,
  climMean: number | null,
  days: number,
): AnomalyLevel {
  if (value === null || climMean === null) return 0;
  return (
    classifyAnomaly(variable, { mean: value, anomaly: value - climMean, probAbove: null }, days)
      ?.level ?? 0
  );
}

// eslint-disable-next-line sonarjs/cognitive-complexity
function getSummaryEmoji(levels: Record<SeasonalVariable, AnomalyLevel | null>): string {
  const temp = levels.temperature ?? 0;
  const precip = levels.precipitation ?? 0;
  const sun = levels.sunshine ?? 0;
  if (temp > 0 && precip < 0) return '☀️';
  if (precip > 0) return temp < 0 ? '🌨' : '🌧';
  if (temp > 0) return '🌡';
  if (temp < 0) return '❄️';
  if (sun < 0) return '☁️';
  if (sun > 0) return '🌤';
  return '⚖️';
}

// ---- Comparison label ("above/below N of last M years") -------------------

// eslint-disable-next-line sonarjs/cognitive-complexity
function comparisonLabel(
  variable: SeasonalVariable,
  aboveCount: number | null,
  totalYears: number,
  t: T,
): string {
  if (aboveCount === null || totalYears === 0) return '—';
  const m = String(totalYears);
  const adj = (dir: 'above' | 'below') => t(`climate.adj.${variable}.${dir}`);

  // aboveCount = how many historical years the forecast EXCEEDS (warmer/wetter/etc.)
  let s: string;
  if (aboveCount >= totalYears) s = t('climate.cmp.all').replace('{adj}', adj('above'));
  else if (aboveCount === 0) s = t('climate.cmp.all').replace('{adj}', adj('below'));
  else if (aboveCount >= Math.ceil(totalYears * 0.65))
    s = t('climate.cmp.some').replace('{adj}', adj('above')).replace('{n}', String(aboveCount));
  else if (aboveCount <= Math.floor(totalYears * 0.35))
    s = t('climate.cmp.some')
      .replace('{adj}', adj('below'))
      .replace('{n}', String(totalYears - aboveCount));
  else s = t('climate.cmp.near');
  return capitalize(s.replace('{m}', m));
}

// ---- Mini bar chart -------------------------------------------------------

type BarEntry = {
  year: string;
  raw: number | null; // absolute value
  bar: number | null; // plotted value (deviation for diverging variables)
  isForecast: boolean;
  color: string;
};

// eslint-disable-next-line sonarjs/cognitive-complexity
function fmtBarValue(variable: SeasonalVariable, x: number, signed: boolean): string {
  let s: string;
  switch (variable) {
    case 'temperature':
    case 'snowfall':
      s = Math.abs(x).toFixed(1);
      break;
    case 'sunshine':
      s = String(Math.round(Math.abs(x) / 3600));
      break;
    default:
      s = String(Math.round(Math.abs(x)));
  }
  if (!signed) return x < 0 ? `−${s}` : s;
  if (Number(s) === 0) return `±${s}`;
  return `${x > 0 ? '+' : '−'}${s}`;
}

// eslint-disable-next-line sonarjs/cognitive-complexity
function MiniBarChart({
  years,
  values,
  forecastValue,
  climMean,
  variable,
  days,
  t,
}: {
  years: number[];
  values: (number | null)[];
  forecastValue: number | null;
  climMean: number | null;
  variable: SeasonalVariable;
  days: number;
  t: T;
}) {
  if (!years.length) return <div className="flex-1 h-[88px]" />;
  const diverging = DIVERGING.has(variable) && climMean !== null;

  const entry = (year: string, raw: number | null, isForecast: boolean): BarEntry => ({
    year,
    raw,
    bar: raw !== null && diverging ? raw - climMean! : raw,
    isForecast,
    color: getAnomalyHex(variable, levelOf(variable, raw, climMean, days)),
  });

  const data: BarEntry[] = years.map((year, i) =>
    entry(`'${String(year).slice(2)}`, values[i], false),
  );
  if (forecastValue !== null) data.push(entry('S5', forecastValue, true));

  const bars = data.map((d) => d.bar).filter((v): v is number => v !== null);
  let domain: [number, number];
  if (diverging) {
    const m = Math.max(...bars.map(Math.abs), 0) * 1.15 || 0.5;
    domain = [-m, m];
  } else {
    const max = Math.max(...bars, climMean ?? 0, 0);
    domain = [0, max * 1.18 || 1];
  }

  const renderTooltip = ({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: readonly { payload?: unknown }[];
  }) => {
    const d = active ? (payload?.[0]?.payload as BarEntry | undefined) : undefined;
    if (!d || d.raw === null) return null;
    return (
      <div className="rounded-md bg-slate-800/95 border border-white/10 px-2 py-1 text-[10px] text-slate-100 shadow-lg whitespace-nowrap">
        <b className="text-white">
          {d.isForecast ? t('climate.adjusted') : d.year.replace("'", '20')}
        </b>
        {': '}
        {formatAbsolute(variable, d.raw)}
        {climMean !== null && (
          <span className="text-slate-300">
            {' '}
            ({fmtBarValue(variable, d.raw - climMean, true)} vs {t('climate.era5_avg')})
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="flex-1 min-w-0 h-[88px]">
      <ResponsiveContainer width="100%" height={88}>
        <ComposedChart
          data={data}
          margin={{ top: 14, right: 2, left: 2, bottom: 0 }}
          barCategoryGap="14%"
        >
          <XAxis
            dataKey="year"
            tick={{ fontSize: 9, fill: '#94a3b8' }}
            axisLine={false}
            tickLine={false}
            interval={0}
            height={14}
          />
          <YAxis hide domain={domain} allowDataOverflow />
          <Tooltip
            content={renderTooltip}
            cursor={{ fill: 'rgba(255,255,255,0.06)' }}
            isAnimationActive={false}
          />
          {climMean !== null && (
            <ReferenceLine
              y={diverging ? 0 : climMean}
              stroke="rgba(255,255,255,0.45)"
              strokeDasharray="3 3"
            />
          )}
          <Bar dataKey="bar" radius={2} isAnimationActive={false}>
            {data.map((d, index) => (
              <Cell
                key={index}
                fill={d.color}
                fillOpacity={d.isForecast ? 1 : 0.75}
                stroke={d.isForecast ? '#ffffff' : 'none'}
                strokeWidth={d.isForecast ? 1.5 : 0}
              />
            ))}
            {/* Only the forecast bar is labelled; history values are in the tooltip */}
            <LabelList
              dataKey="bar"
              content={(props) => {
                const { x, y, width, height, index } = props as {
                  x: number;
                  y: number;
                  width: number;
                  height: number;
                  index: number;
                };
                const d = data[index];
                if (!d?.isForecast || d.bar === null) return null;
                const top = d.bar >= 0 ? y : y + height;
                return (
                  <text
                    x={x + width / 2}
                    y={d.bar >= 0 ? top - 3 : top + 10}
                    fill="#ffffff"
                    fontSize={9}
                    fontWeight={700}
                    textAnchor="middle"
                  >
                    {fmtBarValue(variable, d.bar, diverging)}
                  </text>
                );
              }}
            />
          </Bar>
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---- Analogue label ------------------------------------------------------

function formatAnalogueLabel(a: AnalogueYear, locale: string, t: T): string {
  if (a.month !== undefined) {
    return new Date(Date.UTC(a.year, a.month - 1, 1)).toLocaleDateString(locale, {
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    });
  }
  if (a.seasonKey) {
    const prefix = t(`climate.season_abbr.${a.seasonKey}`);
    if (a.seasonKey === 'DJF') return `${prefix} ${a.year - 1}–${String(a.year).slice(2)}`;
    return `${prefix} ${a.year}`;
  }
  return a.label;
}

// ---- Skeleton ------------------------------------------------------------

function SkeletonStrip() {
  return (
    <div className="flex items-center gap-2 py-1 animate-pulse">
      <div className="w-20 h-3 bg-white/10 rounded" />
      <div className="flex-1 h-[72px] bg-white/10 rounded" />
    </div>
  );
}

// ---- Strips section ------------------------------------------------------

/** Rows worth drawing: a comparable forecast exists (not pressure) and, for snow, a real signal. */
function visibleVars(result: ClimateDetailResult, period: SeasonalPeriod): SeasonalVariable[] {
  return ALL_VARS.filter((v) => {
    if (result.forecastValues[v] === null) return false;
    if (v !== 'snowfall') return true;
    const cm = result.climMeans.snowfall ?? 0;
    return hasMeaningfulRow('snowfall', [period]) || cm / period.days >= 0.05;
  });
}

function Strips({
  result,
  period,
  t,
}: {
  result: ClimateDetailResult;
  period: SeasonalPeriod;
  t: T;
}) {
  return (
    <div className="mt-4 flex flex-col gap-3">
      {visibleVars(result, period).map((v) => {
        const fv = result.forecastValues[v];
        const cm = result.climMeans[v];
        const Icon = VAR_ICONS[v];
        return (
          <div key={v}>
            <div className="flex items-center gap-2">
              <div className="w-20 flex items-center gap-1 shrink-0">
                <Icon size={11} className="shrink-0 text-slate-400" aria-hidden />
                <span className="text-[10px] text-slate-200 font-medium leading-tight">
                  {t(`seasonal.var.${v}`)}
                </span>
              </div>
              <MiniBarChart
                years={result.stripYears}
                values={result.stripValues[v]}
                forecastValue={fv}
                climMean={cm}
                variable={v}
                days={period.days}
                t={t}
              />
            </div>
            <div className="pl-[88px] mt-0.5 space-y-px">
              <p className="text-[10px] text-slate-200 leading-snug">
                {comparisonLabel(v, result.aboveCount[v], result.totalYears, t)}
              </p>
              <p className="text-[10px] text-slate-400 leading-snug">
                {t('climate.adjusted')}: {formatAbsolute(v, fv)}
                {cm !== null && (
                  <>
                    {' · '}
                    {t('climate.era5_avg')}: {formatAbsolute(v, cm)}
                  </>
                )}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---- Main component ------------------------------------------------------

interface Props {
  location: Location;
  period: SeasonalPeriod;
  onClose: () => void;
}

// eslint-disable-next-line sonarjs/cognitive-complexity
export function ClimateDetailView({ location, period, onClose }: Props) {
  const { language, t } = useLanguage();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const locale = language === 'en' ? 'en-GB' : 'es-ES';

  const { result, loading, error } = useHistoricalClimate(
    location.latitude,
    location.longitude,
    period,
    locale,
  );

  useEffect(() => {
    const el = dialogRef.current;
    if (el && !el.open) el.showModal();
  }, []);

  const periodLabel = (): string => {
    if (!period.season) {
      return new Date(`${period.start}T00:00:00Z`).toLocaleDateString(locale, {
        month: 'long',
        year: 'numeric',
        timeZone: 'UTC',
      });
    }
    const seasonName = getSeasonName(period.season.key, getClimateZone(location.latitude));
    const name = seasonName ? t(`seasonal.season.${seasonName}`) : t('seasonal.next.tropical');
    const startYear = Number(period.start.slice(0, 4));
    const endYear = Number(period.end.slice(0, 4));
    const yearStr =
      startYear !== endYear ? `${startYear}–${String(endYear).slice(2)}` : String(startYear);
    return `${name} ${yearStr}`;
  };

  // Same classification as the heatmap cells, so the sentence never contradicts them
  const levels = Object.fromEntries(
    ALL_VARS.map((v) => [v, classifyAnomaly(v, period.values[v], period.days)?.level ?? null]),
  ) as Record<SeasonalVariable, AnomalyLevel | null>;

  let climateBody: React.ReactNode = null;
  if (loading) {
    climateBody = (
      <div className="mt-4 flex flex-col gap-3">
        <div className="animate-pulse flex gap-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex-1 h-12 bg-white/10 rounded-xl" />
          ))}
        </div>
        {[0, 1, 2].map((i) => (
          <SkeletonStrip key={i} />
        ))}
      </div>
    );
  } else if (error) {
    climateBody = (
      <div className="mt-4 flex flex-col items-center gap-2 py-6" role="alert">
        <span className="text-2xl" aria-hidden>
          ⚠️
        </span>
        <p className="text-sm text-slate-300 text-center">{t('climate.error')}</p>
      </div>
    );
  } else if (result) {
    climateBody = (
      <>
        {/* Analogue years */}
        <div className="mt-4">
          <p className="text-[11px] text-slate-300 mb-2">{t('climate.analogues.label')}</p>
          <div className="flex gap-2">
            {result.analogues.length === 0 ? (
              <p className="text-xs text-slate-400">—</p>
            ) : (
              result.analogues.map((a) => {
                const pct = Math.round(a.similarity * 100);
                const desc = t('climate.analogues.similarity')
                  .replace('{n}', String(pct))
                  .replace('{d}', a.distance.toFixed(1));
                return (
                  <div
                    key={`${a.year}_${a.month ?? a.seasonKey}`}
                    className="flex-1 min-w-0"
                    title={desc}
                  >
                    <div className="bg-white/10 rounded-xl px-2 py-2 text-center">
                      <span className="text-sm font-bold text-white block leading-tight">
                        {formatAnalogueLabel(a, locale, t)}
                      </span>
                    </div>
                    <div
                      className="mt-1 h-1 bg-white/20 rounded-full overflow-hidden"
                      aria-hidden="true"
                    >
                      <div
                        className="h-full bg-indigo-400 rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="mt-0.5 text-[10px] text-slate-400 text-center tabular-nums">
                      <span aria-hidden="true">
                        {pct}% · Δ{a.distance.toFixed(1)}σ
                      </span>
                      <span className="sr-only">{desc}</span>
                    </p>
                  </div>
                );
              })
            )}
          </div>
          <p className="mt-2 text-[10px] text-slate-400">{t('climate.analogues.note')}</p>
        </div>

        <Strips result={result} period={period} t={t} />

        <p className="mt-4 text-[10px] text-slate-400 leading-relaxed">
          {t('climate.footnote')
            .replace('{start}', String(result.stripYears[0] ?? '…'))
            .replace('{end}', String(result.stripYears.at(-1) ?? '…'))}
        </p>
        <p className="mt-1 text-[10px] text-slate-500 leading-relaxed">
          {t('climate.footnote.bias')}
        </p>
      </>
    );
  }

  return (
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/click-events-have-key-events
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) e.currentTarget.close();
      }}
      aria-labelledby="climate-detail-title"
      className="open:flex flex-col w-full max-w-none sm:max-w-2xl max-h-[92dvh] m-0 mt-auto sm:m-auto p-0 rounded-t-3xl sm:rounded-3xl bg-slate-950 text-white shadow-2xl overflow-hidden backdrop:bg-black/70 backdrop:backdrop-blur-sm"
    >
      <header className="flex items-start justify-between gap-3 px-5 py-4 bg-slate-900 shrink-0 border-b border-white/10">
        <div className="min-w-0">
          <h2
            id="climate-detail-title"
            className="text-base font-bold leading-tight text-white"
          >
            {capitalize(periodLabel())}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">{location.name}</p>
        </div>
        <button
          type="button"
          onClick={() => dialogRef.current?.close()}
          aria-label={t('summary.close')}
          className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors shrink-0"
        >
          <X size={18} />
        </button>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-5">
        {/* Holistic summary */}
        <div className="mt-4 rounded-2xl bg-white/10 border border-white/10 px-4 py-3 flex items-start gap-3">
          <span className="text-2xl leading-none shrink-0" aria-hidden>
            {getSummaryEmoji(levels)}
          </span>
          <p className="text-sm text-slate-100 leading-snug">
            {t(getHolisticSummaryKey(levels))}
          </p>
        </div>

        {climateBody}
      </div>
    </dialog>
  );
}
