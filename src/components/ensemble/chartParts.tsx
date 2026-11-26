import { useCallback, useMemo, useState } from 'react';
import { Wind, Gauge, Snowflake, type LucideIcon } from 'lucide-react';
import {
  ReferenceArea,
  ReferenceLine,
  ZIndexLayer,
  useXAxisScale,
  useYAxisScale,
} from 'recharts';
import type { Location, SeasonalPeriod, SeasonalVariable } from '../../types/weather';
import { useLanguage } from '../../hooks/useLanguage';
import {
  localMidnightIndices,
  stepNormals,
  weekStartIndices,
  type EnsemblePoint,
  type EnsembleStats,
} from '../../utils/ensembleStats';

export const HOUR_MS = 60 * 60 * 1000;

// Opacities shared by the chart and its legend so the swatches match what is drawn
export const MEMBER_OPACITY = 0.15;
export const OUTER_BAND_OPACITY = 0.12;
export const INNER_BAND_OPACITY = 0.26;
export const RAIN_BAR_OPACITY = 0.7;
// Amber at the shared 0.12 reads as grey on slate
export const SUN_BAND_OPACITY = 0.22;

export const TEMP_COLOR = '#fca5a5';
export const RAIN_COLOR = '#7dd3fc';
export const SUN_COLOR = '#fbbf24';
export const CHART_HEIGHT = 260;

export interface ScopeProps {
  location: Location;
  /** Monday-start UTC week (YYYY-MM-DD); null = the full ensemble window (range view). */
  weekStart: string | null;
  /** EC46 weeks that provide the normals (one for the weekly dialog, all overlapping for range). */
  weeks: SeasonalPeriod[];
  /** Plot height: px number, or any CSS length (the plot sits in a box of this height). */
  chartHeight: number | string;
  /** Range-view presentation: day numbers, week separators, low-confidence area. */
  range?: boolean;
}

export type SingleVar = 'pressure_msl' | 'snowfall' | 'wind_speed_10m';
export type Tab = 'combined' | SingleVar;

export interface SingleVarMeta {
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

export const VARS: SingleVarMeta[] = [
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

export interface ChartRow {
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

export const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Splits indices into contiguous runs where `ok(i)` holds (paths break across gaps). */
export function runs(length: number, ok: (i: number) => boolean): number[][] {
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
export function rainAxisFor(points: EnsemblePoint[]): {
  domain: [number, number];
  ticks: number[];
} {
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
export function domainFor(
  points: EnsemblePoint[],
  normals: (number | null)[],
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
  normals.forEach(take);
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
export function niceStep(raw: number): number {
  const exp = 10 ** Math.floor(Math.log10(raw));
  const f = raw / exp;
  const m = [1, 2, 2.5, 5, 10].find((c) => f <= c) ?? 10;
  return m * exp;
}

/** Index of the hourly point containing `now`, or null when now is outside the chart. */
export function nowIndexOf(points: EnsemblePoint[], now: number): number | null {
  const first = points[0].time;
  const last = points.at(-1)!.time;
  if (now < first || now > last + HOUR_MS) return null;
  return Math.min(points.length - 1, Math.floor((now - first) / HOUR_MS));
}

// --- Custom chart layers ---

export function SpaghettiLayer({
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

export function BandLayer({
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

export function Swatch({
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

export function ChartLegend({
  showNormal,
  lowConfidence = false,
}: {
  showNormal: boolean;
  lowConfidence?: boolean;
}) {
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
      {lowConfidence && <LowConfidenceNote />}
    </div>
  );
}

export function ChartCaption() {
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

export function SpreadBadge({ label }: { label: 'agree' | 'disagree' | 'bimodal' }) {
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
export function buildRows(
  temp: EnsemblePoint[],
  rain: EnsemblePoint[] | null,
  sun: EnsemblePoint[] | null,
  tempNormals: (number | null)[],
  sunNormals: (number | null)[],
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
      normal: tempNormals[i] ?? null,
      rain: r?.mean ?? null,
      rainP10: r?.p10 ?? null,
      rainP90: r?.p90 ?? null,
      sun: s?.mean ?? null,
      sunP10: s?.p10 ?? null,
      sunP90: s?.p90 ?? null,
      sunNormal: s ? (sunNormals[i] ?? null) : null,
    };
  });
}

export const fmt1 = (v: number) => v.toFixed(1);
// Clamped: member interpolation can give tiny negative means ("-0.0")
export const fmtRain = (v: number) => {
  const x = Math.max(0, v);
  return x < 10 ? x.toFixed(1) : String(Math.round(x));
};

export function SingleLegend({
  color,
  showNormal,
  lowConfidence = false,
}: {
  color: string;
  showNormal: boolean;
  lowConfidence?: boolean;
}) {
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
      {lowConfidence && <LowConfidenceNote />}
    </div>
  );
}

export function LoadingOrError({
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

function LowConfidenceNote() {
  const { t } = useLanguage();
  return (
    <span className="flex items-center gap-1">
      <span
        className="inline-block w-4 h-2 rounded-sm bg-amber-400"
        style={{ opacity: 0.25 }}
        aria-hidden="true"
      />
      <span>{t('ensemble.range.low_confidence')}</span>
    </span>
  );
}

/** Locale-aware formatter in the location's timezone (falls back to the device zone). */
export function useFmtTime(timeZone?: string) {
  const { language } = useLanguage();
  const locale = language === 'en' ? 'en-GB' : 'es-ES';
  return useCallback(
    (ms: number, opts: Intl.DateTimeFormatOptions) => {
      try {
        return new Date(ms).toLocaleString(locale, { ...opts, timeZone });
      } catch {
        return new Date(ms).toLocaleString(locale, opts);
      }
    },
    [locale, timeZone],
  );
}

/** Local-midnight indices (day separators) and local-noon indices (day labels). */
export function useDayMarks(points: EnsemblePoint[] | null, timeZone?: string) {
  const midnights = useMemo(
    () => (points?.length ? localMidnightIndices(points, timeZone) : []),
    [points, timeZone],
  );
  const noons = useMemo(
    () => (points?.length ? localMidnightIndices(points, timeZone, 12) : []),
    [points, timeZone],
  );
  return { midnights, noons };
}

/** EC46 weekly normal of each point's week (`pick` = normal of one week, null if unknown). */
export function usePointNormals(
  points: EnsemblePoint[] | null,
  weeks: SeasonalPeriod[],
  pick: (p: SeasonalPeriod) => number | null,
): (number | null)[] {
  return useMemo(
    () =>
      points?.length
        ? stepNormals(
            points,
            weeks.map((w) => w.start),
            weeks.map(pick),
          )
        : [],
    [points, weeks, pick],
  );
}

/** `mean − anomaly` (the model's own climatology) of a seasonal value, scaled; null if missing. */
export function normalOf(
  value: { mean: number | null; anomaly: number | null },
  scale = 1,
): number | null {
  return value.mean === null || value.anomaly === null
    ? null
    : (value.mean - value.anomaly) * scale;
}

/** Weeks from this index on are low confidence (week 3+, same rule as the weekly dialog). */
const LOW_CONFIDENCE_FROM_WEEK = 2;

export interface RangeMarks {
  /** First point of every week after the first (separators) with its 0-based week index. */
  weekLines: { index: number; week: number }[];
  /** Index of the first point of a low-confidence week, or null. */
  lowFrom: number | null;
}

export function useRangeMarks(
  points: EnsemblePoint[] | null,
  weeks: SeasonalPeriod[],
  range: boolean,
): RangeMarks {
  return useMemo(() => {
    if (!range || !points?.length) return { weekLines: [], lowFrom: null };
    const starts = weekStartIndices(
      points,
      weeks.map((w) => w.start),
    );
    return {
      weekLines: starts.filter((s) => s.index > 0),
      lowFrom: starts.find((s) => s.week >= LOW_CONFIDENCE_FROM_WEEK)?.index ?? null,
    };
  }, [points, weeks, range]);
}

/** Below this width per day the range view labels every other day. */
const MIN_DAY_LABEL_PX = 44;

/** Day-label ticks; in range mode every other one is dropped when the chart is too narrow. */
export function useDayTicks(noons: number[], range: boolean) {
  const [width, setWidth] = useState(0);
  const step =
    range && noons.length && width > 0 && width / noons.length < MIN_DAY_LABEL_PX ? 2 : 1;
  const ticks = useMemo(() => noons.filter((_, k) => k % step === 0), [noons, step]);
  return { ticks, onResize: range ? setWidth : undefined };
}

/** Range-view overlays: faint low-confidence area (week 3+) and a stronger line per week start. */
export function rangeDecor(
  marks: RangeMarks,
  yAxisId: string,
  lastIndex: number,
  weekLabel: (week: number) => string,
) {
  const items = marks.weekLines.map(({ index, week }) => (
    <ReferenceLine
      key={`wk${index}`}
      x={index}
      yAxisId={yAxisId}
      stroke="rgba(255,255,255,0.22)"
      label={{
        value: weekLabel(week),
        position: 'insideTopRight',
        fill: '#94a3b8',
        fontSize: 9,
      }}
    />
  ));
  if (marks.lowFrom !== null) {
    items.unshift(
      <ReferenceArea
        key="low"
        x1={marks.lowFrom}
        x2={lastIndex}
        yAxisId={yAxisId}
        fill="#fbbf24"
        fillOpacity={0.05}
        stroke="none"
        ifOverflow="visible"
      />,
    );
  }
  return items;
}

/** X tick text: weekday (+ day number in range mode), capitalised. */
export function dayLabel(
  fmtTime: (ms: number, opts: Intl.DateTimeFormatOptions) => string,
  time: number,
  range: boolean,
): string {
  const wd = capitalize(fmtTime(time, { weekday: 'short' }));
  return range ? `${wd} ${fmtTime(time, { day: 'numeric' })}` : wd;
}

/** "Sem. 2" / "Wk 2" from a 0-based week index. */
export function useWeekLabel() {
  const { t } = useLanguage();
  return useCallback(
    (week: number) => t('ensemble.range.week_short').replace('{n}', String(week + 1)),
    [t],
  );
}
