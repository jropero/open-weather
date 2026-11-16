import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  X,
  Wind,
  Gauge,
  Thermometer,
  CloudRain,
  Sun,
  Snowflake,
  type LucideIcon,
} from 'lucide-react';
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  ZIndexLayer,
  useXAxisScale,
  useYAxisScale,
} from 'recharts';
import type { XAxisTickContentProps } from 'recharts';
import type { Location, SeasonalPeriod, SeasonalVariable } from '../types/weather';
import { useLanguage } from '../hooks/useLanguage';
import { useNow } from '../hooks/useNow';
import { useEnsembleData } from '../hooks/useEnsembleData';
import { hasMeaningfulRow } from '../utils/seasonal';
import {
  CUMULATIVE_VARS,
  classifySpread,
  ensembleDaysInWeek,
  localMidnightIndices,
  type EnsemblePoint,
  type EnsembleStats,
  type EnsembleVar,
} from '../utils/ensembleStats';

const HOUR_MS = 60 * 60 * 1000;
const WEEK_HOURS = 7 * 24;

// Variables whose EC46 weekly mean is drawn as a flat "normal" line
const FLAT_NORMAL_VARS: ReadonlySet<EnsembleVar> = new Set(['temperature_2m', 'pressure_msl']);
// Variables that can't go below 0 (Y axis starts at 0)
const NON_NEGATIVE_VARS: ReadonlySet<EnsembleVar> = new Set([
  'precipitation',
  'snowfall',
  'wind_speed_10m',
]);

// Opacities shared by the chart and its legend so the swatches match what is drawn
const MEMBER_OPACITY = 0.15;
const OUTER_BAND_OPACITY = 0.12;
const INNER_BAND_OPACITY = 0.26;

interface EnsembleVarMeta {
  key: EnsembleVar;
  /** Outlook variable that provides the EC46 weekly normal (null = no normal available). */
  seasonal: SeasonalVariable | null;
  labelKey: string;
  unit: string;
  color: string; // spaghetti / band / mean line colour
  Icon: LucideIcon;
}

const VARS: EnsembleVarMeta[] = [
  {
    key: 'temperature_2m',
    seasonal: 'temperature',
    labelKey: 'seasonal.var.temperature',
    unit: '°C',
    color: '#fca5a5',
    Icon: Thermometer,
  },
  {
    key: 'precipitation',
    seasonal: 'precipitation',
    labelKey: 'seasonal.var.precipitation',
    unit: 'mm',
    color: '#7dd3fc',
    Icon: CloudRain,
  },
  {
    key: 'pressure_msl',
    seasonal: 'pressure',
    labelKey: 'seasonal.var.pressure',
    unit: 'hPa',
    color: '#c084fc',
    Icon: Gauge,
  },
  {
    key: 'sunshine_duration',
    seasonal: 'sunshine',
    labelKey: 'seasonal.var.sunshine',
    unit: 'h',
    color: '#fbbf24',
    Icon: Sun,
  },
  {
    key: 'snowfall',
    seasonal: 'snowfall',
    labelKey: 'seasonal.var.snowfall',
    unit: 'cm',
    color: '#a5f3fc',
    Icon: Snowflake,
  },
  {
    key: 'wind_speed_10m',
    seasonal: null,
    labelKey: 'ensemble.var.wind',
    unit: 'km/h',
    color: '#6ee7b7',
    Icon: Wind,
  },
];

const SEASONAL_TO_ENSEMBLE: Record<SeasonalVariable, EnsembleVar> = {
  temperature: 'temperature_2m',
  precipitation: 'precipitation',
  pressure: 'pressure_msl',
  sunshine: 'sunshine_duration',
  snowfall: 'snowfall',
};

interface Props {
  location: Location;
  period: SeasonalPeriod;
  weekIndex: number; // 0-based (0 = "Semana 1")
  initialVariable: SeasonalVariable;
  lowConfidence: boolean;
  onClose: () => void;
}

interface ChartRow {
  i: number;
  mean: number | null;
  p10: number | null;
  p90: number | null;
  normal: number | null;
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Splits indices into contiguous runs where `ok(i)` holds (paths break across gaps). */
function runs(length: number, ok: (i: number) => boolean): number[][] {
  const out: number[][] = [];
  let cur: number[] = [];
  for (let i = 0; i < length; i++) {
    if (ok(i)) cur.push(i);
    else if (cur.length) {
      out.push(cur);
      cur = [];
    }
  }
  if (cur.length) out.push(cur);
  return out;
}

/** Y domain covering every member (not only p10–p90, so outliers stay inside the plot). */
function yDomainFor(
  points: EnsemblePoint[],
  rows: ChartRow[],
  nonNegative: boolean,
): [number, number] {
  let min = Infinity;
  let max = -Infinity;
  const take = (v: number | null) => {
    if (v === null) return;
    if (v < min) min = v;
    if (v > max) max = v;
  };
  points.forEach((p) => p.members.forEach(take));
  rows.forEach((r) => take(r.normal));
  if (min > max) return [0, 1];
  const pad = Math.max((max - min) * 0.06, 0.5);
  const lo = nonNegative ? 0 : min - pad;
  const hi = max + pad;
  // Snap both ends to a round step so the 5 default ticks land on round numbers
  const step = niceStep((hi - lo) / 4);
  return [Math.floor(lo / step) * step, Math.ceil(hi / step) * step];
}

/** 1, 2, 2.5 or 5 × 10^n — the smallest "round" step ≥ raw. */
function niceStep(raw: number): number {
  const exp = 10 ** Math.floor(Math.log10(raw));
  const f = raw / exp;
  const m = [1, 2, 2.5, 5, 10].find((c) => f <= c) ?? 10;
  return m * exp;
}

/** Index of the hourly point containing `now`, or null when now is outside the chart. */
function nowIndexOf(points: EnsemblePoint[], now: number): number | null {
  const first = points[0].time;
  const last = points.at(-1)!.time;
  if (now < first || now > last + HOUR_MS) return null;
  return Math.min(points.length - 1, Math.floor((now - first) / HOUR_MS));
}

// --- Custom chart layers ---

function SpaghettiLayer({ points, color }: { points: EnsemblePoint[]; color: string }) {
  const xScale = useXAxisScale();
  const yScale = useYAxisScale('main');

  // eslint-disable-next-line sonarjs/cognitive-complexity
  const paths = useMemo(() => {
    if (!xScale || !yScale || !points.length) return [];
    const n = points[0].members.length;
    const result: string[] = [];
    for (let m = 0; m < n; m++) {
      let d = '';
      let pen = 'M';
      for (let i = 0; i < points.length; i++) {
        const val = points[i].members[m];
        const x = xScale(i, { position: 'middle' });
        const y = val === null ? null : yScale(val);
        if (x == null || y == null) {
          pen = 'M'; // break the line across missing hours
          continue;
        }
        d += `${pen} ${(x as number).toFixed(1)} ${(y as number).toFixed(1)} `;
        pen = 'L';
      }
      if (d) result.push(d);
    }
    return result;
  }, [points, xScale, yScale]);

  if (!paths.length) return null;
  return (
    <ZIndexLayer zIndex={1}>
      <g pointerEvents="none">
        {paths.map((d, i) => (
          <path
            key={i}
            d={d}
            fill="none"
            stroke={color}
            strokeWidth={1}
            strokeOpacity={MEMBER_OPACITY}
          />
        ))}
      </g>
    </ZIndexLayer>
  );
}

function BandLayer({
  points,
  low,
  high,
  fill,
  opacity,
  zIndex,
}: {
  points: EnsemblePoint[];
  low: keyof EnsembleStats;
  high: keyof EnsembleStats;
  fill: string;
  opacity: number;
  zIndex: number;
}) {
  const xScale = useXAxisScale();
  const yScale = useYAxisScale('main');

  const paths = useMemo(() => {
    if (!xScale || !yScale || !points.length) return [];
    const xy = (i: number, v: number) =>
      `${(xScale(i, { position: 'middle' }) as number).toFixed(1)} ${(yScale(v) as number).toFixed(1)}`;
    return runs(points.length, (i) => points[i].stats !== null).map((run) => {
      const top = run.map((i, k) => `${k === 0 ? 'M' : 'L'} ${xy(i, points[i].stats![high])}`);
      const bottom = [...run].reverse().map((i) => `L ${xy(i, points[i].stats![low])}`);
      return `${top.join(' ')} ${bottom.join(' ')} Z`;
    });
  }, [points, low, high, xScale, yScale]);

  if (!paths.length) return null;
  return (
    <ZIndexLayer zIndex={zIndex}>
      <g pointerEvents="none">
        {paths.map((d, i) => (
          <path key={i} d={d} fill={fill} fillOpacity={opacity} stroke="none" />
        ))}
      </g>
    </ZIndexLayer>
  );
}

// ---

// eslint-disable-next-line sonarjs/cognitive-complexity
export function EnsembleDetailView({
  location,
  period,
  weekIndex,
  initialVariable,
  lowConfidence,
  onClose,
}: Props) {
  const { language, t } = useLanguage();
  const now = useNow();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [variable, setVariable] = useState<EnsembleVar>(SEASONAL_TO_ENSEMBLE[initialVariable]);

  const {
    data: points,
    loading,
    error,
  } = useEnsembleData(location.latitude, location.longitude, period.start, variable);

  useEffect(() => {
    const el = dialogRef.current;
    if (el && !el.open) el.showModal();
  }, []);

  // Snowfall tab only where the outlook itself shows a snow signal (hidden in Santo Domingo…)
  const vars = useMemo(
    () =>
      VARS.filter(
        (v) =>
          v.key !== 'snowfall' ||
          initialVariable === 'snowfall' ||
          hasMeaningfulRow('snowfall', [period]),
      ),
    [initialVariable, period],
  );
  const varMeta = VARS.find((v) => v.key === variable)!;
  const cumulative = CUMULATIVE_VARS.has(variable);
  const locale = language === 'en' ? 'en-GB' : 'es-ES';
  const timeZone = location.timezone;

  const fmtDate = (d: string, opts: Intl.DateTimeFormatOptions) =>
    new Date(`${d}T00:00:00Z`).toLocaleDateString(locale, { ...opts, timeZone: 'UTC' });
  const fmtTime = useCallback(
    (ms: number, opts: Intl.DateTimeFormatOptions) => {
      try {
        return new Date(ms).toLocaleString(locale, { ...opts, timeZone });
      } catch {
        return new Date(ms).toLocaleString(locale, opts);
      }
    },
    [locale, timeZone],
  );

  const weekLabel = `${t('ensemble.week')} ${weekIndex + 1}: ${fmtDate(period.start, { day: 'numeric' })}–${fmtDate(period.end, { day: 'numeric', month: 'short' })}`;
  const coveredDays = ensembleDaysInWeek(period.start, now);

  const classification = useMemo(
    () => (points && points.length ? classifySpread(points, variable) : null),
    [points, variable],
  );

  // EC46 weekly normal (model climatology) for the selected variable
  const weeklyNormal = useMemo(() => {
    // Hourly precipitation/snowfall have no meaningful weekly-normal line (the weekly total
    // spread over 168 h is ~0.05 mm/h), so a normal is drawn only as a flat weekly mean
    // (temperature, pressure) or as a cumulative pace (sunshine).
    if (!varMeta.seasonal || (!cumulative && !FLAT_NORMAL_VARS.has(variable))) return null;
    const { mean, anomaly } = period.values[varMeta.seasonal];
    if (mean === null || anomaly === null) return null;
    const n = mean - anomaly;
    return variable === 'sunshine_duration' ? n / 3600 : n;
  }, [period, varMeta, variable, cumulative]);

  const chartData = useMemo<ChartRow[]>(() => {
    if (!points?.length) return [];
    const first = points[0].time;
    return points.map((pt, i) => {
      let normal: number | null = null;
      if (weeklyNormal !== null) {
        // Cumulative: normal pace over the covered hours (a partial week gets a partial normal)
        normal = cumulative
          ? (weeklyNormal * ((pt.time - first) / HOUR_MS + 1)) / WEEK_HOURS
          : weeklyNormal;
      }
      return {
        i,
        mean: pt.stats?.mean ?? null,
        p10: pt.stats?.p10 ?? null,
        p90: pt.stats?.p90 ?? null,
        normal,
      };
    });
  }, [points, weeklyNormal, cumulative]);

  const nonNegative = cumulative || NON_NEGATIVE_VARS.has(variable);
  const yDomain = useMemo(
    () =>
      points?.length
        ? yDomainFor(points, chartData, nonNegative)
        : ([0, 10] as [number, number]),
    [points, chartData, nonNegative],
  );
  const midnights = useMemo(
    () => (points?.length ? localMidnightIndices(points, timeZone) : []),
    [points, timeZone],
  );
  // Day labels sit at local noon, so the first (partial) day is labelled too
  const noons = useMemo(
    () => (points?.length ? localMidnightIndices(points, timeZone, 12) : []),
    [points, timeZone],
  );
  const nowIndex = points?.length ? nowIndexOf(points, now) : null;

  const fmtValue = useCallback(
    (v: number) => {
      if (variable === 'temperature_2m' || variable === 'snowfall') return v.toFixed(1);
      // Hourly precipitation is mostly < 2 mm — rounding to integers would show "0–0 mm"
      if (variable === 'precipitation' && Math.abs(v) < 10) return v.toFixed(1);
      return String(Math.round(v));
    },
    [variable],
  );

  const renderXTick = useCallback(
    ({ x: rawX, y: rawY, payload }: XAxisTickContentProps) => {
      const pt = points?.[Number(payload.value)];
      if (!pt) return <g />;
      return (
        <text
          x={Number(rawX)}
          y={Number(rawY) + 13}
          textAnchor="middle"
          fontSize={10}
          fill="#94a3b8"
        >
          {capitalize(fmtTime(pt.time, { weekday: 'short' }))}
        </text>
      );
    },
    [points, fmtTime],
  );

  const renderTooltip = useCallback(
    ({ active, label }: { active?: boolean; label?: unknown }) => {
      const row = active ? chartData[Number(label)] : undefined;
      const pt = points?.[Number(label)];
      if (!row || !pt || row.mean === null) return null;
      return (
        <div className="rounded-lg bg-slate-800/95 border border-white/10 px-2.5 py-1.5 text-[11px] text-slate-100 shadow-lg">
          <div className="font-bold text-white mb-0.5">
            {capitalize(
              fmtTime(pt.time, {
                weekday: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              }),
            )}
          </div>
          <div>
            {t('ensemble.tooltip.mean')}:{' '}
            <b>
              {fmtValue(row.mean)} {varMeta.unit}
            </b>
          </div>
          {row.p10 !== null && row.p90 !== null && (
            <div className="text-slate-300">
              p10–p90: {fmtValue(row.p10)}–{fmtValue(row.p90)} {varMeta.unit}
            </div>
          )}
          {row.normal !== null && (
            <div className="text-slate-300">
              {t('ensemble.tooltip.normal')}: {fmtValue(row.normal)} {varMeta.unit}
            </div>
          )}
        </div>
      );
    },
    [chartData, points, fmtTime, fmtValue, t, varMeta.unit],
  );

  const spreadBadge = () => {
    if (!classification) return null;
    const configs = {
      agree: { bg: 'bg-emerald-800/60 text-emerald-200', icon: '✓' },
      disagree: { bg: 'bg-amber-800/60 text-amber-200', icon: '⚡' },
      bimodal: { bg: 'bg-violet-800/60 text-violet-200', icon: '⑂' },
    };
    const cfg = configs[classification.label];
    return (
      <div
        className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold ${cfg.bg}`}
      >
        <span className="text-base leading-none" aria-hidden="true">
          {cfg.icon}
        </span>
        <span>{t(`ensemble.spread.${classification.label}`)}</span>
      </div>
    );
  };



  let ensembleBody: React.ReactNode;
  if (loading) {
    ensembleBody = (
      <div className="flex flex-col items-center justify-center h-48 gap-3">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-sky-400" />
        <p className="text-sm text-slate-400">{t('ensemble.loading')}</p>
      </div>
    );
  } else if (error) {
    ensembleBody = (
      <div className="flex flex-col items-center justify-center h-48 gap-2" role="alert">
        <span className="text-2xl" aria-hidden="true">
          ⚠️
        </span>
        <p className="text-sm text-slate-300 text-center">{t('ensemble.error')}</p>
      </div>
    );
  } else if (!points?.length || chartData.every((r) => r.mean === null)) {
    ensembleBody = (
      <div className="flex flex-col items-center justify-center h-48 gap-2">
        <p className="text-sm text-slate-400">{t('ensemble.no_data')}</p>
      </div>
    );
  }

  const label = t(varMeta.labelKey);

  return (
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/click-events-have-key-events
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) e.currentTarget.close();
      }}
      aria-labelledby="ensemble-detail-title"
      className="open:flex flex-col w-full max-w-none sm:max-w-2xl max-h-[92dvh] m-0 mt-auto sm:m-auto p-0 rounded-t-3xl sm:rounded-3xl bg-slate-950 text-white shadow-2xl overflow-hidden backdrop:bg-black/70 backdrop:backdrop-blur-sm"
    >
      {/* Header */}
      <header className="flex items-start justify-between gap-3 px-5 py-4 bg-slate-900 shrink-0 border-b border-white/10">
        <div className="min-w-0">
          <h2
            id="ensemble-detail-title"
            className="text-base font-bold leading-tight text-white"
          >
            {weekLabel}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {location.name}
            {coveredDays > 0 && coveredDays < 7 && (
              <> · {t('ensemble.coverage').replace('{n}', String(coveredDays))}</>
            )}
          </p>
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

      {/* Variable switcher (scrolls horizontally on narrow screens) */}
      <div className="flex gap-1 px-4 pt-4 pb-2 shrink-0 overflow-x-auto">
        {vars.map((v) => {
          const active = v.key === variable;
          return (
            <button
              key={v.key}
              type="button"
              onClick={() => setVariable(v.key)}
              aria-pressed={active}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all duration-200 ${active ? 'bg-white text-slate-900 shadow' : 'bg-white/10 text-slate-300 hover:bg-white/15'}`}
            >
              <v.Icon size={12} className="shrink-0" aria-hidden="true" />
              {t(v.labelKey)}
            </button>
          );
        })}
      </div>

      {/* Low-confidence banner */}
      {lowConfidence && (
        <div className="px-4 pt-1 shrink-0">
          <div className="bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] rounded-lg px-3 py-1.5">
            {t('ensemble.low_confidence').replace('{week}', String(weekIndex + 1))}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-5">
        {ensembleBody ?? (
          <>
            {/* Chart */}
            <figure className="mt-2 rounded-2xl bg-slate-900/80 border border-white/10 overflow-hidden m-0">
              <figcaption className="flex items-center justify-between gap-2 px-3 pt-2 pb-0">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  {label}
                  {cumulative && points?.length ? (
                    <span className="normal-case font-semibold tracking-normal">
                      {' · '}
                      {t('ensemble.cumulative').replace(
                        '{date}',
                        fmtTime(points[0].time, { weekday: 'short', day: 'numeric' }),
                      )}
                    </span>
                  ) : null}
                </span>
                <span className="text-[10px] font-semibold text-slate-400">{varMeta.unit}</span>
              </figcaption>
              <ResponsiveContainer width="100%" height={220}>
                <ComposedChart
                  data={chartData}
                  margin={{ top: 8, right: 48, left: 16, bottom: 0 }}
                >
                  <XAxis
                    dataKey="i"
                    type="category"
                    ticks={noons}
                    interval={0}
                    tick={renderXTick}
                    height={24}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    yAxisId="main"
                    orientation="right"
                    mirror
                    domain={yDomain}
                    allowDataOverflow
                    tickFormatter={(v: number) =>
                      Number.isInteger(v) ? String(v) : fmtValue(v)
                    }
                    tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 600 }}
                    axisLine={false}
                    tickLine={false}
                    width={40}
                  />

                  {midnights.map((idx) => (
                    <ReferenceLine
                      key={idx}
                      x={idx}
                      yAxisId="main"
                      stroke="rgba(255,255,255,0.08)"
                    />
                  ))}

                  {nowIndex !== null && (
                    <ReferenceLine
                      x={nowIndex}
                      yAxisId="main"
                      stroke="rgba(255,255,255,0.45)"
                      strokeDasharray="2 3"
                      label={{
                        value: t('ensemble.legend.now'),
                        position: 'insideTopLeft',
                        fill: '#cbd5e1',
                        fontSize: 9,
                      }}
                    />
                  )}

                  <SpaghettiLayer points={points!} color={varMeta.color} />
                  <BandLayer
                    points={points!}
                    low="p10"
                    high="p90"
                    fill={varMeta.color}
                    opacity={OUTER_BAND_OPACITY}
                    zIndex={2}
                  />
                  <BandLayer
                    points={points!}
                    low="p25"
                    high="p75"
                    fill={varMeta.color}
                    opacity={INNER_BAND_OPACITY}
                    zIndex={3}
                  />

                  {weeklyNormal !== null && (
                    <Line
                      dataKey="normal"
                      yAxisId="main"
                      stroke="#e2e8f0"
                      strokeWidth={1.25}
                      strokeDasharray="5 4"
                      dot={false}
                      activeDot={false}
                      isAnimationActive={false}
                    />
                  )}

                  <Line
                    dataKey="mean"
                    yAxisId="main"
                    stroke={varMeta.color}
                    strokeWidth={2.5}
                    dot={false}
                    activeDot={{ r: 3, fill: varMeta.color, stroke: '#0f172a' }}
                    isAnimationActive={false}
                  />

                  <Tooltip
                    content={renderTooltip}
                    cursor={{ stroke: 'rgba(255,255,255,0.25)' }}
                    isAnimationActive={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </figure>

            {/* Legend — swatch opacities match the chart */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-1 mt-2 text-[10px] text-slate-400">
              <span className="flex items-center gap-1">
                <span
                  className="inline-block w-4 h-0.5 rounded-full"
                  style={{ backgroundColor: varMeta.color, opacity: MEMBER_OPACITY * 3 }}
                />
                <span>{t('ensemble.legend.members')}</span>
              </span>
              <span className="flex items-center gap-1">
                <span
                  className="inline-block w-4 h-2 rounded-sm"
                  style={{ backgroundColor: varMeta.color, opacity: OUTER_BAND_OPACITY }}
                />
                <span>p10–p90</span>
              </span>
              <span className="flex items-center gap-1">
                <span
                  className="inline-block w-4 h-2 rounded-sm"
                  style={{
                    backgroundColor: varMeta.color,
                    opacity: OUTER_BAND_OPACITY + INNER_BAND_OPACITY,
                  }}
                />
                <span>p25–p75</span>
              </span>
              <span className="flex items-center gap-1">
                <span
                  className="inline-block w-4 h-0.5 rounded-full"
                  style={{ backgroundColor: varMeta.color }}
                />
                <span>{t('ensemble.legend.mean')}</span>
              </span>
              {weeklyNormal !== null && (
                <span className="flex items-center gap-1">
                  <span className="inline-block w-4 border-t border-dashed border-slate-200" />
                  <span>{t('ensemble.legend.normal')}</span>
                </span>
              )}
            </div>

            {/* Spread classification */}
            {classification && (
              <div className="mt-4">
                {spreadBadge()}
                <p className="mt-2 text-[11px] text-slate-400 leading-relaxed">
                  {t(`ensemble.spread.${classification.label}.detail`)}
                </p>
              </div>
            )}

            {/* Footnote */}
            <p className="mt-4 text-[10px] text-slate-500 leading-relaxed">
              {t('ensemble.footnote')}
            </p>
          </>
        )}
      </div>
    </dialog>
  );
}
