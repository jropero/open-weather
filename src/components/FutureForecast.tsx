import React from 'react';
import type { DailyWeather } from '../types/weather';
import { getWeatherInfo } from '../utils/weatherCodes';

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
    <section className="bg-white/95 backdrop-blur-md rounded-3xl p-6 shadow-lg mt-4 text-slate-800">
      <h3 className="text-sm uppercase tracking-wider mb-4 opacity-70 font-semibold">Próximos 3 Días</h3>
      
      <div className="flex flex-col gap-4">
        {futureDays.map((day, idx) => {
          const date = new Date(day.date);
          const { icon: Icon, label } = getWeatherInfo(day.weatherCode);

          return (
            <div key={idx} className="flex items-center justify-between pb-3 border-b border-slate-200 last:border-0 last:pb-0">
              <div className="flex items-center gap-3 w-1/3">
                <Icon size={24} className="text-amber-500 drop-shadow-sm" aria-label={label} />
                <span className="font-bold capitalize">{date.toLocaleDateString('es-ES', { weekday: 'short' })}</span>
              </div>
              
              <div className="flex-1 flex justify-end gap-5 text-right">
                <div className="flex flex-col">
                  <span className="text-sm font-extrabold">{Math.round(day.maxTemp)}° / {Math.round(day.minTemp)}°</span>
                  <span className="text-[10px] text-slate-500 font-semibold">Temp</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-extrabold">{Math.round(day.humidity)}%</span>
                  <span className="text-[10px] text-slate-500 font-semibold">Hum</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-extrabold">{Math.round(day.meanPressure)}</span>
                  <span className="text-[10px] text-slate-500 font-semibold">hPa</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
