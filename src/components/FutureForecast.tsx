
import type { DailyWeather } from '../types/weather';
import { getWeatherInfo, getThomsDiscomfortIndex, getPressureDeltaAlert, getMigraineRisk } from '../utils/weatherCodes';
import { useLanguage } from '../context/LanguageContext';

interface FutureForecastProps {
  daily: DailyWeather[];
}

export function FutureForecast({ daily }: FutureForecastProps) {
  const { language, t } = useLanguage();
  const today = new Date();
  today.setHours(0,0,0,0);
  
  const todayIndex = daily.findIndex(d => {
    const dDate = new Date(d.date);
    dDate.setHours(0,0,0,0);
    return dDate.getTime() === today.getTime();
  });

  // Obtener los próximos 3 días (excluyendo hoy)
  const futureDays = todayIndex >= 0 ? daily.slice(todayIndex + 1, todayIndex + 4) : [];

  if (futureDays.length === 0) return null;

  return (
    <section className="bg-white/95 backdrop-blur-md rounded-3xl p-3 sm:p-6 shadow-lg mt-4 text-slate-800">
      <h3 className="text-sm uppercase tracking-wider mb-4 opacity-70 font-semibold px-1">{t('title.future_forecast')}</h3>
      
      <div className="flex flex-col gap-4">
        {futureDays.map((day, idx) => {
          const date = new Date(day.date);
          const { icon: Icon, label, colorDark } = getWeatherInfo(day.weatherCode, language);

          const yesterday = daily[todayIndex + idx];
          const deltaP = yesterday ? Math.round(day.meanPressure - yesterday.meanPressure) : 0;
          const deltaAlert = getPressureDeltaAlert(deltaP, language);

          const meanTemp = (day.maxTemp + day.minTemp) / 2;
          const thomIndex = getThomsDiscomfortIndex(meanTemp, day.humidity, language);
          const migraineRisk = getMigraineRisk(deltaP, day.meanPressure, day.humidity, day.precipitation, language);

          return (
            <div key={idx} className="flex flex-col pb-4 border-b border-slate-200 last:border-0 last:pb-0 gap-2.5">
              {/* Fila Principal: Día, Icono y Parámetros */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Icon size={26} className={`${colorDark} drop-shadow-sm`} aria-label={label} />
                  <span className="font-bold text-base capitalize">{date.toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', { weekday: 'long' })}</span>
                </div>
                
                <div className="flex gap-4 text-right">
                  <div className="flex flex-col">
                    <span className="text-sm font-extrabold">{Math.round(day.maxTemp)}°/{Math.round(day.minTemp)}°</span>
                    <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">{t('label.temp')}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-extrabold">{Math.round(day.humidity)}%</span>
                    <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">{t('label.humidity').substring(0, 4)}</span>
                  </div>
                </div>
              </div>

              {/* Fila de Chips: Grandes, con wrap en viewports pequeños */}
              <div className="flex flex-wrap gap-2">
                <div 
                  className={`px-3 py-1.5 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider ${thomIndex.bgClass} ${thomIndex.bgClass.includes('text-white') ? '' : 'text-slate-900'} shadow-sm whitespace-nowrap flex items-center justify-center`}
                  title={`Estrés Térmico (Índice de Thom): ${thomIndex.label}`}
                >
                  {t('label.fatigue')}: {thomIndex.shortLabel}
                </div>
                <div 
                  className={`px-3 py-1.5 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider ${deltaAlert.bgClass} shadow-sm whitespace-nowrap flex items-center justify-center`}
                  title={`Variación de presión en 24h: ${deltaAlert.detail}`}
                >
                  Δ P: {deltaAlert.label} ({deltaAlert.detail})
                </div>
                <div 
                  className={`px-3 py-1.5 rounded-full text-[10px] sm:text-xs font-bold uppercase tracking-wider ${migraineRisk.bgClass} shadow-sm whitespace-nowrap flex items-center justify-center gap-1`}
                  title={`Riesgo Migraña: ${migraineRisk.detail}`}
                >
                  <span>🧠</span> {t('label.migraine')}: {migraineRisk.label} ({migraineRisk.score} pts)
                </div>
              </div>

              {/* Desglose Clínico y Matemático */}
              <div className="mt-3 bg-slate-100 rounded-lg p-2.5 text-[10px] border border-slate-200 flex flex-col gap-2.5">
                <div>
                  <h5 className="font-bold text-slate-700 border-b border-slate-200 pb-0.5 mb-1.5 flex justify-between items-center">
                    <span>{t('label.fatigue_calc')}</span>
                    <span className="bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded font-black">{thomIndex.value.toFixed(1)} DI</span>
                  </h5>
                  <ul className="list-disc list-inside space-y-0.5 ml-1">
                    {thomIndex.reasons.map((reason, rIdx) => (
                      <li key={rIdx} className="text-slate-600 font-medium">
                        {reason}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h5 className="font-bold text-slate-700 border-b border-slate-200 pb-0.5 mb-1.5 flex justify-between items-center">
                    <span>{t('label.migraine_doi')}</span>
                    <span className="bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded font-black">{migraineRisk.score} / 6 pts</span>
                  </h5>
                  <ul className="list-disc list-inside space-y-0.5 ml-1">
                    {migraineRisk.reasons.map((reason, rIdx) => (
                      <li key={rIdx} className={reason.includes('+') ? 'text-slate-800 font-bold' : 'text-slate-500 font-medium'}>
                        {reason}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
