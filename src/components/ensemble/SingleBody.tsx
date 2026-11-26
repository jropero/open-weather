import { useCallback } from 'react';
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import type { XAxisTickContentProps } from 'recharts';
import type { SeasonalPeriod } from '../../types/weather';
import { useLanguage } from '../../hooks/useLanguage';
import { useNow } from '../../hooks/useNow';
import { useEnsembleData } from '../../hooks/useEnsembleData';
import { classifySpread, type EnsembleVar } from '../../utils/ensembleStats';
import { useMemo } from 'react';
import {
  BandLayer,
  INNER_BAND_OPACITY,
  LoadingOrError,
  OUTER_BAND_OPACITY,
  SingleLegend,
  SpaghettiLayer,
  SpreadBadge,
  capitalize,
  dayLabel,
  domainFor,
  normalOf,
  nowIndexOf,
  rangeDecor,
  useDayMarks,
  useDayTicks,
  useFmtTime,
  usePointNormals,
  useRangeMarks,
  useWeekLabel,
  type ChartRow,
  type ScopeProps,
  type SingleVarMeta,
} from './chartParts';

// eslint-disable-next-line sonarjs/cognitive-complexity
export function SingleBody({
  location,
  weekStart,
  weeks,
  chartHeight,
  range = false,
  meta,
}: ScopeProps & { meta: SingleVarMeta }) {
  const { t } = useLanguage();
  const weekLabel = useWeekLabel();
  const now = useNow();
  const variable: EnsembleVar = meta.key;
  const {
    data: points,
    loading,
    error,
  } = useEnsembleData(
    location.latitude,
    location.longitude,
    weekStart,
    variable,
    location.timezone,
  );
  const timeZone = location.timezone;
  const fmtTime = useFmtTime(timeZone);

  const classification = useMemo(
    () => (points && points.length ? classifySpread(points, variable) : null),
    [points, variable],
  );
  // Pressure: EC46 weekly mean drawn as a flat (per week) normal line (none for hourly snow/wind)
  const pickNormal = useCallback(
    (p: SeasonalPeriod) =>
      meta.seasonal && meta.flatNormal ? normalOf(p.values[meta.seasonal]) : null,
    [meta],
  );
  const normals = usePointNormals(points, weeks, pickNormal);
  const hasNormal = normals.some((v) => v !== null);
  const chartData = useMemo<ChartRow[]>(
    () =>
      points?.length
        ? points.map((pt, i) => ({
            i,
            mean: pt.stats?.mean ?? null,
            p10: pt.stats?.p10 ?? null,
            p90: pt.stats?.p90 ?? null,
            normal: normals[i] ?? null,
            rain: null,
            rainP10: null,
            rainP90: null,
            sun: null,
            sunP10: null,
            sunP90: null,
            sunNormal: null,
          }))
        : [],
    [points, normals],
  );
  const yDomain = useMemo(
    () =>
      points?.length
        ? domainFor(points, normals, meta.nonNegative)
        : ([0, 10] as [number, number]),
    [points, normals, meta.nonNegative],
  );
  const { midnights, noons } = useDayMarks(points, timeZone);
  const { ticks: dayTicks, onResize } = useDayTicks(noons, range);
  const marks = useRangeMarks(points, weeks, range);
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
          {dayLabel(fmtTime, pt.time, range)}
        </text>
      );
    },
    [points, fmtTime, range],
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
        <div style={{ height: chartHeight }}>
          <ResponsiveContainer width="100%" height="100%" onResize={onResize}>
            <ComposedChart data={chartData} margin={{ top: 8, right: 48, left: 16, bottom: 0 }}>
              <XAxis
                dataKey="i"
                type="category"
                ticks={dayTicks}
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
                <ReferenceLine
                  key={idx}
                  x={idx}
                  yAxisId="main"
                  stroke="rgba(255,255,255,0.08)"
                />
              ))}
              {rangeDecor(marks, 'main', chartData.length - 1, weekLabel)}
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
              {hasNormal && (
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
        </div>
      </figure>
      <SingleLegend
        color={meta.color}
        showNormal={hasNormal}
        lowConfidence={marks.lowFrom !== null}
      />
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
