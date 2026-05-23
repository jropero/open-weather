import type { HistoricalWeather } from '../types/weather';
import { getWeatherInfo } from '../utils/weatherCodes';
import { useLanguage } from '../context/LanguageContext';

interface HistoricalPressureProps {
  historical: HistoricalWeather[];
  currentWeatherCode: number;
  currentTemp: number;
  currentHumidity: number;
}

export function HistoricalPressure({ historical, currentWeatherCode, currentTemp, currentHumidity }: HistoricalPressureProps) {
  const { language, t } = useLanguage();
  const { icon: CurrentIcon, label: currentLabel, colorDark: currentColorDark } = getWeatherInfo(currentWeatherCode, language);

  return (
    <section className="bg-white/95 backdrop-blur-md rounded-3xl p-6 shadow-lg mt-4 text-slate-800">
      <h3 className="text-sm uppercase tracking-wider mb-4 opacity-70 font-semibold">{t('title.historical')}</h3>
      
      <div className="flex flex-col gap-4">
        <div className="flex justify-between items-center pb-3 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <CurrentIcon size={24} className={`${currentColorDark} icon-glow`} aria-label={currentLabel} />
            <span className="font-bold">{t('label.today')}</span>
          </div>
          <div className="text-right flex flex-col items-end">
            <span className="text-2xl font-extrabold text-slate-900">{Math.round(currentTemp)}°C</span>
            <div className="flex gap-2 text-xs opacity-80 mt-1 font-medium">
              <span>{t('label.humidity')}: {Math.round(currentHumidity)}%</span>
            </div>
            <p className="text-xs font-semibold text-slate-500 mt-1 capitalize">{currentLabel}</p>
          </div>
        </div>

        {historical.some((h) => h.error || !h.data) ? (
          <div className="flex flex-col items-center justify-center p-6 bg-slate-50/80 rounded-2xl border border-slate-100 text-center gap-2">
            <span className="text-2xl">⚠️</span>
            <p className="text-sm font-semibold text-slate-500">{t('label.info_unavailable')}</p>
          </div>
        ) : (
          historical.map((h) => {
            if (!h.data) return null;
            const { icon: HistIcon, label: histLabel, colorDark: histColorDark } = getWeatherInfo(h.data.weatherCode, language);
            return (
              <div key={h.year} className="flex justify-between items-center pb-3 border-b border-slate-200 last:border-0 last:pb-0">
                <div className="flex items-center gap-3">
                  <HistIcon size={24} className={`${histColorDark} icon-glow`} aria-label={histLabel} />
                  <span className="font-bold">{t('label.in')} {h.year}</span>
                </div>
                <div className="text-right flex flex-col items-end">
                  <span className="text-2xl font-extrabold text-slate-900">{Math.round(h.data.maxTemp)}°C</span>
                  <div className="flex gap-2 text-xs opacity-80 mt-1 font-medium">
                    <span>{t('label.humidity')}: {Math.round(h.data.humidity)}%</span>
                  </div>
                  <p className="text-xs font-semibold text-slate-500 mt-1 capitalize">{histLabel}</p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
