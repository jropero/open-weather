import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X, Wind, Gauge, Thermometer, CloudRain } from 'lucide-react';
import {
  ComposedChart, Line, XAxis, YAxis, ReferenceLine, ResponsiveContainer,
  ZIndexLayer, useXAxisScale, useYAxisScale,
} from 'recharts';
import type { XAxisTickContentProps } from 'recharts';
import type { Location, SeasonalPeriod, SeasonalVariable } from '../types/weather';
import { useLanguage } from '../hooks/useLanguage';
import { useEnsembleData } from '../hooks/useEnsembleData';
import { classifySpread, type EnsemblePoint, type EnsembleVar } from '../utils/ensembleStats';

// Map seasonal variable → closest ensemble variable
const SEASONAL_TO_ENSEMBLE: Record<SeasonalVariable, EnsembleVar> = {
  temperature: 'temperature_2m',
  precipitation: 'precipitation',
  pressure: 'pressure_msl',
  sunshine: 'temperature_2m',
  snowfall: 'precipitation',
};

interface EnsembleVarMeta {
  key: EnsembleVar;
  labelEs: string;
  labelEn: string;
  unit: string;
  color: string; // spaghetti / mean line color
}

const VARS: EnsembleVarMeta[] = [
  { key: 'temperature_2m', labelEs: 'Temperatura', labelEn: 'Temperature', unit: '°C',   color: '#fca5a5' },
  { key: 'precipitation',  labelEs: 'Precipitación', labelEn: 'Precipitation', unit: 'mm', color: '#7dd3fc' },
  { key: 'pressure_msl',   labelEs: 'Presión',      labelEn: 'Pressure',  unit: 'hPa',  color: '#c084fc' },
  { key: 'wind_speed_10m', labelEs: 'Viento',       labelEn: 'Wind',      unit: 'km/h', color: '#6ee7b7' },
];

const VAR_ICONS = {
  temperature_2m: Thermometer,
  precipitation:  CloudRain,
  pressure_msl:   Gauge,
  wind_speed_10m: Wind,
};

interface Props {
  location: Location;
  period: SeasonalPeriod;
  weekIndex: number; // 0-based (0 = "Semana 1")
  initialVariable: SeasonalVariable;
  lowConfidence: boolean;
  onClose: () => void;
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// --- Custom chart layers ---

function SpaghettiLayer({ points, color }: { points: EnsemblePoint[]; color: string }) {
  const xScale = useXAxisScale();
  const yScale = useYAxisScale('main');

  const paths = useMemo(() => {
    if (!xScale || !yScale || !points.length) return [];
    const n = points[0].members.length;
    const result: string[] = [];
    for (let m = 0; m < n; m++) {
      let d = '';
      for (let i = 0; i < points.length; i++) {
        const val = points[i].members[m];
        if (val == null) continue;
        const x = xScale(i, { position: 'middle' });
        const y = yScale(val);
        if (x == null || y == null) continue;
        d += `${d === '' ? 'M' : 'L'} ${(x as number).toFixed(1)} ${(y as number).toFixed(1)} `;
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
          <path key={i} d={d} fill="none" stroke={color} strokeWidth={1} strokeOpacity={0.09} />
        ))}
      </g>
    </ZIndexLayer>
  );
}

function BandLayer({
  points, getLow, getHigh, fill, opacity, zIndex,
}: {
  points: EnsemblePoint[];
  getLow: (p: EnsemblePoint) => number;
  getHigh: (p: EnsemblePoint) => number;
  fill: string;
  opacity: number;
  zIndex: number;
}) {
  const xScale = useXAxisScale();
  const yScale = useYAxisScale('main');

  const d = useMemo(() => {
    if (!xScale || !yScale || !points.length) return '';
    let path = '';
    // Top edge left→right
    for (let i = 0; i < points.length; i++) {
      const x = xScale(i, { position: 'middle' });
      const y = yScale(getHigh(points[i]));
      if (x == null || y == null) continue;
      path += `${i === 0 ? 'M' : 'L'} ${(x as number).toFixed(1)} ${(y as number).toFixed(1)} `;
    }
    // Bottom edge right→left
    for (let i = points.length - 1; i >= 0; i--) {
      const x = xScale(i, { position: 'middle' });
      const y = yScale(getLow(points[i]));
      if (x == null || y == null) continue;
      path += `L ${(x as number).toFixed(1)} ${(y as number).toFixed(1)} `;
    }
    return path + 'Z';
  }, [points, getLow, getHigh, xScale, yScale]);

  if (!d) return null;
  return (
    <ZIndexLayer zIndex={zIndex}>
      <path d={d} fill={fill} fillOpacity={opacity} stroke="none" pointerEvents="none" />
    </ZIndexLayer>
  );
}

// ---

export function EnsembleDetailView({ location, period, weekIndex, initialVariable, lowConfidence, onClose }: Props) {
  const { language, t } = useLanguage();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [variable, setVariable] = useState<EnsembleVar>(SEASONAL_TO_ENSEMBLE[initialVariable]);

  const { data: points, loading, error } = useEnsembleData(
    location.latitude, location.longitude, period.start, variable
  );

  useEffect(() => {
    const el = dialogRef.current;
    if (el && !el.open) el.showModal();
  }, []);

  const varMeta = VARS.find(v => v.key === variable)!;
  const locale = language === 'en' ? 'en-GB' : 'es-ES';

  const fmt = (d: string, opts: Intl.DateTimeFormatOptions) =>
    new Date(`${d}T00:00:00Z`).toLocaleDateString(locale, { ...opts, timeZone: 'UTC' });

  const weekLabel = `${t('ensemble.week')} ${weekIndex + 1}: ${fmt(period.start, { day: 'numeric' })}–${fmt(period.end, { day: 'numeric', month: 'short' })}`;

  const classification = useMemo(
    () => (points && points.length ? classifySpread(points, variable) : null),
    [points, variable]
  );

  // Chart data (just index + mean for Recharts' built-in Line)
  const chartData = useMemo(
    () => (points ?? []).map((pt, i) => ({ i, mean: pt.mean })),
    [points]
  );

  // Y-axis domain
  const { yDomain, midnightIndices, xTicks } = useMemo(() => {
    if (!points || !points.length) return { yDomain: [0, 10] as [number, number], midnightIndices: [], xTicks: [] };
    const nonNegative = variable === 'precipitation' || variable === 'wind_speed_10m';
    const allVals = points.flatMap(p => [p.p10, p.p90]);
    const lo = nonNegative ? 0 : Math.floor(Math.min(...allVals)) - 1;
    const hi = Math.ceil(Math.max(...allVals)) + 1;
    const midnights: number[] = [];
    points.forEach((pt, i) => {
      if (new Date(pt.time).getUTCHours() === 0) midnights.push(i);
    });
    return { yDomain: [lo, hi] as [number, number], midnightIndices: midnights, xTicks: midnights };
  }, [points]);

  const renderXTick = useCallback(({ x: rawX, y: rawY, payload }: XAxisTickContentProps) => {
    const idx = Number(payload.value);
    const pt = points?.[idx];
    if (!pt) return <g />;
    const dayName = new Date(pt.time).toLocaleDateString(locale, { weekday: 'short', timeZone: 'UTC' });
    return (
      <text x={Number(rawX)} y={Number(rawY) + 13} textAnchor="middle" fontSize={10} fill="#94a3b8">
        {capitalize(dayName)}
      </text>
    );
  }, [points, locale]);

  const spreadBadge = () => {
    if (!classification) return null;
    const configs = {
      agree:    { text: t('ensemble.spread.agree'),    bg: 'bg-emerald-800/60 text-emerald-200', icon: '✓' },
      disagree: { text: t('ensemble.spread.disagree'), bg: 'bg-amber-800/60 text-amber-200',     icon: '⚡' },
      bimodal:  { text: t('ensemble.spread.bimodal'),  bg: 'bg-violet-800/60 text-violet-200',   icon: '⑂' },
    };
    const cfg = configs[classification.label];
    return (
      <div className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold ${cfg.bg}`}>
        <span className="text-base leading-none">{cfg.icon}</span>
        <span>{cfg.text}</span>
      </div>
    );
  };

  // Stable accessors to avoid BandLayer memo churn
  const getP10 = useCallback((p: EnsemblePoint) => p.p10, []);
  const getP25 = useCallback((p: EnsemblePoint) => p.p25, []);
  const getP75 = useCallback((p: EnsemblePoint) => p.p75, []);
  const getP90 = useCallback((p: EnsemblePoint) => p.p90, []);

  const chartLayers = useMemo(() => {
    if (!points || !points.length) return null;
    return (
      <>
        <XAxis
          dataKey="i"
          ticks={xTicks}
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
          tickFormatter={(v: number) => {
            if (variable === 'precipitation' || variable === 'wind_speed_10m') return String(Math.round(v));
            return v % 1 === 0 ? String(v) : v.toFixed(1);
          }}
          tick={{ fill: '#64748b', fontSize: 10, fontWeight: 600 }}
          axisLine={false}
          tickLine={false}
          width={40}
        />

        {midnightIndices.map(idx => (
          <ReferenceLine key={idx} x={idx} yAxisId="main" stroke="rgba(255,255,255,0.08)" />
        ))}

        {/* Spaghetti — back layer */}
        <SpaghettiLayer points={points} color={varMeta.color} />

        {/* p10–p90 band */}
        <BandLayer points={points} getLow={getP10} getHigh={getP90} fill={varMeta.color} opacity={0.10} zIndex={2} />

        {/* p25–p75 band */}
        <BandLayer points={points} getLow={getP25} getHigh={getP75} fill={varMeta.color} opacity={0.22} zIndex={3} />

        {/* Ensemble mean */}
        <Line
          dataKey="mean"
          yAxisId="main"
          stroke={varMeta.color}
          strokeWidth={2.5}
          dot={false}
          isAnimationActive={false}
        />
      </>
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, xTicks, yDomain, midnightIndices, varMeta, renderXTick, getP10, getP25, getP75, getP90]);

  return (
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={e => { if (e.target === e.currentTarget) e.currentTarget.close(); }}
      className="open:flex flex-col w-full max-w-none sm:max-w-2xl max-h-[92dvh] m-0 mt-auto sm:m-auto p-0 rounded-t-3xl sm:rounded-3xl bg-slate-950 text-white shadow-2xl overflow-hidden backdrop:bg-black/70 backdrop:backdrop-blur-sm"
    >
      {/* Header */}
      <header className="flex items-start justify-between gap-3 px-5 py-4 bg-slate-900 shrink-0 border-b border-white/10">
        <div className="min-w-0">
          <h2 className="text-base font-bold leading-tight text-white">{weekLabel}</h2>
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

      {/* Variable switcher */}
      <div className="flex gap-1 px-4 pt-4 pb-2 shrink-0">
        {VARS.map(v => {
          const Icon = VAR_ICONS[v.key];
          const label = language === 'en' ? v.labelEn : v.labelEs;
          const active = v.key === variable;
          return (
            <button
              key={v.key}
              type="button"
              onClick={() => setVariable(v.key)}
              aria-pressed={active}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all duration-200 ${active ? 'bg-white text-slate-900 shadow' : 'bg-white/10 text-slate-300 hover:bg-white/15'}`}
            >
              <Icon size={12} className="shrink-0" />
              {label}
            </button>
          );
        })}
      </div>

      {/* Low-confidence banner */}
      {lowConfidence && (
        <div className="px-4 pt-1 shrink-0">
          <div className="bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[10px] rounded-lg px-3 py-1.5">
            {t('ensemble.low_confidence').replace('{week}', String(weekIndex + 1))}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-5">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-sky-400" />
            <p className="text-sm text-slate-400">{t('ensemble.loading')}</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-48 gap-2" role="alert">
            <span className="text-2xl">⚠️</span>
            <p className="text-sm text-slate-300 text-center">{t('ensemble.error')}</p>
          </div>
        ) : !points || !points.length ? (
          <div className="flex flex-col items-center justify-center h-48 gap-2">
            <p className="text-sm text-slate-400">{t('ensemble.no_data')}</p>
          </div>
        ) : (
          <>
            {/* Chart */}
            <div className="mt-2 rounded-2xl bg-slate-900/80 border border-white/10 overflow-hidden">
              {/* Y axis unit label */}
              <div className="flex items-center justify-between px-3 pt-2 pb-0">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  {language === 'en' ? varMeta.labelEn : varMeta.labelEs}
                </span>
                <span className="text-[10px] font-semibold text-slate-500">{varMeta.unit}</span>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <ComposedChart data={chartData} margin={{ top: 8, right: 48, left: 16, bottom: 0 }}>
                  {chartLayers}
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 px-1 mt-2 text-[10px] text-slate-500">
              <span className="flex items-center gap-1">
                <span className="inline-block w-4 h-0.5 rounded-full opacity-20" style={{ backgroundColor: varMeta.color }} />
                <span>{t('ensemble.legend.members')}</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-4 h-2 rounded-sm opacity-30" style={{ backgroundColor: varMeta.color }} />
                <span>p10–p90</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-4 h-2 rounded-sm opacity-60" style={{ backgroundColor: varMeta.color }} />
                <span>p25–p75</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-4 h-0.5 rounded-full" style={{ backgroundColor: varMeta.color }} />
                <span>{t('ensemble.legend.mean')}</span>
              </span>
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
            <p className="mt-4 text-[10px] text-slate-600 leading-relaxed">
              {t('ensemble.footnote')}
            </p>
          </>
        )}
      </div>
    </dialog>
  );
}
