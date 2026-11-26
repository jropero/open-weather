import { useCallback, useMemo } from 'react';
import {
  Bar,
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
import { classifySpread } from '../../utils/ensembleStats';
import {
  BandLayer,
  ChartCaption,
  ChartLegend,
  INNER_BAND_OPACITY,
  LoadingOrError,
  OUTER_BAND_OPACITY,
  RAIN_BAR_OPACITY,
  RAIN_COLOR,
  SUN_BAND_OPACITY,
  SUN_COLOR,
  SpaghettiLayer,
  SpreadBadge,
  TEMP_COLOR,
  buildRows,
  capitalize,
  dayLabel,
  domainFor,
  fmt1,
  fmtRain,
  niceStep,
  normalOf,
  nowIndexOf,
  rainAxisFor,
  rangeDecor,
  useDayMarks,
  useDayTicks,
  useFmtTime,
  usePointNormals,
  useRangeMarks,
  useWeekLabel,
  type ChartRow,
  type ScopeProps,
} from './chartParts';

const pickTempNormal = (p: SeasonalPeriod) => normalOf(p.values.temperature);
const pickSunNormal = (p: SeasonalPeriod) => normalOf(p.values.sunshine, 1 / 3600 / 7);

// eslint-disable-next-line sonarjs/cognitive-complexity
export function CombinedBody({
  location,
  weekStart,
  weeks,
  chartHeight,
  range = false,
}: ScopeProps) {
  const { t } = useLanguage();
  const now = useNow();

  const tempQ = useEnsembleData(
    location.latitude,
    location.longitude,
    weekStart,
    'temperature_2m',
    location.timezone,
  );
  const rainQ = useEnsembleData(
    location.latitude,
    location.longitude,
    weekStart,
    'precipitation',
    location.timezone,
  );
  const sunQ = useEnsembleData(
    location.latitude,
    location.longitude,
    weekStart,
    'sunshine_duration',
    location.timezone,
  );
  const points = tempQ.data;
  const loading = tempQ.loading || rainQ.loading || sunQ.loading;
  const error = tempQ.error;

  const weekLabel = useWeekLabel();
  const timeZone = location.timezone;
  const fmtTime = useFmtTime(timeZone);

  const classification = useMemo(
    () => (points && points.length ? classifySpread(points, 'temperature_2m') : null),
    [points],
  );

  // EC46 weekly normals (model climatology): temperature = weekly mean; sunshine = total / 7 per
  // day. Stepped per week, so the range view shows each week's own normal.
  const tempNormals = usePointNormals(points, weeks, pickTempNormal);
  const sunNormals = usePointNormals(points, weeks, pickSunNormal);
  const hasNormal = tempNormals.some((v) => v !== null);

  const rainPoints = rainQ.data;
  const sunPoints = sunQ.data;
  const chartData = useMemo<ChartRow[]>(
    () =>
      points?.length ? buildRows(points, rainPoints, sunPoints, tempNormals, sunNormals) : [],
    [points, rainPoints, sunPoints, tempNormals, sunNormals],
  );
  const hasRain = chartData.some((r) => r.rain !== null);
  const hasSun = chartData.some((r) => r.sun !== null);

  const tempDomain = useMemo(
    () =>
      points?.length
        ? domainFor(points, tempNormals, false, 0.5)
        : ([0, 10] as [number, number]),
    [points, tempNormals],
  );
  const tempTicks = useMemo(() => {
    const [lo, hi] = tempDomain;
    // The tall range chart has room for twice as many labels as the weekly one
    const step = niceStep((hi - lo) / (range ? 8 : 4));
    const ticks: number[] = [];
    for (let v = lo; v <= hi + 1e-9; v += step) if (v >= lo + (hi - lo) / 3) ticks.push(v);
    return ticks;
  }, [tempDomain, range]);
  const rainAxis = useMemo(
    () =>
      rainPoints?.length
        ? rainAxisFor(rainPoints)
        : { domain: [0, 1] as [number, number], ticks: [0] },
    [rainPoints],
  );
  const { midnights, noons } = useDayMarks(points, timeZone);
  const { ticks: dayTicks, onResize } = useDayTicks(noons, range);
  const marks = useRangeMarks(points, weeks, range);
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
            {dayLabel(fmtTime, pt.time, range)}
          </text>
          {sun !== null && (
            <text x={x} y={y + 25} textAnchor="middle" fontSize={9} fill={SUN_COLOR}>
              {`☀ ${Math.round(sun)}h`}
            </text>
          )}
        </g>
      );
    },
    [points, chartData, fmtTime, range],
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
        <div style={{ height: chartHeight }}>
          <ResponsiveContainer width="100%" height="100%" onResize={onResize}>
            <ComposedChart
              data={chartData}
              margin={{ top: 8, right: 4, left: 4, bottom: 0 }}
              barCategoryGap={0}
            >
              <XAxis
                dataKey="i"
                type="category"
                ticks={dayTicks}
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
                <ReferenceLine
                  key={idx}
                  x={idx}
                  yAxisId="temp"
                  stroke="rgba(255,255,255,0.08)"
                />
              ))}

              {rangeDecor(marks, 'temp', chartData.length - 1, weekLabel)}

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

              {hasNormal && (
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
        </div>
      </figure>

      <ChartLegend showNormal={hasNormal} lowConfidence={marks.lowFrom !== null} />

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
