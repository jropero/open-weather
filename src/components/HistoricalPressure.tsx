
import type { HistoricalWeather } from '../types/weather';
import { getPressureDescription, getWeatherInfo } from '../utils/weatherCodes';

interface HistoricalPressureProps {
  historical: HistoricalWeather[];
  currentPressure: number;
  currentWeatherCode: number;
  currentTemp: number;
  currentHumidity: number;
}

export function HistoricalPressure({ historical, currentPressure, currentWeatherCode, currentTemp, currentHumidity }: HistoricalPressureProps) {
  const { icon: CurrentIcon, label: currentLabel } = getWeatherInfo(currentWeatherCode);

  return (
    <section className="bg-white/95 backdrop-blur-md rounded-3xl p-6 shadow-lg mt-4 text-slate-800">
      <h3 className="text-sm uppercase tracking-wider mb-4 opacity-70 font-semibold">Memoria Atmosférica</h3>
      
      <div className="flex flex-col gap-4">
        <div className="flex justify-between items-center pb-3 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <CurrentIcon size={24} className="text-amber-500 drop-shadow-sm" aria-label={currentLabel} />
            <span className="font-bold">Hoy</span>
          </div>
          <div className="text-right flex flex-col items-end">
            <span className="text-xl font-extrabold">{Math.round(currentPressure)} hPa</span>
            <div className="flex gap-2 text-xs opacity-80 mt-1 font-medium">
              <span>{Math.round(currentTemp)}°C</span>
              <span>{Math.round(currentHumidity)}%</span>
            </div>
            <p className="text-xs font-semibold text-slate-500 mt-1">{getPressureDescription(currentPressure)}</p>
          </div>
        </div>

        {historical.map((h) => {
          const { icon: HistIcon, label: histLabel } = getWeatherInfo(h.data.weatherCode);
          return (
            <div key={h.year} className="flex justify-between items-center pb-3 border-b border-slate-200 last:border-0 last:pb-0">
              <div className="flex items-center gap-3">
                <HistIcon size={24} className="text-amber-500 drop-shadow-sm" aria-label={histLabel} />
                <span className="font-bold">En {h.year}</span>
              </div>
              <div className="text-right flex flex-col items-end">
                <span className="text-xl font-extrabold">{Math.round(h.data.meanPressure)} hPa</span>
                <div className="flex gap-2 text-xs opacity-80 mt-1 font-medium">
                  <span>{Math.round(h.data.maxTemp)}°C</span>
                  <span>{Math.round(h.data.humidity)}%</span>
                </div>
                <p className="text-xs font-semibold text-slate-500 mt-1">{getPressureDescription(h.data.meanPressure)}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
