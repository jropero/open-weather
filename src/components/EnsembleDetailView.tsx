import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X, Wind, Gauge, Thermometer, Snowflake, type LucideIcon } from 'lucide-react';
import {
  Bar,
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
  classifySpread,
  ensembleDaysInWeek,
  localMidnightIndices,
  type EnsemblePoint,
  type EnsembleStats,
  type EnsembleVar,
} from '../utils/ensembleStats';

const HOUR_MS = 60 * 60 * 1000;

// Opacities shared by the chart and its legend so the swatches match what is drawn
const MEMBER_OPACITY = 0.15;
const OUTER_BAND_OPACITY = 0.12;
const INNER_BAND_OPACITY = 0.26;
const RAIN_BAR_OPACITY = 0.7;
// Amber at the shared 0.12 reads as grey on slate
const SUN_BAND_OPACITY = 0.22;

const TEMP_COLOR = '#fca5a5';
const RAIN_COLOR = '#7dd3fc';
const SUN_COLOR = '#fbbf24';
const CHART_HEIGHT = 260;

interface Props {
  location: Location;
  period: SeasonalPeriod;
  weekIndex: number; // 0-based (0 = "Semana 1")
  initialVariable: SeasonalVariable;
  lowConfidence: boolean;
  onClose: () => void;
}

interface BodyProps {
  location: Location;
  period: SeasonalPeriod;
}

type SingleVar = 'pressure_msl' | 'snowfall' | 'wind_speed_10m';
type Tab = 'combined' | SingleVar;

interface SingleVarMeta {
  key: SingleVar;
  /** Outlook variable that provides the EC46 weekly normal (null = no normal available). */
  seasonal: SeasonalVariable | null;
  labelKey: string;
  unit: string;
  color: string;
  Icon: LucideIcon;
  nonNegative: boolean;
  flatNormal: boolean;
}

const VARS: SingleVarMeta[] = [
  {
    key: 'pressure_msl',
    seasonal: 'pressure',
    labelKey: 'seasonal.var.pressure',
    unit: 'hPa',
    color: '#c084fc',
    Icon: Gauge,
    nonNegative: false,
    flatNormal: true,
  },
  {
    key: 'snowfall',
    seasonal: 'snowfall',
    labelKey: 'seasonal.var.snowfall',
    unit: 'cm',
    color: '#a5f3fc',
    Icon: Snowflake,
    nonNegative: true,
    flatNormal: false,
  },
  {
    key: 'wind_speed_10m',
    seasonal: null,
    labelKey: 'ensemble.var.wind',
    unit: 'km/h',
    color: '#6ee7b7',
    Icon: Wind,
    nonNegative: true,
    flatNormal: false,
  },
];

interface ChartRow {
  i: number;
  mean: number | null;
  p10: number | null;
  p90: number | null;
  normal: number | null;
  rain: number | null;
  rainP10: number | null;
  rainP90: number | null;
  sun: number | null;
  sunP10: number | null;
  sunP90: number | null;
  sunNormal: number | null;
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

/**
 * Rain axis: starts at 0 and the top is ~3× the highest p90, so the bars stay in the lower
 * third of the plot. Ticks only cover that lower third.
 */
function rainAxisFor(points: EnsemblePoint[]): { domain: [number, number]; ticks: number[] } {
  const p90 = Math.max(0, ...points.map((p) => p.stats?.p90 ?? 0));
  const raw = Math.max(1, p90 * 3);
  const top = Math.ceil(raw / niceStep(raw / 4)) * niceStep(raw / 4);
  const step = niceStep(top / 6);
  const ticks: number[] = [];
  for (let v = 0; v <= top / 3 + 1e-9; v += step) ticks.push(Number(v.toFixed(2)));
  return { domain: [0, top], ticks };
}

/**
 * Y domain covering every member (not only p10–p90, so outliers stay inside). `bottomRoom`
 * adds that share of the range below (combined chart: temp sits above the rain bars).
 */
function domainFor(
  points: EnsemblePoint[],
  normal: number | null,
  nonNegative: boolean,
  bottomRoom = 0,
): [number, number] {
  let min = Infinity;
  let max = -Infinity;
  const take = (v: number | null) => {
    if (v === null) return;
    if (v < min) min = v;
    if (v > max) max = v;
  };
  points.forEach((p) => p.members.forEach(take));
  take(normal);
  if (min > max) return [0, 1];
  const range = Math.max(max - min, 1);
  const pad = Math.max((max - min) * 0.06, 0.5);
  const lo = nonNegative ? 0 : min - pad - range * bottomRoom;
  const hi = max + pad;
  // Snap both ends to a round step so the ticks land on round numbers
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

function SpaghettiLayer({
  points,
  color,
  yAxisId,
}: {
  points: EnsemblePoint[];
  color: string;
  yAxisId: string;
}) {
  const xScale = useXAxisScale();
  const yScale = useYAxisScale(yAxisId);

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
  yAxisId,
}: {
  points: EnsemblePoint[];
  low: keyof EnsembleStats;
  high: keyof EnsembleStats;
  fill: string;
  opacity: number;
  zIndex: number;
  yAxisId: string;
}) {
  const xScale = useXAxisScale();
  const yScale = useYAxisScale(yAxisId);

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

function Swatch({
  kind,
  color,
  opacity,
}: {
  kind: 'line' | 'band' | 'bar';
  color: string;
  opacity?: number;
}) {
  const cls = kind === 'line' ? 'w-4 h-0.5 rounded-full' : 'w-4 h-2 rounded-sm';
  return (
    <span
      className={`inline-block ${cls}`}
      style={{ backgroundColor: color, opacity: opacity ?? 1 }}
      aria-hidden="true"
    />
  );
}

function ChartLegend({ showNormal }: { showNormal: boolean }) {
  const { t } = useLanguage();
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-1 mt-2 text-[10px] text-slate-400">
      <span className="flex items-center gap-1">
        <Swatch kind="line" color={TEMP_COLOR} opacity={MEMBER_OPACITY * 3} />
        <span>{t('ensemble.legend.members')}</span>
      </span>
      <span className="flex items-center gap-1">
        <Swatch kind="band" color={TEMP_COLOR} opacity={OUTER_BAND_OPACITY} />
        <span>p10–p90</span>
      </span>
      <span className="flex items-center gap-1">
        <Swatch
          kind="band"
          color={TEMP_COLOR}
          opacity={OUTER_BAND_OPACITY + INNER_BAND_OPACITY}
        />
        <span>p25–p75</span>
      </span>
      <span className="flex items-center gap-1">
        <Swatch kind="line" color={TEMP_COLOR} />
        <span>{t('ensemble.legend.mean')}</span>
      </span>
      {showNormal && (
        <span className="flex items-center gap-1">
          <span className="inline-block w-4 border-t border-dashed border-slate-200" />
          <span>{t('ensemble.legend.normal')}</span>
        </span>
      )}
      <span className="flex items-center gap-1">
        <Swatch kind="bar" color={RAIN_COLOR} opacity={RAIN_BAR_OPACITY} />
        <span>{t('seasonal.var.precipitation')}</span>
      </span>
      <span className="flex items-center gap-1">
        <Swatch kind="line" color={SUN_COLOR} />
        <span>{t('seasonal.var.sunshine')}</span>
      </span>
    </div>
  );
}

function ChartCaption() {
  const { t } = useLanguage();
  const keys = [
    { color: TEMP_COLOR, label: t('seasonal.var.temperature'), unit: '°C' },
    { color: RAIN_COLOR, label: t('seasonal.var.precipitation'), unit: 'mm/h' },
    { color: SUN_COLOR, label: t('seasonal.var.sunshine'), unit: t('ensemble.unit.sun_day') },
  ];
  return (
    <figcaption className="flex flex-wrap items-center gap-x-3 gap-y-0.5 px-3 pt-2 pb-0 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
      {keys.map((k) => (
        <span key={k.label} className="flex items-center gap-1">
          <span
            className="inline-block w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: k.color }}
            aria-hidden="true"
          />
          {k.label}
          <span className="normal-case font-semibold tracking-normal">{k.unit}</span>
        </span>
      ))}
    </figcaption>
  );
}

function SpreadBadge({ label }: { label: 'agree' | 'disagree' | 'bimodal' }) {
  const { t } = useLanguage();
  const configs = {
    agree: { bg: 'bg-emerald-800/60 text-emerald-200', icon: '✓' },
    disagree: { bg: 'bg-amber-800/60 text-amber-200', icon: '⚡' },
    bimodal: { bg: 'bg-violet-800/60 text-violet-200', icon: '⑂' },
  };
  const cfg = configs[label];
  return (
    <div
      className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold ${cfg.bg}`}
    >
      <span className="text-base leading-none" aria-hidden="true">
        {cfg.icon}
      </span>
      <span>{t(`ensemble.spread.${label}`)}</span>
    </div>
  );
}

/** Pairs the rain/sun points with the temperature points by index; mismatches become null. */
function buildRows(
  temp: EnsemblePoint[],
  rain: EnsemblePoint[] | null,
  sun: EnsemblePoint[] | null,
  tempNormal: number | null,
  sunNormal: number | null,
): ChartRow[] {
  const at = (arr: EnsemblePoint[] | null, i: number) =>
    arr?.[i] && arr[i].time === temp[i].time ? (arr[i].stats ?? null) : null;
  return temp.map((pt, i) => {
    const r = at(rain, i);
    const s = at(sun, i);
    return {
      i,
      mean: pt.stats?.mean ?? null,
      p10: pt.stats?.p10 ?? null,
      p90: pt.stats?.p90 ?? null,
      normal: tempNormal,
      rain: r?.mean ?? null,
      rainP10: r?.p10 ?? null,
      rainP90: r?.p90 ?? null,
      sun: s?.mean ?? null,
      sunP10: s?.p10 ?? null,
      sunP90: s?.p90 ?? null,
      sunNormal: s ? sunNormal : null,
    };
  });
}

const fmt1 = (v: number) => v.toFixed(1);
const fmtRain = (v: number) => (Math.abs(v) < 10 ? v.toFixed(1) : String(Math.round(v)));

// eslint-disable-next-line sonarjs/cognitive-complexity
function CombinedBody({ location, period }: BodyProps) {
  const { language, t } = useLanguage();
  const now = useNow();

  const tempQ = useEnsembleData(
    location.latitude,
    location.longitude,
    period.start,
    'temperature_2m',
    location.timezone,
  );
  const rainQ = useEnsembleData(
    location.latitude,
    location.longitude,
    period.start,
    'precipitation',
    location.timezone,
  );
  const sunQ = useEnsembleData(
    location.latitude,
    location.longitude,
    period.start,
    'sunshine_duration',
    location.timezone,
  );
  const points = tempQ.data;
  const loading = tempQ.loading || rainQ.loading || sunQ.loading;
  const error = tempQ.error;

  const locale = language === 'en' ? 'en-GB' : 'es-ES';
  const timeZone = location.timezone;

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

  const classification = useMemo(
    () => (points && points.length ? classifySpread(points, 'temperature_2m') : null),
    [points],
  );

  // EC46 weekly normals (model climatology): temperature = weekly mean; sunshine = total / 7 per day
  const tempNormal = useMemo(() => {
    const { mean, anomaly } = period.values.temperature;
    return mean === null || anomaly === null ? null : mean - anomaly;
  }, [period]);
  const sunNormal = useMemo(() => {
    const { mean, anomaly } = period.values.sunshine;
    return mean === null || anomaly === null ? null : (mean - anomaly) / 3600 / 7;
  }, [period]);

  const rainPoints = rainQ.data;
  const sunPoints = sunQ.data;
  const chartData = useMemo<ChartRow[]>(
    () =>
      points?.length ? buildRows(points, rainPoints, sunPoints, tempNormal, sunNormal) : [],
    [points, rainPoints, sunPoints, tempNormal, sunNormal],
  );
  const hasRain = chartData.some((r) => r.rain !== null);
  const hasSun = chartData.some((r) => r.sun !== null);

  const tempDomain = useMemo(
    () =>
      points?.length
        ? domainFor(points, tempNormal, false, 0.5)
        : ([0, 10] as [number, number]),
    [points, tempNormal],
  );
  const tempTicks = useMemo(() => {
    const [lo, hi] = tempDomain;
    const step = niceStep((hi - lo) / 4);
    const ticks: number[] = [];
    for (let v = lo; v <= hi + 1e-9; v += step) if (v >= lo + (hi - lo) / 3) ticks.push(v);
    return ticks;
  }, [tempDomain]);
  const rainAxis = useMemo(
    () =>
      rainPoints?.length
        ? rainAxisFor(rainPoints)
        : { domain: [0, 1] as [number, number], ticks: [0] },
    [rainPoints],
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

  const renderXTick = useCallback(
    ({ x: rawX, y: rawY, payload }: XAxisTickContentProps) => {
      const idx = Number(payload.value);
      const pt = points?.[idx];
      if (!pt) return <g />;
      const sun = chartData[idx]?.sun ?? null;
      const x = Number(rawX);
      const y = Number(rawY);
      return (
        <g>
          <text x={x} y={y + 13} textAnchor="middle" fontSize={10} fill="#94a3b8">
            {capitalize(fmtTime(pt.time, { weekday: 'short' }))}
          </text>
          {sun !== null && (
            <text x={x} y={y + 25} textAnchor="middle" fontSize={9} fill={SUN_COLOR}>
              {`☀ ${Math.round(sun)}h`}
            </text>
          )}
        </g>
      );
    },
    [points, chartData, fmtTime],
  );

  const renderTooltip = useCallback(
    ({ active, label }: { active?: boolean; label?: unknown }) => {
      const row = active ? chartData[Number(label)] : undefined;
      const pt = points?.[Number(label)];
      if (!row || !pt) return null;
      const range = (
        lo: number | null,
        hi: number | null,
        f: (v: number) => string,
        u: string,
      ) =>
        lo !== null && hi !== null ? (
          <div className="text-slate-300">
            p10–p90: {f(lo)}–{f(hi)} {u}
          </div>
        ) : null;
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
          {row.mean !== null && (
            <div className="mt-0.5" style={{ color: TEMP_COLOR }}>
              {t('seasonal.var.temperature')}: <b>{fmt1(row.mean)} °C</b>
              {range(row.p10, row.p90, fmt1, '°C')}
              {row.normal !== null && (
                <div className="text-slate-300">
                  {t('ensemble.tooltip.normal')}: {fmt1(row.normal)} °C
                </div>
              )}
            </div>
          )}
          {row.rain !== null && (
            <div className="mt-0.5" style={{ color: RAIN_COLOR }}>
              {t('seasonal.var.precipitation')}: <b>{fmtRain(row.rain)} mm/h</b>
              {range(row.rainP10, row.rainP90, fmtRain, 'mm/h')}
            </div>
          )}
          {row.sun !== null && (
            <div className="mt-0.5" style={{ color: SUN_COLOR }}>
              {t('seasonal.var.sunshine')} ({t('ensemble.unit.sun_day')}):{' '}
              <b>{fmt1(row.sun)} h</b>
              {range(row.sunP10, row.sunP90, fmt1, 'h')}
              {row.sunNormal !== null && (
                <div className="text-slate-300">
                  {t('ensemble.tooltip.normal')}: {fmt1(row.sunNormal)} h
                </div>
              )}
            </div>
          )}
        </div>
      );
    },
    [chartData, points, fmtTime, t],
  );

  const empty = !points?.length || chartData.every((r) => r.mean === null);
  if (loading || error || empty)
    return <LoadingOrError loading={loading} error={!!error} empty={empty} />;

  return (
    <>
      <figure className="mt-3 rounded-2xl bg-slate-900/80 border border-white/10 overflow-hidden m-0">
        <ChartCaption />
        <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
          <ComposedChart
            data={chartData}
            margin={{ top: 8, right: 4, left: 4, bottom: 0 }}
            barCategoryGap={0}
          >
            <XAxis
              dataKey="i"
              type="category"
              ticks={noons}
              interval={0}
              tick={renderXTick}
              height={36}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              yAxisId="temp"
              orientation="right"
              mirror
              domain={tempDomain}
              ticks={tempTicks}
              allowDataOverflow
              tickFormatter={(v: number) => (Number.isInteger(v) ? String(v) : fmt1(v))}
              tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 600 }}
              axisLine={false}
              tickLine={false}
              width={40}
            />
            <YAxis
              yAxisId="rain"
              orientation="left"
              hide={!hasRain}
              domain={rainAxis.domain}
              ticks={rainAxis.ticks}
              allowDataOverflow
              tick={{ fill: RAIN_COLOR, fontSize: 10, fontWeight: 600 }}
              axisLine={false}
              tickLine={false}
              width={28}
            />
            <YAxis yAxisId="sun" hide domain={[0, 24]} allowDataOverflow />

            {midnights.map((idx) => (
              <ReferenceLine key={idx} x={idx} yAxisId="temp" stroke="rgba(255,255,255,0.08)" />
            ))}

            {nowIndex !== null && (
              <ReferenceLine
                x={nowIndex}
                yAxisId="temp"
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

            {hasRain && rainPoints && (
              <BandLayer
                points={rainPoints}
                low="p10"
                high="p90"
                fill={RAIN_COLOR}
                opacity={OUTER_BAND_OPACITY}
                zIndex={2}
                yAxisId="rain"
              />
            )}
            {hasRain && (
              <Bar
                dataKey="rain"
                yAxisId="rain"
                fill={RAIN_COLOR}
                fillOpacity={RAIN_BAR_OPACITY}
                isAnimationActive={false}
                activeBar={false}
              />
            )}

            {hasSun && sunPoints && (
              <BandLayer
                points={sunPoints}
                low="p10"
                high="p90"
                fill={SUN_COLOR}
                opacity={SUN_BAND_OPACITY}
                zIndex={2}
                yAxisId="sun"
              />
            )}
            {hasSun && (
              <Line
                dataKey="sun"
                yAxisId="sun"
                stroke={SUN_COLOR}
                strokeWidth={2}
                dot={false}
                activeDot={false}
                isAnimationActive={false}
              />
            )}

            <SpaghettiLayer points={points!} color={TEMP_COLOR} yAxisId="temp" />
            <BandLayer
              points={points!}
              low="p10"
              high="p90"
              fill={TEMP_COLOR}
              opacity={OUTER_BAND_OPACITY}
              zIndex={2}
              yAxisId="temp"
            />
            <BandLayer
              points={points!}
              low="p25"
              high="p75"
              fill={TEMP_COLOR}
              opacity={INNER_BAND_OPACITY}
              zIndex={3}
              yAxisId="temp"
            />

            {tempNormal !== null && (
              <Line
                dataKey="normal"
                yAxisId="temp"
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
              yAxisId="temp"
              stroke={TEMP_COLOR}
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 3, fill: TEMP_COLOR, stroke: '#0f172a' }}
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

      <ChartLegend showNormal={tempNormal !== null} />

      {/* Spread classification (temperature) */}
      {classification && (
        <div className="mt-4">
          <SpreadBadge label={classification.label} />
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
  );
}

function SingleLegend({ color, showNormal }: { color: string; showNormal: boolean }) {
  const { t } = useLanguage();
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-1 mt-2 text-[10px] text-slate-400">
      <span className="flex items-center gap-1">
        <Swatch kind="line" color={color} opacity={MEMBER_OPACITY * 3} />
        <span>{t('ensemble.legend.members')}</span>
      </span>
      <span className="flex items-center gap-1">
        <Swatch kind="band" color={color} opacity={OUTER_BAND_OPACITY} />
        <span>p10–p90</span>
      </span>
      <span className="flex items-center gap-1">
        <Swatch kind="band" color={color} opacity={OUTER_BAND_OPACITY + INNER_BAND_OPACITY} />
        <span>p25–p75</span>
      </span>
      <span className="flex items-center gap-1">
        <Swatch kind="line" color={color} />
        <span>{t('ensemble.legend.mean')}</span>
      </span>
      {showNormal && (
        <span className="flex items-center gap-1">
          <span className="inline-block w-4 border-t border-dashed border-slate-200" />
          <span>{t('ensemble.legend.normal')}</span>
        </span>
      )}
    </div>
  );
}

function LoadingOrError({
  loading,
  error,
  empty,
}: {
  loading: boolean;
  error: boolean;
  empty: boolean;
}) {
  const { t } = useLanguage();
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-3">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-sky-400" />
        <p className="text-sm text-slate-400">{t('ensemble.loading')}</p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-2" role="alert">
        <span className="text-2xl" aria-hidden="true">
          ⚠️
        </span>
        <p className="text-sm text-slate-300 text-center">{t('ensemble.error')}</p>
      </div>
    );
  }
  if (empty) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-2">
        <p className="text-sm text-slate-400">{t('ensemble.no_data')}</p>
      </div>
    );
  }
  return null;
}

// eslint-disable-next-line sonarjs/cognitive-complexity
function SingleBody({ location, period, meta }: BodyProps & { meta: SingleVarMeta }) {
  const { language, t } = useLanguage();
  const now = useNow();
  const variable: EnsembleVar = meta.key;
  const {
    data: points,
    loading,
    error,
  } = useEnsembleData(
    location.latitude,
    location.longitude,
    period.start,
    variable,
    location.timezone,
  );
  const locale = language === 'en' ? 'en-GB' : 'es-ES';
  const timeZone = location.timezone;
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

  const classification = useMemo(
    () => (points && points.length ? classifySpread(points, variable) : null),
    [points, variable],
  );
  // Pressure: EC46 weekly mean drawn as a flat normal line (no normal for hourly snow/wind)
  const weeklyNormal = useMemo(() => {
    if (!meta.seasonal || !meta.flatNormal) return null;
    const { mean, anomaly } = period.values[meta.seasonal];
    return mean === null || anomaly === null ? null : mean - anomaly;
  }, [period, meta]);
  const chartData = useMemo<ChartRow[]>(
    () =>
      points?.length
        ? points.map((pt, i) => ({
            i,
            mean: pt.stats?.mean ?? null,
            p10: pt.stats?.p10 ?? null,
            p90: pt.stats?.p90 ?? null,
            normal: weeklyNormal,
            rain: null,
            rainP10: null,
            rainP90: null,
            sun: null,
            sunP10: null,
            sunP90: null,
            sunNormal: null,
          }))
        : [],
    [points, weeklyNormal],
  );
  const yDomain = useMemo(
    () =>
      points?.length
        ? domainFor(points, weeklyNormal, meta.nonNegative)
        : ([0, 10] as [number, number]),
    [points, weeklyNormal, meta.nonNegative],
  );
  const midnights = useMemo(
    () => (points?.length ? localMidnightIndices(points, timeZone) : []),
    [points, timeZone],
  );
  const noons = useMemo(
    () => (points?.length ? localMidnightIndices(points, timeZone, 12) : []),
    [points, timeZone],
  );
  const nowIndex = points?.length ? nowIndexOf(points, now) : null;
  const fmtValue = useCallback(
    (v: number) => (variable === 'snowfall' ? v.toFixed(1) : String(Math.round(v))),
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
              {fmtValue(row.mean)} {meta.unit}
            </b>
          </div>
          {row.p10 !== null && row.p90 !== null && (
            <div className="text-slate-300">
              p10–p90: {fmtValue(row.p10)}–{fmtValue(row.p90)} {meta.unit}
            </div>
          )}
          {row.normal !== null && (
            <div className="text-slate-300">
              {t('ensemble.tooltip.normal')}: {fmtValue(row.normal)} {meta.unit}
            </div>
          )}
        </div>
      );
    },
    [chartData, points, fmtTime, fmtValue, t, meta.unit],
  );

  const state = (
    <LoadingOrError
      loading={loading}
      error={!!error}
      empty={!points?.length || chartData.every((r) => r.mean === null)}
    />
  );
  if (loading || error || !points?.length || chartData.every((r) => r.mean === null))
    return state;

  return (
    <>
      <figure className="mt-3 rounded-2xl bg-slate-900/80 border border-white/10 overflow-hidden m-0">
        <figcaption className="flex items-center justify-between gap-2 px-3 pt-2 pb-0">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            {t(meta.labelKey)}
          </span>
          <span className="text-[10px] font-semibold text-slate-400">{meta.unit}</span>
        </figcaption>
        <ResponsiveContainer width="100%" height={220}>
          <ComposedChart data={chartData} margin={{ top: 8, right: 48, left: 16, bottom: 0 }}>
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
              tickFormatter={(v: number) => (Number.isInteger(v) ? String(v) : fmtValue(v))}
              tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 600 }}
              axisLine={false}
              tickLine={false}
              width={40}
            />
            {midnights.map((idx) => (
              <ReferenceLine key={idx} x={idx} yAxisId="main" stroke="rgba(255,255,255,0.08)" />
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
            <SpaghettiLayer points={points} color={meta.color} yAxisId="main" />
            <BandLayer
              points={points}
              low="p10"
              high="p90"
              fill={meta.color}
              opacity={OUTER_BAND_OPACITY}
              zIndex={2}
              yAxisId="main"
            />
            <BandLayer
              points={points}
              low="p25"
              high="p75"
              fill={meta.color}
              opacity={INNER_BAND_OPACITY}
              zIndex={3}
              yAxisId="main"
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
              stroke={meta.color}
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 3, fill: meta.color, stroke: '#0f172a' }}
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
      <SingleLegend color={meta.color} showNormal={weeklyNormal !== null} />
      {classification && (
        <div className="mt-4">
          <SpreadBadge label={classification.label} />
          <p className="mt-2 text-[11px] text-slate-400 leading-relaxed">
            {t(`ensemble.spread.${classification.label}.detail`)}
          </p>
        </div>
      )}
      <p className="mt-4 text-[10px] text-slate-500 leading-relaxed">
        {t('ensemble.footnote')}
      </p>
    </>
  );
}

const INITIAL_TAB: Partial<Record<SeasonalVariable, Tab>> = {
  pressure: 'pressure_msl',
  snowfall: 'snowfall',
};
const initialTab = (v: SeasonalVariable): Tab => INITIAL_TAB[v] ?? 'combined';

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
  const [tab, setTab] = useState<Tab>(initialTab(initialVariable));

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
  const locale = language === 'en' ? 'en-GB' : 'es-ES';
  const fmtDate = (d: string, opts: Intl.DateTimeFormatOptions) =>
    new Date(`${d}T00:00:00Z`).toLocaleDateString(locale, { ...opts, timeZone: 'UTC' });
  const weekLabel = `${t('ensemble.week')} ${weekIndex + 1}: ${fmtDate(period.start, { day: 'numeric' })}–${fmtDate(period.end, { day: 'numeric', month: 'short' })}`;
  const coveredDays = ensembleDaysInWeek(period.start, now);
  const activeMeta = vars.find((v) => v.key === tab);

  const tabs: { key: Tab; label: string; Icon: LucideIcon }[] = [
    { key: 'combined', label: t('ensemble.var.combined'), Icon: Thermometer },
    ...vars.map((v) => ({ key: v.key, label: t(v.labelKey), Icon: v.Icon })),
  ];

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

      <div className="flex gap-1 px-4 pt-4 pb-2 shrink-0 overflow-x-auto">
        {tabs.map((v) => {
          const active = v.key === tab;
          return (
            <button
              key={v.key}
              type="button"
              onClick={() => setTab(v.key)}
              aria-pressed={active}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all duration-200 ${active ? 'bg-white text-slate-900 shadow' : 'bg-white/10 text-slate-300 hover:bg-white/15'}`}
            >
              <v.Icon size={12} className="shrink-0" aria-hidden="true" />
              {v.label}
            </button>
          );
        })}
      </div>

      {lowConfidence && (
        <div className="px-4 pt-1 shrink-0">
          <div className="bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] rounded-lg px-3 py-1.5">
            {t('ensemble.low_confidence').replace('{week}', String(weekIndex + 1))}
          </div>
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-5">
        {tab === 'combined' || !activeMeta ? (
          <CombinedBody location={location} period={period} />
        ) : (
          <SingleBody key={tab} location={location} period={period} meta={activeMeta} />
        )}
      </div>
    </dialog>
  );
}
