
import type { DailyWeather } from '../types/weather';
import { getWeatherInfo, getThomsDiscomfortIndex, getPressureDeltaAlert, getMigraineRisk } from '../utils/weatherCodes';

interface FutureForecastProps {
  daily: DailyWeather[];
}

export function FutureForecast({ daily }: FutureForecastProps) {
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
      <h3 className="text-sm uppercase tracking-wider mb-4 opacity-70 font-semibold px-1">Próximos 3 Días</h3>
      
      <div className="flex flex-col gap-4">
        {futureDays.map((day, idx) => {
          const date = new Date(day.date);
          const { icon: Icon, label } = getWeatherInfo(day.weatherCode);

          const yesterday = daily[todayIndex + idx];
          const deltaP = yesterday ? Math.round(day.meanPressure - yesterday.meanPressure) : 0;
          const deltaAlert = getPressureDeltaAlert(deltaP);

          const meanTemp = (day.maxTemp + day.minTemp) / 2;
          const thomIndex = getThomsDiscomfortIndex(meanTemp, day.humidity);
          const migraineRisk = getMigraineRisk(deltaP, day.meanPressure, day.humidity, day.precipitation);

          return (
            <div key={idx} className="flex flex-col pb-4 border-b border-slate-200 last:border-0 last:pb-0">
              {/* Fila Principal */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 w-[25%]">
                  <Icon size={24} className="text-amber-500 drop-shadow-sm" aria-label={label} />
                  <span className="font-bold capitalize">{date.toLocaleDateString('es-ES', { weekday: 'short' })}</span>
                </div>
                
                <div className="flex gap-1 w-[35%]">
                   <div className={`px-1 py-1 rounded text-[8px] font-bold uppercase tracking-wider ${thomIndex.bgClass} ${thomIndex.bgClass.includes('text-white') ? '' : 'text-slate-900'} shadow-sm text-center flex-1 flex flex-col justify-center`} title={`Estrés Térmico: ${thomIndex.label}`}>
                      <span className="opacity-80 text-[7px] leading-tight">Fatiga</span>
                      <span className="leading-tight">{thomIndex.shortLabel}</span>
                   </div>
                   <div className={`px-1 py-1 rounded text-[8px] font-bold uppercase tracking-wider ${deltaAlert.bgClass} shadow-sm text-center flex-1 flex flex-col justify-center`} title={`Variación de presión en 24h: ${deltaAlert.detail}`}>
                      <span className="opacity-80 text-[7px] leading-tight">{deltaAlert.detail}</span>
                      <span className="leading-tight">{deltaAlert.label}</span>
                   </div>
                   <div className={`px-1 py-1 rounded text-[8px] font-bold uppercase tracking-wider ${migraineRisk.bgClass} ${migraineRisk.bgClass.includes('text-white') ? '' : 'text-slate-900'} shadow-sm text-center flex-1 flex flex-col justify-center`} title={`Riesgo Migraña (DOI: 10.1111/head.14482): ${migraineRisk.detail}`}>
                      <span className="opacity-80 text-[7px] leading-tight">Migraña</span>
                      <span className="leading-tight">{migraineRisk.label} <span className="opacity-70">({migraineRisk.score})</span></span>
                   </div>
                </div>

                <div className="flex-1 flex justify-end gap-3 text-right">
                  <div className="flex flex-col">
                    <span className="text-sm font-extrabold">{Math.round(day.maxTemp)}°/{Math.round(day.minTemp)}°</span>
                    <span className="text-[10px] text-slate-500 font-semibold">Temp</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-extrabold">{Math.round(day.humidity)}%</span>
                    <span className="text-[10px] text-slate-500 font-semibold">Hum</span>
                  </div>
                </div>
              </div>

              {/* Desglose Matemático */}
              <div className="mt-3 bg-slate-100 rounded-lg p-2.5 text-[10px] border border-slate-200">
                <ul className="list-disc list-inside space-y-0.5 ml-1">
                  {migraineRisk.reasons.map((reason, rIdx) => (
                    <li key={rIdx} className={reason.includes('+') ? 'text-slate-800 font-bold' : 'text-slate-500 font-medium'}>
                      {reason}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
