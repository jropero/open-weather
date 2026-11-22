import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DailyWeather, HourlyWeather } from '../types/weather';

import {
  getWeatherInfo,
  getThomsDiscomfortIndex,
  getPressureDeltaAlert,
  getWindChillIndex,
  getPressureDescription,
  getPressureColor,
  getMigraineRisk,
} from '../utils/weatherCodes';
import {
  ComposedChart,
  Area,
  Line,
  Bar,
  LabelList,
  ResponsiveContainer,
  YAxis,
  XAxis,
  Tooltip,
  ReferenceLine,
  ReferenceArea,
  ZIndexLayer,
  DefaultZIndexes,
  useXAxisScale,
  useYAxisScale,
  usePlotArea,
} from 'recharts';
import { precipLabels } from '../utils/chartLabels';
import type { XAxisTickContentProps } from 'recharts';
import { useLanguage } from '../hooks/useLanguage';
import { useNow } from '../hooks/useNow';

interface DailyForecastProps {
  daily: DailyWeather[];
  hourly: HourlyWeather[];
  timezone?: string;
}

// Humidity bands for the detail panel label
function getHumidityBand(humidity: number) {
  if (humidity >= 85) return { color: '#7e22ce', key: 'chart.hum_saturated' }; // Morado fuerte (saturado)
  if (humidity >= 70) return { color: '#2563eb', key: 'chart.hum_humid' }; // Azul fuerte
  if (humidity >= 50) return { color: '#34d399', key: 'chart.hum_normal' }; // Verde
  return { color: '#fbbf24', key: 'chart.hum_dry' }; // Amarillo (seco)
}

// Invisible tooltip content: forwards Recharts' active index (mouse, touch, keyboard) to the detail panel
function ActiveIndexSync({
  active,
  activeIndex,
  onChange,
}: {
  active: boolean;
  activeIndex: string | null | undefined;
  onChange: (idx: number) => void;
}) {
  useEffect(() => {
    const idx = Number(activeIndex);
    if (active && activeIndex != null && Number.isInteger(idx)) onChange(idx);
  }, [active, activeIndex, onChange]);
  return null;
}

// Selected-point marker drawn straight from the axis scales. Unlike ReferenceLine/ReferenceDot it does not
// register in the chart store, so moving it doesn't recompute the axes or re-create the series.
function SelectionMarker({ index, pressure }: { index: number; pressure: number }) {
  const xScale = useXAxisScale();
  const yScale = useYAxisScale('pressure');
  const plot = usePlotArea();
  const x = xScale?.(index, { position: 'middle' });
  const y = yScale?.(pressure);
  if (x == null || y == null || !plot) return null;
  return (
    <ZIndexLayer zIndex={DefaultZIndexes.cursorLine}>
      <g pointerEvents="none">
        <line
          x1={x}
          x2={x}
          y1={plot.y}
          y2={plot.y + plot.height}
          stroke="#ffffff"
          strokeOpacity={0.6}
          strokeWidth={1}
        />
        <circle cx={x} cy={y} r={5} fill="#f87171" stroke="#ffffff" strokeWidth={2} />
      </g>
    </ZIndexLayer>
  );
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// Stable chart props (module-level so re-renders don't hand Recharts new references)
const CHART_MARGIN = { top: 20, right: 0, left: 0, bottom: 0 };
const PERCENT_DOMAIN: [number, number] = [0, 100];
const PRECIP_DOMAIN: [number, string] = [0, 'dataMax + 15'];
const WIND_DOMAIN: [number, string] = [0, 'dataMax + 10'];
const TEMP_TICK_STYLE = { fill: '#94a3b8', fontSize: 10, fontWeight: 600 };

// Series colours (same hue family as the detail panel and hourly cards, softened like the outlook chart)
const PRESSURE_COLOR = '#f87171';
const TEMP_COLOR = '#fcd34d';
const RAIN_COLOR = '#a5b4fc';
const HUMIDITY_COLOR = '#c4b5fd';
const WIND_COLOR = '#38bdf8';
const DAY_SEPARATOR = 'rgba(255,255,255,0.08)';

// Rain amount above each bar (see precipLabels); hourly bars are too narrow to label every one
const HOURLY_LABEL_RADIUS = 2;
const PRECIP_LABEL_STYLE = {
  fill: '#c7d2fe',
  fontSize: 9,
  fontWeight: 600,
  stroke: '#0f172a',
  strokeWidth: 3,
  paintOrder: 'stroke' as const,
};

function Swatch({ kind, color }: { kind: 'line' | 'dashed' | 'bar'; color: string }) {
  if (kind === 'dashed')
    return (
      <span
        className="inline-block w-4 border-t border-dashed"
        style={{ borderColor: color }}
        aria-hidden="true"
      />
    );
  const cls = kind === 'line' ? 'w-4 h-0.5 rounded-full' : 'w-4 h-2 rounded-sm';
  return (
    <span
      className={`inline-block ${cls}`}
      style={{ backgroundColor: color, opacity: kind === 'bar' ? 0.6 : 1 }}
      aria-hidden="true"
    />
  );
}

// eslint-disable-next-line sonarjs/cognitive-complexity
export function DailyForecast({ daily, hourly, timezone }: DailyForecastProps) {
  const { language, t } = useLanguage();
  const [viewMode, setViewMode] = useState<'daily' | 'hourly'>('hourly');
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const now = useNow();
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  const todayIndex = daily.findIndex((d) => {
    const dDate = new Date(d.date);
    dDate.setHours(0, 0, 0, 0);
    return dDate.getTime() === today.getTime();
  });

  const startIndex = Math.max(0, todayIndex - 1);
  const targetDays = daily.slice(startIndex, startIndex + 7);

  // Per-day sunrise/sunset lookup for night detection in hourly view
  const sunriseSunsetByDate = Object.fromEntries(
    daily
      .filter((d) => d.sunrise && d.sunset)
      .map((d) => [
        d.date,
        {
          sunrise: new Date(d.sunrise + 'Z').getTime(),
          sunset: new Date(d.sunset + 'Z').getTime(),
        },
      ]),
  );

  // Chart data is memoized: a new array on every selection change would make Recharts re-create the
  // series elements, which re-animates them and detaches the node a touch drag started on.

  // Daily Chart Data
  const dailyChartData = useMemo(
    () =>
      daily.slice(startIndex, startIndex + 7).map((d, idx) => {
        const actualIdx = daily.findIndex((x) => x.date === d.date);
        const yesterday = actualIdx > 0 ? daily[actualIdx - 1] : d;
        const deltaP = Math.round(d.meanPressure - yesterday.meanPressure);
        const isToday = actualIdx === todayIndex;
        const todayName = language === 'en' ? 'TODAY' : 'HOY';
        const locale = language === 'es' ? 'es-ES' : 'en-US';
        const name = isToday
          ? todayName
          : new Date(d.date).toLocaleDateString(locale, { weekday: 'short' });

        return {
          idx,
          isToday,
          isPast: todayIndex >= 0 && actualIdx < todayIndex,
          name,
          pressure: Math.round(d.meanPressure),
          temp: Math.round((d.maxTemp + d.minTemp) / 2),
          humidity: Math.round(d.humidity),
          wind: Math.round(d.windSpeed),
          precip: d.precipitation,
          weatherCode: d.weatherCode,
          deltaP,
        };
      }),
    [daily, startIndex, todayIndex, language],
  );

  // Hourly Chart Data
  const locale = language === 'es' ? 'es-ES' : 'en-US';
  const timeFormatOpts = useMemo<Intl.DateTimeFormatOptions>(
    () => ({
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      ...(timezone ? { timeZone: timezone } : {}),
    }),
    [timezone],
  );

  const hourlyChartData = useMemo(
    () =>
      hourly.map((h, idx) => {
        const dayFormatOpts = (weekday: 'short' | 'long'): Intl.DateTimeFormatOptions => ({
          weekday,
          ...(timezone ? { timeZone: timezone } : {}),
        });
        const timeDate = new Date(h.time + 'Z');
        const hourStr = timeDate.toLocaleTimeString(locale, timeFormatOpts);
        return {
          idx,
          hour: parseInt(hourStr.slice(0, 2), 10) % 24,
          dayShort: timeDate.toLocaleDateString(locale, dayFormatOpts('short')),
          dayLong: timeDate.toLocaleDateString(locale, dayFormatOpts('long')),
          name: hourStr,
          pressure: Math.round(h.pressure),
          temp: Math.round(h.temperature),
          humidity: Math.round(h.humidity),
          wind: Math.round(h.windSpeed),
          precip: h.precipitation,
          precipProb: h.precipProbability,
          weatherCode: h.weatherCode,
          deltaP: 0,
        };
      }),
    [hourly, locale, timeFormatOpts, timezone],
  );

  // Fields shared by both views (what the chart and the detail panel read)
  type ChartPoint = {
    idx: number;
    name: string;
    pressure: number;
    temp: number;
    humidity: number;
    wind: number;
    precip: number;
    weatherCode: number;
    deltaP: number;
  };
  const chartData: ChartPoint[] = viewMode === 'daily' ? dailyChartData : hourlyChartData;

  // Same points plus the rain label string per bar ('' = none). Memoized like chartData.
  const labeledChartData = useMemo(() => {
    const labels = precipLabels(
      chartData.map((d) => d.precip),
      viewMode === 'daily' ? 0 : HOURLY_LABEL_RADIUS,
    );
    return chartData.map((d, i) => ({ ...d, precipLabel: labels[i] }));
  }, [chartData, viewMode]);

  // Axis domains and ticks are memoized too (new arrays would also re-create the series, see above)
  const { pressureDomain, tempDomain, tempTicks } = useMemo(() => {
    const minPressure = Math.min(...chartData.map((d) => d.pressure)) - 5;
    const maxPressure = Math.max(...chartData.map((d) => d.pressure)) + 5;
    const minTemp = Math.min(...chartData.map((d) => d.temp)) - 5;
    const maxTemp = Math.max(...chartData.map((d) => d.temp)) + 5;

    // Temperature axis (the visible one): round ticks inside the padded domain, unit on the top tick.
    // Pressure keeps its own hidden axis; the 1013 hPa reference line carries its unit.
    const tempStep = maxTemp - minTemp > 30 ? 10 : 5;
    const ticks: number[] = [];
    for (let v = Math.ceil(minTemp / tempStep) * tempStep; v <= maxTemp; v += tempStep)
      ticks.push(v);

    return {
      pressureDomain: [minPressure, maxPressure],
      tempDomain: [minTemp, maxTemp],
      tempTicks: ticks,
    };
  }, [chartData]);

  const isEn = language === 'en';

  // X axis: every day in daily view; every 3 h in hourly view, with the weekday at midnight
  const nowHourIdx = 0; // useWeather starts the hourly window at the current hour
  const todayChartIdx = Math.max(
    0,
    dailyChartData.findIndex((d) => d.isToday),
  );
  const pastCount = dailyChartData.filter((d) => d.isPast).length;
  const midnightIdxs = useMemo(
    () => hourlyChartData.filter((h) => h.hour === 0 && h.idx !== nowHourIdx).map((h) => h.idx),
    [hourlyChartData, nowHourIdx],
  );
  const xTicks = useMemo(
    () =>
      viewMode === 'daily'
        ? dailyChartData.map((d) => d.idx)
        : hourlyChartData
            .filter(
              (h) =>
                h.idx === nowHourIdx || (h.hour % 3 === 0 && Math.abs(h.idx - nowHourIdx) > 2),
            )
            .map((h) => h.idx),
    [viewMode, dailyChartData, hourlyChartData],
  );

  // Selected point (defaults to now / today); reset when switching views
  const defaultIdx = viewMode === 'daily' ? todayChartIdx : nowHourIdx;
  const activeIdx = Math.min(chartData.length - 1, selectedIdx ?? defaultIdx);
  const isDefaultSelection = activeIdx === defaultIdx;
  const switchView = (mode: 'daily' | 'hourly') => {
    setViewMode(mode);
    setSelectedIdx(null);
  };

  const renderXTick = useCallback(
    // eslint-disable-next-line sonarjs/cognitive-complexity
    ({ x: rawX, y: rawY, payload }: XAxisTickContentProps) => {
      const x = Number(rawX);
      const y = Number(rawY);
      const idx = Number(payload.value);
      if (viewMode === 'daily') {
        const d = dailyChartData[idx];
        if (!d) return <g />;
        const fill = d.isToday ? '#ffffff' : '#94a3b8';
        return (
          <text
            x={x}
            y={y + 13}
            textAnchor="middle"
            fontSize={10}
            fontWeight={d.isToday ? 800 : 600}
            fill={fill}
            letterSpacing={d.isToday ? 1 : 0}
          >
            {d.isToday ? d.name : capitalize(d.name)}
          </text>
        );
      }
      const h = hourlyChartData[idx];
      if (!h) return <g />;
      const isNow = idx === nowHourIdx;
      const isMidnight = h.hour === 0 && !isNow;
      const isLast = idx === hourlyChartData.length - 1;
      const anchorFallback = isLast ? 'end' : 'middle';
      const anchor = idx === nowHourIdx && idx === 0 ? 'start' : anchorFallback;
      const hourLabel = isMidnight
        ? capitalize(h.dayShort)
        : `${String(h.hour).padStart(2, '0')}h`;
      const tickLabel = isNow ? t('chart.now') : hourLabel;
      return (
        <text
          x={x}
          y={y + 13}
          textAnchor={anchor}
          fontSize={10}
          fontWeight={isNow || isMidnight ? 800 : 600}
          fill={isNow || isMidnight ? '#e2e8f0' : '#94a3b8'}
        >
          {tickLabel}
        </text>
      );
    },
    [viewMode, dailyChartData, hourlyChartData, t],
  );

  // Everything inside the chart except the selection marker. Memoized as one element so a selection
  // change doesn't re-render the axes/series: Recharts re-registers any axis or reference element whose
  // props change by reference, which recomputes the scales and re-creates (and re-animates) the series.
  const chartLayers = useMemo(
    () => (
      <>
        <defs>
          <linearGradient id="colorPressure" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={PRESSURE_COLOR} stopOpacity={0.18} />
            <stop offset="100%" stopColor={PRESSURE_COLOR} stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="idx"
          ticks={xTicks}
          interval={0}
          tick={renderXTick}
          height={24}
          axisLine={false}
          tickLine={false}
        />

        <YAxis yAxisId="pressure" hide domain={pressureDomain} />
        <YAxis
          yAxisId="temp"
          orientation="right"
          mirror
          domain={tempDomain}
          ticks={tempTicks}
          tickFormatter={(v: number, i: number) =>
            i === tempTicks.length - 1 ? `${v}${String.fromCharCode(160)}°C` : `${v}°`
          }
          tick={TEMP_TICK_STYLE}
          axisLine={false}
          tickLine={false}
        />
        <YAxis yAxisId="humidity" hide domain={PERCENT_DOMAIN} />
        <YAxis yAxisId="precip" hide domain={PRECIP_DOMAIN} />
        <YAxis yAxisId="wind" hide domain={WIND_DOMAIN} />

        {/* Tap / drag / hover only drives the detail panel above — no floating box */}
        <Tooltip
          cursor={false}
          isAnimationActive={false}
          content={({ active, activeIndex }) => (
            <ActiveIndexSync
              active={active}
              activeIndex={activeIndex}
              onChange={setSelectedIdx}
            />
          )}
        />

        {/* Past days (daily view) */}
        {viewMode === 'daily' && pastCount > 0 && (
          <ReferenceArea
            yAxisId="humidity"
            x1={0}
            x2={pastCount - 1}
            fill="#ffffff"
            fillOpacity={0.05}
            stroke="none"
            label={{
              value: t('chart.past'),
              position: 'insideTopLeft',
              fill: '#94a3b8',
              fontSize: 9,
              fontWeight: 700,
            }}
          />
        )}

        {/* Day separators + "now" (hourly view only) */}
        {viewMode === 'hourly' &&
          midnightIdxs.map((idx) => (
            <ReferenceLine key={idx} x={idx} yAxisId="humidity" stroke={DAY_SEPARATOR} />
          ))}
        {viewMode === 'hourly' && (
          <ReferenceLine
            x={nowHourIdx}
            yAxisId="humidity"
            stroke="rgba(255,255,255,0.45)"
            strokeDasharray="2 3"
          />
        )}

        {/* Standard atmosphere reference (hidden automatically when outside the domain) */}
        <ReferenceLine
          yAxisId="pressure"
          y={1013}
          stroke="#e2e8f0"
          strokeWidth={1.25}
          strokeDasharray="5 4"
          label={{
            value: `1013 hPa ${t('chart.normal')}`,
            position: 'insideBottomLeft',
            fill: '#e2e8f0',
            fontSize: 9,
            fontWeight: 600,
          }}
        />

        {/* Precipitación: columnas cuadradas */}
        <Bar
          yAxisId="precip"
          dataKey="precip"
          fill={RAIN_COLOR}
          fillOpacity={0.6}
          isAnimationActive={false}
          activeBar={false}
        >
          <LabelList
            dataKey="precipLabel"
            position="top"
            offset={3}
            style={PRECIP_LABEL_STYLE}
          />
        </Bar>

        {/* Presión: línea roja con relleno tenue */}
        <Area
          yAxisId="pressure"
          type="monotone"
          dataKey="pressure"
          stroke={PRESSURE_COLOR}
          strokeWidth={2}
          fillOpacity={1}
          fill="url(#colorPressure)"
          dot={false}
          activeDot={false}
          isAnimationActive={false}
        />
        {/* Humedad: línea violeta fina (eje oculto 0–100 %) */}
        <Line
          yAxisId="humidity"
          type="monotone"
          dataKey="humidity"
          stroke={HUMIDITY_COLOR}
          strokeWidth={1.25}
          dot={false}
          activeDot={false}
          isAnimationActive={false}
        />
        {/* Viento: línea discontinua fina */}
        <Line
          yAxisId="wind"
          type="monotone"
          dataKey="wind"
          stroke={WIND_COLOR}
          strokeWidth={1.25}
          strokeDasharray="5 3"
          dot={false}
          activeDot={false}
          isAnimationActive={false}
        />
        {/* Temperatura: línea amarilla */}
        <Line
          yAxisId="temp"
          type="monotone"
          dataKey="temp"
          stroke={TEMP_COLOR}
          strokeWidth={2}
          dot={false}
          activeDot={false}
          isAnimationActive={false}
        />
      </>
    ),
    [
      xTicks,
      renderXTick,
      pressureDomain,
      tempDomain,
      tempTicks,
      viewMode,
      pastCount,
      midnightIdxs,
      t,
    ],
  );

  const chartKeys = [
    { color: PRESSURE_COLOR, label: t('label.pressure'), unit: 'hPa' },
    { color: TEMP_COLOR, label: t('label.temperature'), unit: '°C' },
    { color: RAIN_COLOR, label: t('label.rain'), unit: 'mm' },
    { color: HUMIDITY_COLOR, label: t('label.humidity'), unit: '%' },
    { color: WIND_COLOR, label: t('label.wind'), unit: 'km/h' },
  ];

  // Detail panel content for the selected point
  const sel = chartData[activeIdx];
  const selHourly = viewMode === 'hourly' ? hourly[activeIdx] : undefined;
  const selDaily = viewMode === 'daily' ? targetDays[activeIdx] : undefined;
  const selDailyPoint = viewMode === 'daily' ? dailyChartData[activeIdx] : undefined;
  const selTemp = selHourly ? selHourly.temperature : (sel?.temp ?? 0);
  const selWind = selHourly ? selHourly.windSpeed : (sel?.wind ?? 0);
  const selHumidity = selHourly ? selHourly.humidity : (sel?.humidity ?? 0);
  const selComfort =
    sel &&
    (selTemp < 10
      ? getWindChillIndex(selTemp, selWind, language)
      : getThomsDiscomfortIndex(selTemp, selHumidity, language));
  const selHumidityBand = getHumidityBand(sel?.humidity ?? 0);
  const selDeltaAlert =
    sel && viewMode === 'daily' ? getPressureDeltaAlert(sel.deltaP, language) : undefined;
  const selMigraine =
    selDaily && sel
      ? getMigraineRisk(
          sel.deltaP,
          selDaily.meanPressure,
          selDaily.humidity,
          selDaily.precipitation,
          language,
        )
      : undefined;
  // Hourly trend: change vs. the current hour; at "now", the change over the whole 24 h window
  const nowPressure = hourlyChartData[nowHourIdx]?.pressure ?? 0;
  const lastPressure = hourlyChartData[hourlyChartData.length - 1]?.pressure ?? 0;
  const hourlyDelta =
    activeIdx === nowHourIdx ? lastPressure - nowPressure : (sel?.pressure ?? 0) - nowPressure;
  const trendDown = hourlyDelta < 0 ? '↓' : '→';
  const trendArrow = hourlyDelta > 0 ? '↑' : trendDown;
  const hourlyPoint = hourlyChartData[activeIdx];
  const dailyHeader = selDaily
    ? capitalize(
        new Date(selDaily.date).toLocaleDateString(locale, {
          weekday: 'long',
          day: 'numeric',
          month: 'short',
        }),
      )
    : '';
  const hourlyHeader = hourlyPoint
    ? `${capitalize(hourlyPoint.dayLong)} ${hourlyPoint.name}`
    : '';
  const selHeader = viewMode === 'daily' ? dailyHeader : hourlyHeader;
  const pastOrForecast = selDailyPoint?.isPast ? t('chart.past') : t('chart.forecast');
  const dailyStatus = selDailyPoint?.isToday ? t('label.today') : pastOrForecast;
  const hourlyStatus = activeIdx === nowHourIdx ? t('chart.now') : null;
  const selStatus = viewMode === 'daily' ? dailyStatus : hourlyStatus;

  const hourlyTitle = isEn ? '24-Hour Forecast' : 'Pronóstico por Horas';
  const sectionTitle = viewMode === 'daily' ? t('title.daily_forecast') : hourlyTitle;

  return (
    <section className="bg-slate-900/60 backdrop-blur-md rounded-3xl py-5 px-0.5 sm:p-6 shadow-xl mt-4 overflow-hidden text-white border border-slate-700/50">
      {/* Title & View Switcher */}
      <div className="flex justify-between items-center mb-6 px-4">
        <h3 className="text-sm uppercase tracking-wider opacity-90 font-semibold">
          {sectionTitle}
        </h3>

        <div className="bg-white/10 p-0.5 rounded-full flex gap-1 border border-white/5 backdrop-blur-md">
          <button
            onClick={() => switchView('daily')}
            className={`px-3.5 py-1 rounded-full text-xs font-bold transition-all duration-300 ${viewMode === 'daily' ? 'bg-white text-slate-900 shadow-md' : 'text-white hover:bg-white/5'}`}
          >
            {isEn ? 'Daily' : 'Diario'}
          </button>
          <button
            onClick={() => switchView('hourly')}
            className={`px-3.5 py-1 rounded-full text-xs font-bold transition-all duration-300 ${viewMode === 'hourly' ? 'bg-white text-slate-900 shadow-md' : 'text-white hover:bg-white/5'}`}
          >
            {isEn ? 'Hourly' : 'Por Horas'}
          </button>
        </div>
      </div>

      {/* Top row: Daily (Columns) vs Hourly (Scrollable list) */}
      {viewMode === 'daily' ? (
        <div className="flex justify-between w-full px-0 mb-2">
          {chartData.map((d, idx) => {
            const { icon: Icon, label } = getWeatherInfo(d.weatherCode, language);
            const comfort =
              d.temp < 10
                ? getWindChillIndex(d.temp, d.wind, language)
                : getThomsDiscomfortIndex(d.temp, d.humidity, language);
            const deltaAlert = getPressureDeltaAlert(d.deltaP, language);

            return (
              <div key={idx} className="flex flex-col items-center flex-1 px-0.5">
                <div title={label}>
                  <Icon size={22} className="text-white drop-shadow-md mb-2" />
                </div>
                <span
                  className="text-[10px] font-bold text-red-400 drop-shadow-md leading-tight whitespace-nowrap"
                  title={`${t('label.pressure')} (hPa)`}
                >
                  {d.pressure} hPa
                </span>
                <span
                  className="text-[10px] font-bold text-amber-300 drop-shadow-md leading-tight whitespace-nowrap"
                  title={`${t('label.temp')} (°C)`}
                >
                  {d.temp}°C
                </span>
                <span
                  className="text-[10px] font-bold text-sky-300 drop-shadow-md leading-tight whitespace-nowrap"
                  title={`${t('label.humidity')} (%)`}
                >
                  {d.humidity}%
                </span>
                <span
                  className="text-[10px] font-bold text-teal-300 drop-shadow-md leading-tight whitespace-nowrap"
                  title={`${t('label.wind')} (km/h)`}
                >
                  {d.wind} km/h
                </span>
                <span
                  className="text-[10px] font-bold text-indigo-300 drop-shadow-md leading-tight whitespace-nowrap"
                  title={`${t('label.rain')} (mm)`}
                >
                  {d.precip} mm
                </span>

                {/* Índice de Incomodidad de Thom / Wind Chill */}
                <div
                  className={`mt-1.5 px-1 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${comfort.bgClass} ${comfort.bgClass.includes('text-white') ? '' : 'text-slate-900'} shadow-sm text-center leading-none`}
                  title={`${t('label.fatigue_calc')}: ${comfort.label}`}
                >
                  {comfort.shortLabel}
                </div>

                {/* Alerta Delta P */}
                <div
                  className={`mt-1 px-0.5 py-0.5 rounded text-[7px] font-bold uppercase tracking-wider ${deltaAlert.bgClass} shadow-sm text-center leading-tight flex flex-col`}
                  title={`Variación de presión en 24h: ${deltaAlert.detail}`}
                >
                  <span>{deltaAlert.label}</span>
                  <span className="opacity-90">{deltaAlert.detail}</span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex overflow-x-auto gap-3 pb-3 pt-1 px-4 scrollbar-thin scrollbar-thumb-white/15 scrollbar-track-transparent select-none scroll-smooth">
          {hourly.map((h, idx) => {
            const timeDate = new Date(h.time + 'Z');
            const hourStr = timeDate.toLocaleTimeString(locale, timeFormatOpts);
            const dayKey = h.time.slice(0, 10);
            const ss = sunriseSunsetByDate[dayKey];
            const isNightHour = ss
              ? timeDate.getTime() < ss.sunrise || timeDate.getTime() > ss.sunset
              : false;
            const { icon: Icon, label } = getWeatherInfo(h.weatherCode, language, isNightHour);
            const comfort =
              h.temperature < 10
                ? getWindChillIndex(h.temperature, h.windSpeed, language)
                : getThomsDiscomfortIndex(h.temperature, h.humidity, language);
            const precipFallback =
              h.precipProbability > 0 ? (
                <span className="text-[9px] font-bold text-violet-300 mt-0.5">
                  {h.precipProbability}%
                </span>
              ) : (
                <span className="text-[9px] font-bold opacity-0 mt-0.5">-</span>
              );
            const precipBadge =
              h.snowfall > 0 ? (
                <span className="text-[9px] font-bold text-cyan-200 mt-0.5">
                  ❄️ {h.snowfall.toFixed(1)}mm
                </span>
              ) : (
                precipFallback
              );

            return (
              <div
                key={idx}
                className="flex flex-col items-center min-w-[72px] bg-white/5 border border-white/5 rounded-2xl p-2.5 shadow-md hover:bg-white/10 transition-all duration-300"
                title={label}
              >
                <span className="text-[10px] font-bold opacity-75 mb-1.5">{hourStr}</span>
                <Icon size={24} className="text-white drop-shadow-sm mb-2" />
                <span className="text-sm font-black text-amber-300 leading-none mb-0.5 whitespace-nowrap">
                  {Math.round(h.temperature)}°
                  {Math.abs(h.apparentTemperature - h.temperature) >= 1 && (
                    <span className="text-[10px] font-semibold text-amber-200/60 ml-0.5">
                      ({Math.round(h.apparentTemperature)}°)
                    </span>
                  )}
                </span>
                <span className="text-[9px] font-bold text-sky-300 mt-0.5">
                  {Math.round(h.humidity)}%
                </span>
                <span className="text-[9px] font-bold text-teal-300">
                  {Math.round(h.windSpeed)} km/h
                </span>
                {precipBadge}

                <div
                  className={`mt-2 px-1 py-0.5 rounded text-[7px] font-black uppercase tracking-wider ${comfort.bgClass} ${comfort.bgClass.includes('text-white') ? '' : 'text-slate-900'} scale-95 shadow-sm text-center leading-none`}
                  title={`${t('label.fatigue_calc')}: ${comfort.label}`}
                >
                  {comfort.shortLabel}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Detail panel for the selected chart point (sits above the chart so the finger never covers it) */}
      {sel && (
        <div
          className="mx-3 sm:mx-0 mt-3 bg-white/5 border border-white/10 rounded-2xl px-3 py-2.5 shadow-md"
          aria-live="polite"
        >
          <div className="flex items-center justify-between gap-2 mb-1.5 h-6">
            <span className="text-[13px] font-bold text-white truncate">{selHeader}</span>
            {isDefaultSelection ? (
              selStatus && (
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-900 bg-white/90 rounded-full px-2 py-0.5 flex-shrink-0">
                  {selStatus}
                </span>
              )
            ) : (
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {selStatus && (
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-300">
                    {selStatus}
                  </span>
                )}
                <button
                  onClick={() => setSelectedIdx(null)}
                  className="text-[11px] font-bold text-white bg-white/10 hover:bg-white/20 border border-white/10 rounded-full px-2.5 py-0.5 transition-colors"
                >
                  {viewMode === 'daily' ? t('chart.back_to_today') : t('chart.back_to_now')}
                </button>
              </div>
            )}
          </div>

          {/* Pressure: the headline value for migraine risk */}
          <div className="flex items-center gap-3 mb-2">
            <div className="flex items-baseline gap-1 flex-shrink-0">
              <span className="w-2.5 h-2.5 rounded-full bg-[#f87171] self-center mr-0.5"></span>
              <span className="text-2xl font-black text-red-300 leading-none">
                {sel.pressure}
              </span>
              <span className="text-xs font-bold text-red-300/80">hPa</span>
            </div>
            {/* min height = two chip rows, so the panel (and the chart below it) doesn't jump while scrubbing */}
            <div className="flex flex-wrap items-center content-center gap-1.5 min-w-0 min-h-[42px]">
              <span
                className={`text-[10px] font-bold uppercase tracking-wide rounded px-1.5 py-0.5 ${getPressureColor(sel.pressure)}`}
              >
                {getPressureDescription(sel.pressure, language)}
              </span>
              {selDeltaAlert ? (
                <span
                  className={`text-[10px] font-bold tracking-wide rounded px-1.5 py-0.5 ${selDeltaAlert.bgClass}`}
                  title={t('chart.vs_prev_day')}
                >
                  {selDeltaAlert.label} {selDeltaAlert.detail}
                </span>
              ) : (
                <span className="text-[11px] font-bold text-slate-200">
                  {trendArrow} {hourlyDelta > 0 ? '+' : ''}
                  {hourlyDelta} hPa{' '}
                  <span className="font-medium text-slate-400">
                    {activeIdx === nowHourIdx ? t('chart.next_24h') : t('chart.vs_now')}
                  </span>
                </span>
              )}
              {selMigraine && (
                <span
                  className={`text-[10px] font-bold uppercase tracking-wide rounded px-1.5 py-0.5 ${selMigraine.bgClass}`}
                  title={selMigraine.detail}
                >
                  🧠 {selMigraine.label} · {selMigraine.score}/6
                </span>
              )}
            </div>
          </div>

          {/* Other series, each with the swatch used in the chart */}
          <div className="grid grid-cols-4 gap-1.5">
            <div className="flex flex-col min-w-0">
              <span className="flex items-center gap-1 text-[10px] text-slate-400">
                <span className="w-2.5 h-1 rounded-full bg-[#fcd34d] flex-shrink-0"></span>
                {t('label.temp')}
              </span>
              <span className="text-sm font-black text-amber-300 leading-tight">
                {Math.round(selTemp)}°C
              </span>
              {selComfort && (
                <span
                  className={`self-start mt-0.5 px-1 py-px rounded text-[9px] font-bold uppercase tracking-wider leading-none ${selComfort.bgClass} ${selComfort.bgClass.includes('text-white') ? '' : 'text-slate-900'}`}
                  title={`${t('label.fatigue_calc')}: ${selComfort.label}`}
                >
                  {selComfort.shortLabel}
                </span>
              )}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="flex items-center gap-1 text-[10px] text-slate-400">
                <span
                  className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: selHumidityBand.color }}
                ></span>
                {t('label.humidity')}
              </span>
              <span className="text-sm font-black text-white leading-tight">
                {sel.humidity}%
              </span>
              <span className="text-[10px] font-semibold text-slate-300 leading-tight">
                {t(selHumidityBand.key)}
              </span>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="flex items-center gap-1 text-[10px] text-slate-400">
                <span className="w-2.5 h-px border-t-2 border-dashed border-[#38bdf8] flex-shrink-0"></span>
                {t('label.wind')}
              </span>
              <span className="text-sm font-black text-[#38bdf8] leading-tight whitespace-nowrap">
                {sel.wind} <span className="text-[10px] font-bold">km/h</span>
              </span>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="flex items-center gap-1 text-[10px] text-slate-400">
                <span className="w-2.5 h-2.5 rounded-sm bg-[#a5b4fc]/60 flex-shrink-0"></span>
                {t('label.rain')}
              </span>
              <span className="text-sm font-black text-indigo-300 leading-tight whitespace-nowrap">
                {sel.precip} <span className="text-[10px] font-bold">mm</span>
              </span>
              {selHourly && selHourly.precipProbability > 0 && (
                <span className="text-[10px] font-semibold text-violet-300 leading-tight">
                  🌂 {selHourly.precipProbability}%
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Multi-Line Composed Chart (same card style as the long-range ensemble chart) */}
      <figure className="mt-3 mx-3 rounded-2xl bg-slate-900/80 border border-white/10 overflow-hidden">
        <figcaption className="flex flex-wrap items-center gap-x-3 gap-y-0.5 px-3 pt-2 pb-0 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
          {chartKeys.map((k) => (
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
        <div className="w-full h-[184px] overflow-hidden touch-pan-y">
          <ResponsiveContainer width="100%" height="100%">
            {/* Keyed by view so the tooltip index from one view doesn't carry over into the other */}
            <ComposedChart
              key={viewMode}
              data={labeledChartData}
              margin={CHART_MARGIN}
              barCategoryGap={2}
            >
              {chartLayers}

              {/* Selected point marker (persists after the finger lifts) */}
              {sel && <SelectionMarker index={activeIdx} pressure={sel.pressure} />}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </figure>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 mt-2 text-[10px] text-slate-400">
        <span className="flex items-center gap-1">
          <Swatch kind="line" color={PRESSURE_COLOR} />
          <span>{t('label.pressure')}</span>
        </span>
        <span className="flex items-center gap-1">
          <Swatch kind="line" color={TEMP_COLOR} />
          <span>{t('label.temperature')}</span>
        </span>
        <span className="flex items-center gap-1">
          <Swatch kind="bar" color={RAIN_COLOR} />
          <span>{t('label.rain')}</span>
        </span>
        <span className="flex items-center gap-1">
          <Swatch kind="line" color={HUMIDITY_COLOR} />
          <span>{t('label.humidity')}</span>
        </span>
        <span className="flex items-center gap-1">
          <Swatch kind="dashed" color={WIND_COLOR} />
          <span>{t('label.wind')}</span>
        </span>
        <span className="flex items-center gap-1">
          <Swatch kind="dashed" color="#e2e8f0" />
          <span>1013 hPa {t('chart.normal')}</span>
        </span>
      </div>
      <p className="px-4 mt-1.5 text-[10px] text-slate-500">{t('chart.hint')}</p>
    </section>
  );
}
