import { lazy, Suspense, useState } from 'react';
import type { AirQualityData } from '../types/weather';
import { useLanguage } from '../hooks/useLanguage';
import { getAqiInfo, getPollenLevel } from '../utils/weatherCodes';

// Loaded on first "View detail" tap — keeps the chart dialog out of the initial bundle
const AirQualityDetail = lazy(() =>
  import('./AirQualityDetail').then((m) => ({ default: m.AirQualityDetail })),
);

interface Props {
  aq: AirQualityData & { currentAqi: number };
  timezone: string | null;
}

const pm25dot = (v: number) => {
  if (v < 12) return 'bg-emerald-400';
  if (v < 35.5) return 'bg-yellow-400';
  if (v < 55.5) return 'bg-orange-400';
  return 'bg-red-500';
};

const pm10dot = (v: number) => {
  if (v < 54) return 'bg-emerald-400';
  if (v < 154) return 'bg-yellow-400';
  if (v < 254) return 'bg-orange-400';
  return 'bg-red-500';
};

function PmRow({ label, value, dot }: { label: string; value: number; dot: string }) {
  return (
    <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
      <span>
        {label} <span className="font-bold text-slate-700">{value.toFixed(1)}</span> μg/m³
      </span>
      <span className={`w-2.5 h-2.5 rounded-full ml-2 ${dot}`} />
    </div>
  );
}

/** "Calidad del Aire" card (AQI, dominant pollutant, PM, pollen) + its detail dialog. */
// eslint-disable-next-line sonarjs/cognitive-complexity
export function AirQualityCard({ aq, timezone }: Props) {
  const { language } = useLanguage();
  const isEn = language === 'en';
  const [detailOpen, setDetailOpen] = useState(false);
  const aqiInfo = getAqiInfo(aq.currentAqi, language);

  const pollens = [
    { emoji: '🌿', name: isEn ? 'Grass' : 'Gramín.', value: aq.grassPollen },
    { emoji: '🌳', name: isEn ? 'Birch' : 'Abedul', value: aq.birchPollen },
    { emoji: '🌸', name: isEn ? 'Alder' : 'Aliso', value: aq.alderPollen },
    { emoji: '🌾', name: isEn ? 'Mugwort' : 'Artemisa', value: aq.mugwortPollen },
    { emoji: '🫒', name: isEn ? 'Olive' : 'Olivo', value: aq.olivePollen },
    { emoji: '🌻', name: isEn ? 'Ragweed' : 'Ambrosía', value: aq.ragweedPollen },
  ].filter((p): p is typeof p & { value: number } => p.value !== null && p.value > 0);

  return (
    <>
      <section className="bg-gradient-to-br from-white to-emerald-50 rounded-2xl p-3 shadow-lg text-slate-800 flex flex-col gap-2">
        <h3 className="text-xs uppercase tracking-widest text-slate-500 font-bold leading-tight">
          {isEn ? 'Air Quality' : 'Calidad del Aire'}
        </h3>

        <div className="flex items-center gap-2">
          <span className="text-2xl font-black text-slate-900 leading-none">
            {Math.round(aq.currentAqi)}
          </span>
          <span className="text-xs text-slate-400 font-bold uppercase">AQI</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${aqiInfo.bgClass}`}>
            {aqiInfo.label}
          </span>
          {aq.dominantPollutant && (
            <span className="ml-auto px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-600">
              {aq.dominantPollutant}
            </span>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <div className="relative w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 via-yellow-400 via-orange-400 to-purple-600 opacity-80" />
            <div
              className="absolute top-0 h-full w-1 bg-slate-900 rounded-full border border-white shadow-sm transition-all duration-1000 ease-out"
              style={{
                left: `calc(${Math.max(0, Math.min(100, (aq.currentAqi / 100) * 100))}% - 2px)`,
              }}
            />
          </div>
          <div className="flex justify-between text-xs text-slate-400 font-bold">
            <span>{isEn ? 'Good' : 'Bueno'}</span>
            <span>Ext.</span>
          </div>
        </div>

        {(aq.currentPm25 !== null || aq.currentPm10 !== null) && (
          <div className="flex flex-col gap-0.5">
            {aq.currentPm25 !== null && (
              <PmRow label="PM2.5" value={aq.currentPm25} dot={pm25dot(aq.currentPm25)} />
            )}
            {aq.currentPm10 !== null && (
              <PmRow label="PM10" value={aq.currentPm10} dot={pm10dot(aq.currentPm10)} />
            )}
          </div>
        )}

        {pollens.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-1.5 border-t border-slate-100">
            {pollens.map((p) => {
              const level = getPollenLevel(p.value, language);
              if (!level) return null;
              return (
                <span
                  key={p.name}
                  className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs font-bold ${level.bgClass}`}
                >
                  {p.emoji} {p.name}
                </span>
              );
            })}
          </div>
        )}

        <button
          type="button"
          onClick={() => setDetailOpen(true)}
          className="mt-auto text-xs text-emerald-600 font-bold text-right hover:text-emerald-800 transition-colors"
        >
          {isEn ? 'View detail →' : 'Ver detalle →'}
        </button>
      </section>

      {detailOpen && (
        <Suspense fallback={null}>
          <AirQualityDetail aq={aq} timezone={timezone} onClose={() => setDetailOpen(false)} />
        </Suspense>
      )}
    </>
  );
}
