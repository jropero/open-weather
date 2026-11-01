import { useEffect, useRef } from 'react';
import { BarChart, Bar, Cell, LabelList, XAxis, YAxis, ReferenceLine, ResponsiveContainer } from 'recharts';
import { X, Thermometer, CloudRain, Gauge, Sun, Snowflake, type LucideIcon } from 'lucide-react';
import type { Location, SeasonalPeriod, SeasonalVariable, SeasonKey } from '../types/weather';
import { useLanguage } from '../hooks/useLanguage';
import { useHistoricalClimate } from '../hooks/useHistoricalClimate';
import { getHolisticSummary, ALL_VARS, type ClimateDetailResult, type AnalogueYear } from '../utils/climateStats';
import { getClimateZone, getSeasonName } from '../utils/seasonal';

// ---- Meta ----------------------------------------------------------------

const VAR_ICONS: Record<SeasonalVariable, LucideIcon> = {
  temperature: Thermometer, precipitation: CloudRain, pressure: Gauge, sunshine: Sun, snowfall: Snowflake,
};

const VAR_COLORS: Record<SeasonalVariable, string> = {
  temperature: '#fca5a5', precipitation: '#7dd3fc', pressure: '#c084fc',
  sunshine: '#fbbf24',   snowfall: '#a5f3fc',
};

const VAR_NAMES_ES: Record<SeasonalVariable, string> = {
  temperature: 'Temp.', precipitation: 'Precip.', pressure: 'Presión', sunshine: 'Sol', snowfall: 'Nieve',
};
const VAR_NAMES_EN: Record<SeasonalVariable, string> = {
  temperature: 'Temp.', precipitation: 'Precip.', pressure: 'Pressure', sunshine: 'Sun', snowfall: 'Snow',
};

const ADJ: Record<SeasonalVariable, { aboveEs: string; belowEs: string; aboveEn: string; belowEn: string }> = {
  temperature:   { aboveEs: 'cálido',    belowEs: 'frío',      aboveEn: 'warmer',  belowEn: 'cooler'  },
  precipitation: { aboveEs: 'lluvioso',  belowEs: 'seco',      aboveEn: 'wetter',  belowEn: 'drier'   },
  pressure:      { aboveEs: 'alto',      belowEs: 'bajo',      aboveEn: 'higher',  belowEn: 'lower'   },
  sunshine:      { aboveEs: 'soleado',   belowEs: 'gris',      aboveEn: 'sunnier', belowEn: 'greyer'  },
  snowfall:      { aboveEs: 'nevoso',    belowEs: 'sin nieve', aboveEn: 'snowier', belowEn: 'drier'   },
};

// ---- Helpers -------------------------------------------------------------

function formatValue(variable: SeasonalVariable, x: number | null): string {
  if (x === null) return '—';
  switch (variable) {
    case 'temperature':   return `${x.toFixed(1)} °C`;
    case 'precipitation': return `${Math.round(x)} mm`;
    case 'pressure':      return `${x.toFixed(1)} hPa`;
    case 'sunshine':      return `${Math.round(x / 3600)} h`;
    case 'snowfall':      return `${x.toFixed(1)} cm`;
  }
}

function getSummaryEmoji(anomalies: Record<SeasonalVariable, number | null>): string {
  const t = anomalies.temperature ?? 0;
  const p = anomalies.precipitation ?? 0;
  const sun = anomalies.sunshine ?? 0;
  const pressure = anomalies.pressure ?? 0;
  if (t >= 1) return '🌡';
  if (t <= -1 && p >= 10) return '🌧';
  if (t <= -1) return '❄';
  if (p <= -10 && sun > 0) return '🌤';
  if (pressure < -1) return '☁';
  if (p >= 10) return '🌧';
  return '🌡';
}

// ---- Comparison label (plain language "above/below N of last M years") ----

function comparisonLabel(
  variable: SeasonalVariable,
  aboveCount: number | null,
  totalYears: number,
  lang: 'es' | 'en',
): string {
  if (aboveCount === null || totalYears === 0) return '—';
  const adj = ADJ[variable];

  // aboveCount = how many historical years the forecast EXCEEDS (warmer/wetter/etc.)
  if (aboveCount >= totalYears) {
    return lang === 'es'
      ? `El más ${adj.aboveEs} de los últimos ${totalYears} años`
      : `${adj.aboveEn.charAt(0).toUpperCase() + adj.aboveEn.slice(1)} than all last ${totalYears} years`;
  }
  if (aboveCount === 0) {
    return lang === 'es'
      ? `El más ${adj.belowEs} de los últimos ${totalYears} años`
      : `${adj.belowEn.charAt(0).toUpperCase() + adj.belowEn.slice(1)} than all last ${totalYears} years`;
  }
  if (aboveCount >= Math.ceil(totalYears * 0.65)) {
    return lang === 'es'
      ? `Más ${adj.aboveEs} que en ${aboveCount} de los últimos ${totalYears} años`
      : `${adj.aboveEn.charAt(0).toUpperCase() + adj.aboveEn.slice(1)} than in ${aboveCount} of the last ${totalYears} years`;
  }
  if (aboveCount <= Math.floor(totalYears * 0.35)) {
    const belowN = totalYears - aboveCount;
    return lang === 'es'
      ? `Más ${adj.belowEs} que en ${belowN} de los últimos ${totalYears} años`
      : `${adj.belowEn.charAt(0).toUpperCase() + adj.belowEn.slice(1)} than in ${belowN} of the last ${totalYears} years`;
  }
  return lang === 'es'
    ? `Parecido a la media de los últimos ${totalYears} años`
    : `Near the average of the last ${totalYears} years`;
}

// ---- Mini bar chart -------------------------------------------------------

type BarEntry = { year: string; value: number | null; isForecast: boolean };

function MiniBarChart({
  years, values, forecastValue, climMean, color, variable,
}: {
  years: number[];
  values: (number | null)[];
  forecastValue: number | null;
  climMean: number | null;
  color: string;
  variable: SeasonalVariable;
}) {
  if (!years.length) return <div className="flex-1 h-20" />;

  const fmtBarValue = (x: number): string => {
    switch (variable) {
      case 'temperature':   return x.toFixed(1);
      case 'precipitation': return String(Math.round(x));
      case 'pressure':      return String(Math.round(x));
      case 'sunshine':      return String(Math.round(x / 3600));
      case 'snowfall':      return x.toFixed(1);
    }
  };

  const data: BarEntry[] = years.map((year, i) => ({
    year: `'${String(year).slice(2)}`,
    value: values[i],
    isForecast: false,
  }));

  if (forecastValue !== null) {
    data.push({ year: 'S5', value: forecastValue, isForecast: true });
  }

  const allValues = data.map(d => d.value).filter((v): v is number => v !== null);
  const minVal = allValues.length ? Math.min(...allValues) : 0;
  const maxVal = allValues.length ? Math.max(...allValues) : 1;
  const padding = (maxVal - minVal) * 0.05 || 0.5;
  const domainMin = Math.min(minVal - padding, climMean !== null ? climMean - padding : minVal - padding);
  const domainMax = Math.max(maxVal + padding, climMean !== null ? climMean + padding : maxVal + padding);

  return (
    <div className="flex-1 min-w-0" style={{ height: 80 }}>
      <ResponsiveContainer width="100%" height={80}>
        <BarChart data={data} margin={{ top: 14, right: 2, left: 2, bottom: 0 }} barCategoryGap="10%">
          <XAxis
            dataKey="year"
            tick={{ fontSize: 8, fill: '#64748b' }}
            axisLine={false}
            tickLine={false}
            height={14}
          />
          <YAxis hide domain={[domainMin, domainMax]} />
          {climMean !== null && (
            <ReferenceLine
              y={climMean}
              stroke="rgba(255,255,255,0.25)"
              strokeDasharray="3 3"
            />
          )}
          <Bar dataKey="value" radius={[2, 2, 0, 0]} isAnimationActive={false}>
            {data.map((entry, index) => (
              <Cell
                key={index}
                fill={
                  entry.isForecast
                    ? color
                    : (entry.value ?? 0) >= (climMean ?? 0)
                      ? 'rgba(255,255,255,0.55)'
                      : 'rgba(255,255,255,0.25)'
                }
                stroke={entry.isForecast ? 'rgba(255,255,255,0.5)' : 'none'}
                strokeWidth={entry.isForecast ? 1 : 0}
              />
            ))}
            <LabelList
              dataKey="value"
              position="top"
              content={(props) => {
                const { x, y, width, value } = props as { x: number; y: number; width: number; value: number | null };
                if (value === null || value === undefined) return null;
                return (
                  <text
                    x={x + width / 2}
                    y={y - 2}
                    fill="rgba(255,255,255,0.55)"
                    fontSize={7}
                    textAnchor="middle"
                  >
                    {fmtBarValue(value)}
                  </text>
                );
              }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ---- Analogue label ------------------------------------------------------

function formatAnalogueLabel(a: AnalogueYear, locale: string): string {
  if (a.month !== undefined) {
    return new Date(Date.UTC(a.year, a.month - 1, 1)).toLocaleDateString(locale, {
      month: 'short', year: 'numeric', timeZone: 'UTC',
    });
  }
  if (a.seasonKey) {
    const abbrsEs: Record<SeasonKey, string> = { DJF: 'Inv', MAM: 'Prim', JJA: 'Ver', SON: 'Oto' };
    const abbrsEn: Record<SeasonKey, string> = { DJF: 'Win', MAM: 'Spr', JJA: 'Sum', SON: 'Aut' };
    const abbrs = locale.startsWith('es') ? abbrsEs : abbrsEn;
    const prefix = abbrs[a.seasonKey];
    if (a.seasonKey === 'DJF') return `${prefix} ${a.year - 1}–${String(a.year).slice(2)}`;
    return `${prefix} ${a.year}`;
  }
  return a.label;
}

// ---- Skeleton ------------------------------------------------------------

function SkeletonStrip() {
  return (
    <div className="flex items-center gap-2 py-1 animate-pulse">
      <div className="w-14 h-3 bg-white/10 rounded" />
      <div className="flex-1 h-6 bg-white/10 rounded" />
    </div>
  );
}

// ---- Strips section ------------------------------------------------------

function Strips({ result, lang }: { result: ClimateDetailResult; lang: 'es' | 'en' }) {
  return (
    <div className="mt-4 flex flex-col gap-3">
      {ALL_VARS.map(v => {
        const fv = result.forecastValues[v];
        const above = result.aboveCount[v];
        const cm = result.climMeans[v];
        const hasData = fv !== null;
        const Icon = VAR_ICONS[v];
        const color = VAR_COLORS[v];
        const varName = lang === 'es' ? VAR_NAMES_ES[v] : VAR_NAMES_EN[v];

        return (
          <div key={v} className={hasData ? '' : 'opacity-40'}>
            {/* Row: icon+label | dot strip */}
            <div className="flex items-center gap-2">
              <div className="w-14 flex items-center gap-1 shrink-0">
                <Icon size={11} className="shrink-0 text-slate-400" aria-hidden />
                <span className="text-[10px] text-slate-300 font-medium leading-tight">{varName}</span>
              </div>

              {hasData ? (
                <MiniBarChart
                  years={result.stripYears}
                  values={result.stripValues[v]}
                  forecastValue={fv}
                  climMean={cm}
                  color={color}
                  variable={v}
                />
              ) : (
                <span className="flex-1 text-[10px] text-slate-500">
                  {lang === 'es' ? 'Sin previsión' : 'No forecast'}
                </span>
              )}
            </div>

            {/* Below-strip detail */}
            {hasData && (
              <div className="pl-16 mt-0.5 space-y-px">
                <p className="text-[9px] text-slate-300 leading-snug">
                  {comparisonLabel(v, above, result.totalYears, lang)}
                </p>
                <p className="text-[9px] text-slate-600 leading-snug">
                  {lang === 'es' ? 'S5 ajustado' : 'S5 adjusted'}: {formatValue(v, fv)}
                  {cm !== null && (
                    <> · {lang === 'es' ? 'Media ERA5' : 'ERA5 avg'}: {formatValue(v, cm)}</>
                  )}
                </p>
              </div>
            )}
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

export function ClimateDetailView({ location, period, onClose }: Props) {
  const { language, t } = useLanguage();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const locale = language === 'en' ? 'en-GB' : 'es-ES';
  const lang = language as 'es' | 'en';

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

  const isSeasonal = !!period.season;

  const periodLabel = (): string => {
    if (!isSeasonal) {
      return new Date(`${period.start}T00:00:00Z`).toLocaleDateString(locale, {
        month: 'long', year: 'numeric', timeZone: 'UTC',
      });
    }
    const seasonKey = period.season!.key;
    const zone = getClimateZone(location.latitude);
    const seasonName = getSeasonName(seasonKey, zone);
    const name = seasonName ? t(`seasonal.season.${seasonName}`) : t('seasonal.next.tropical');
    const startYear = Number(period.start.slice(0, 4));
    const endYear   = Number(period.end.slice(0, 4));
    const yearStr = startYear !== endYear
      ? `${startYear}–${String(endYear).slice(2)}`
      : String(startYear);
    return `${name} ${yearStr}`;
  };

  const anomalies: Record<SeasonalVariable, number | null> = {
    temperature:   period.values.temperature.anomaly,
    precipitation: period.values.precipitation.anomaly,
    pressure:      period.values.pressure.anomaly,
    sunshine:      period.values.sunshine.anomaly,
    snowfall:      period.values.snowfall.anomaly,
  };

  const summary      = getHolisticSummary(anomalies, lang);
  const summaryEmoji = getSummaryEmoji(anomalies);

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
          <h2 className="text-base font-bold leading-tight text-white">
            {(() => { const s = periodLabel(); return s.charAt(0).toUpperCase() + s.slice(1); })()}
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

      {/* Scrollable body */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-5">
        {/* Holistic summary */}
        <div className="mt-4 rounded-2xl bg-white/10 border border-white/10 px-4 py-3 flex items-start gap-3">
          <span className="text-2xl leading-none shrink-0" aria-hidden>{summaryEmoji}</span>
          <p className="text-sm text-slate-100 leading-snug">{summary}</p>
        </div>

        {loading ? (
          <div className="mt-4 flex flex-col gap-3">
            <div className="animate-pulse flex gap-2">
              {[0, 1, 2].map(i => <div key={i} className="flex-1 h-12 bg-white/10 rounded-xl" />)}
            </div>
            {ALL_VARS.map(v => <SkeletonStrip key={v} />)}
          </div>
        ) : error ? (
          <div className="mt-4 flex flex-col items-center gap-2 py-6" role="alert">
            <span className="text-2xl" aria-hidden>⚠️</span>
            <p className="text-sm text-slate-300 text-center">{t('climate.error')}</p>
          </div>
        ) : result ? (
          <>
            {/* Analogue years */}
            <div className="mt-4">
              <p className="text-[11px] text-slate-400 mb-2">{t('climate.analogues.label')}</p>
              <div className="flex gap-2">
                {result.analogues.length === 0 ? (
                  <p className="text-xs text-slate-500">—</p>
                ) : result.analogues.map((a, i) => (
                  <div key={i} className="flex-1 min-w-0">
                    <div className="bg-white/10 rounded-xl px-2 py-2 text-center">
                      <span className="text-sm font-bold text-white block leading-tight">
                        {formatAnalogueLabel(a, locale)}
                      </span>
                    </div>
                    <div className="mt-1 h-1 bg-white/20 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-400 rounded-full"
                        style={{ width: `${Math.round(a.similarity * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[10px] text-slate-500">{t('climate.analogues.note')}</p>
            </div>

            {/* Variable rows */}
            <Strips result={result} lang={lang} />

            {/* Footnote */}
            <p className="mt-4 text-[10px] text-slate-600 leading-relaxed">
              {t('climate.footnote')
                .replace('{start}', String(result.stripYears[0] ?? '…'))
                .replace('{end}', String(result.stripYears.at(-1) ?? '…'))}
            </p>
            <p className="mt-1 text-[10px] text-slate-700 leading-relaxed">
              {t('climate.footnote.bias')}
            </p>
          </>
        ) : null}
      </div>
    </dialog>
  );
}
