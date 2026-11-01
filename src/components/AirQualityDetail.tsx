import { useRef, useEffect } from 'react';
import { X } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Cell, ResponsiveContainer } from 'recharts';
import type { AirQualityData } from '../types/weather';
import { useLanguage } from '../hooks/useLanguage';
import { getAqiInfo, getPollenLevel } from '../utils/weatherCodes';

interface Props {
  aq: AirQualityData;
  timezone: string | null;
  onClose: () => void;
}

function aqiBarColor(aqi: number): string {
  if (aqi <= 20) return '#10b981';
  if (aqi <= 40) return '#facc15';
  if (aqi <= 60) return '#f97316';
  if (aqi <= 80) return '#ef4444';
  if (aqi <= 100) return '#9333ea';
  return '#9f1239';
}

export function AirQualityDetail({ aq, timezone, onClose }: Props) {
  const { language } = useLanguage();
  const isEn = language === 'en';
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    el.showModal();
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    el.addEventListener('keydown', onKeyDown);
    return () => el.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const tz = timezone ?? 'UTC';
  const chartData = aq.hourlyTime.map((t, idx) => {
    const date = new Date(t + 'Z');
    const label = date.toLocaleTimeString(isEn ? 'en-GB' : 'es-ES', {
      timeZone: tz,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    return { label, aqi: aq.hourlyAqi[idx] ?? 0 };
  });

  const pollutants = [
    { name: 'PM2.5', value: aq.aqiPm25, raw: aq.currentPm25, unit: 'μg/m³' },
    { name: 'PM10',  value: aq.aqiPm10, raw: aq.currentPm10, unit: 'μg/m³' },
    { name: 'NO₂',  value: aq.aqiNo2, raw: null, unit: null },
    { name: 'O₃',   value: aq.aqiO3,  raw: null, unit: null },
    { name: 'SO₂',  value: aq.aqiSo2, raw: null, unit: null },
  ].filter(p => p.value !== null);

  const pollens = [
    { emoji: '🌿', name: isEn ? 'Grass' : 'Gramíneas', value: aq.grassPollen },
    { emoji: '🌳', name: isEn ? 'Birch' : 'Abedul',    value: aq.birchPollen },
    { emoji: '🌸', name: isEn ? 'Alder' : 'Aliso',     value: aq.alderPollen },
    { emoji: '🌾', name: isEn ? 'Mugwort' : 'Artemisa', value: aq.mugwortPollen },
    { emoji: '🫒', name: isEn ? 'Olive' : 'Olivo',     value: aq.olivePollen },
    { emoji: '🌻', name: isEn ? 'Ragweed' : 'Ambrosía', value: aq.ragweedPollen },
  ].filter(p => p.value !== null && p.value > 0);

  return (
    <dialog
      ref={dialogRef}
      className="m-0 mt-auto w-full max-w-lg mx-auto rounded-t-2xl bg-white shadow-2xl p-0 backdrop:bg-black/40"
      style={{ border: 'none' }}
      onClick={(e) => { if (e.target === dialogRef.current) onClose(); }}
    >
      <div className="flex items-center justify-between px-4 pt-4 pb-2 border-b border-slate-100">
        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-500">
          {isEn ? 'Air Quality Detail' : 'Detalle — Calidad del Aire'}
        </h2>
        <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-100 transition-colors">
          <X size={18} className="text-slate-400" />
        </button>
      </div>

      <div className="px-4 py-3 flex flex-col gap-5 overflow-y-auto max-h-[80vh]">

        {chartData.length > 0 && (
          <section>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              {isEn ? '24h AQI trend' : 'Tendencia AQI 24h'}
            </h3>
            <ResponsiveContainer width="100%" height={100}>
              <BarChart data={chartData} barSize={10} margin={{ top: 2, right: 0, bottom: 0, left: -24 }}>
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 9, fill: '#94a3b8' }}
                  interval={3}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis hide domain={[0, 'auto']} />
                <Tooltip
                  contentStyle={{ fontSize: 11, borderRadius: 8, border: 'none', boxShadow: '0 2px 8px rgba(0,0,0,.12)' }}
                  formatter={(v) => {
                    const num = typeof v === 'number' ? v : Number(v ?? 0);
                    const { label } = getAqiInfo(num, language);
                    return [`AQI ${num} — ${label}`, ''];
                  }}
                  labelFormatter={(l) => l}
                />
                <Bar dataKey="aqi" radius={[2, 2, 0, 0]}>
                  {chartData.map((entry, idx) => (
                    <Cell key={idx} fill={aqiBarColor(entry.aqi)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </section>
        )}

        {pollutants.length > 0 && (
          <section>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              {isEn ? 'Pollutants' : 'Contaminantes'}
            </h3>
            <div className="flex flex-col gap-1.5">
              {pollutants.map(p => {
                const pct = Math.min(100, ((p.value!) / 100) * 100);
                const color = aqiBarColor(p.value!);
                return (
                  <div key={p.name} className="flex flex-col gap-0.5">
                    <div className="flex items-center justify-between text-xs text-slate-600 font-medium">
                      <span>{p.name}</span>
                      <span className="font-bold text-slate-800">
                        {isEn ? 'sub-AQI' : 'sub-ICA'} {p.value}
                        {p.raw !== null && p.unit ? ` · ${p.raw!.toFixed(1)} ${p.unit}` : ''}
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, background: color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {pollens.length > 0 && (
          <section>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              {isEn ? 'Pollen' : 'Polen'}
            </h3>
            <div className="flex flex-col gap-1">
              {pollens.map(p => {
                const level = getPollenLevel(p.value!, language);
                if (!level) return null;
                return (
                  <div key={p.name} className="flex items-center justify-between text-xs">
                    <span className="text-slate-600 font-medium">{p.emoji} {p.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400">{Math.round(p.value!)} gr/m³</span>
                      <span className={`px-2 py-0.5 rounded-full font-bold text-xs ${level.bgClass}`}>
                        {level.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <p className="text-xs text-slate-400 text-center pb-1">
          {isEn ? 'CAMS European Air Quality · Open-Meteo' : 'CAMS Calidad del Aire Europea · Open-Meteo'}
        </p>
      </div>
    </dialog>
  );
}
