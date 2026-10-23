
import type { DailyWeather } from '../types/weather';
import { getWeatherInfo, getThomsDiscomfortIndex, getWindChillIndex, getPressureDeltaAlert, getMigraineRisk } from '../utils/weatherCodes';
import { useLanguage } from '../context/LanguageContext';

interface FutureForecastProps {
  daily: DailyWeather[];
}

export function FutureForecast({ daily }: FutureForecastProps) {
  const { language, t } = useLanguage();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayIndex = daily.findIndex(d => {
    const dDate = new Date(d.date);
    dDate.setHours(0, 0, 0, 0);
    return dDate.getTime() === today.getTime();
  });

  const futureDays = todayIndex >= 0 ? daily.slice(todayIndex + 1, todayIndex + 4) : [];

  if (futureDays.length === 0) return null;

  const isEn = language === 'en';

  return (
    <section className="bg-white/95 backdrop-blur-md rounded-3xl p-3 sm:p-6 shadow-lg mt-4 text-slate-800">
      <h3 className="text-sm uppercase tracking-wider mb-4 opacity-70 font-semibold px-1">{t('title.future_forecast')}</h3>

      <div className="flex flex-col gap-0">
        {futureDays.map((day, idx) => {
          const date = new Date(day.date);
          const { icon: Icon, label, colorDark } = getWeatherInfo(day.weatherCode, language);

          const yesterday = daily[todayIndex + idx];
          const deltaP = yesterday ? Math.round(day.meanPressure - yesterday.meanPressure) : 0;
          const deltaAlert = getPressureDeltaAlert(deltaP, language);

          const meanTemp = (day.maxTemp + day.minTemp) / 2;
          const isWinter = meanTemp < 10;
          const thomIndex = isWinter
            ? getWindChillIndex(meanTemp, day.windSpeed, language)
            : getThomsDiscomfortIndex(meanTemp, day.humidity, language);
          const migraineRisk = getMigraineRisk(deltaP, day.meanPressure, day.humidity, day.precipitation, language);

          const dayName = date.toLocaleDateString(isEn ? 'en-US' : 'es-ES', { weekday: 'long' });

          return (
            <div key={idx} className="flex gap-4 py-4 border-b border-slate-100 last:border-0">
              {/* Icon */}
              <div className="flex-shrink-0 pt-1">
                <Icon size={30} className={`${colorDark} drop-shadow-sm`} aria-label={label} />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                {/* Day name + temp range */}
                <div className="flex items-baseline justify-between mb-1">
                  <span className="font-bold text-base capitalize text-slate-800">
                    {dayName}
                    {day.sunshineDuration > 0 && (
                      <span className="ml-2 text-sm font-normal text-amber-700">☀️ {(day.sunshineDuration / 3600).toFixed(1)}h</span>
                    )}
                  </span>
                  <span className="text-sm font-extrabold text-slate-800">
                    {Math.round(day.maxTemp)}°
                    <span className="text-slate-400 font-light mx-0.5">/</span>
                    <span className="text-slate-500">{Math.round(day.minTemp)}°</span>
                  </span>
                </div>

                {/* Weather label + secondary metrics */}
                <div className="flex items-center gap-2 text-base text-slate-600 mb-2.5 flex-wrap font-medium">
                  <span className="font-medium">{label}</span>
                  <span className="text-slate-300">·</span>
                  <span>💧 {Math.round(day.humidity)}%</span>
                  {day.precipitationProbability > 0 && (
                    <>
                      <span className="text-slate-300">·</span>
                      <span>🌂 {Math.round(day.precipitationProbability)}%</span>
                    </>
                  )}
                  {day.precipitation > 0 && (
                    <>
                      <span className="text-slate-300">·</span>
                      <span>🌧 {day.precipitation}mm</span>
                    </>
                  )}
                </div>

                {/* Compact badges */}
                <div className="flex flex-wrap gap-1.5">
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold leading-none ${thomIndex.bgClass} ${thomIndex.bgClass.includes('text-white') ? '' : 'text-slate-900'}`}>
                    {isWinter ? (isEn ? 'WCI' : 'POLAR') : t('label.fatigue')}: {thomIndex.shortLabel}
                  </span>
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold leading-none ${deltaAlert.bgClass}`}>
                    ΔP {deltaP > 0 ? '+' : ''}{deltaP} hPa · {deltaAlert.label}
                  </span>
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold leading-none flex items-center gap-1 ${migraineRisk.bgClass}`}>
                    🧠 {migraineRisk.label} · {migraineRisk.score}/6
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
