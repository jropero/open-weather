import React from 'react';
import type { DailyWeather } from '../types/weather';
import { getWeatherInfo, getThomsDiscomfortIndex, getPressureDeltaAlert } from '../utils/weatherCodes';
import { AreaChart, Area, Line, ResponsiveContainer, YAxis } from 'recharts';

interface DailyForecastProps {
  daily: DailyWeather[];
}

export function DailyForecast({ daily }: DailyForecastProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayIndex = daily.findIndex(d => {
    const dDate = new Date(d.date);
    dDate.setHours(0, 0, 0, 0);
    return dDate.getTime() === today.getTime();
  });

  const pastDays = todayIndex >= 7 ? daily.slice(todayIndex - 7, todayIndex) : daily.slice(0, 7);

  const chartData = pastDays.map(d => {
    const actualIdx = daily.findIndex(x => x.date === d.date);
    const yesterday = actualIdx > 0 ? daily[actualIdx - 1] : d;
    const deltaP = Math.round(d.meanPressure - yesterday.meanPressure);

    return {
      name: new Date(d.date).toLocaleDateString('es-ES', { weekday: 'short' }),
      pressure: Math.round(d.meanPressure),
      temp: Math.round((d.maxTemp + d.minTemp) / 2),
      humidity: Math.round(d.humidity),
      wind: Math.round(d.windSpeed),
      precip: d.precipitation,
      weatherCode: d.weatherCode,
      deltaP
    };
  });

  const minPressure = Math.min(...chartData.map(d => d.pressure)) - 5;
  const maxPressure = Math.max(...chartData.map(d => d.pressure)) + 5;
  const minTemp = Math.min(...chartData.map(d => d.temp)) - 5;
  const maxTemp = Math.max(...chartData.map(d => d.temp)) + 5;

  return (
    <section className="bg-slate-900/60 backdrop-blur-md rounded-3xl p-6 shadow-xl mt-4 overflow-hidden text-white border border-slate-700/50">
      <h3 className="text-sm uppercase tracking-wider mb-6 opacity-90 font-semibold">Últimos 7 Días (Evolución)</h3>

      {/* Top row: Icons and values */}
      <div className="flex justify-between w-full px-2 mb-2">
        {chartData.map((d, idx) => {
          const { icon: Icon, label } = getWeatherInfo(d.weatherCode);
          return (
            <div key={idx} className="flex flex-col items-center flex-1">
              <Icon size={22} className="text-white drop-shadow-md mb-2" title={label} />
              <span className="text-[10px] font-bold text-red-400 drop-shadow-md leading-tight" title="Presión (hPa)">{d.pressure} hPa</span>
              <span className="text-[10px] font-bold text-amber-300 drop-shadow-md leading-tight" title="Temperatura (°C)">{d.temp}°C</span>
              <span className="text-[10px] font-bold text-sky-300 drop-shadow-md leading-tight" title="Humedad (%)">{d.humidity}%</span>
              <span className="text-[10px] font-bold text-teal-300 drop-shadow-md leading-tight" title="Viento (km/h)">{d.wind} km/h</span>
              <span className="text-[10px] font-bold text-indigo-300 drop-shadow-md leading-tight" title="Precipitación (mm)">{d.precip} mm</span>
              
              {/* Índice de Incomodidad de Thom */}
              <div 
                className={`mt-1.5 px-1 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${getThomsDiscomfortIndex(d.temp, d.humidity).bgClass} ${getThomsDiscomfortIndex(d.temp, d.humidity).bgClass.includes('text-white') ? '' : 'text-slate-900'} shadow-sm text-center leading-none`}
                title={`Estrés Térmico (Índice de Thom): ${getThomsDiscomfortIndex(d.temp, d.humidity).label}`}
              >
                {getThomsDiscomfortIndex(d.temp, d.humidity).shortLabel}
              </div>

              {/* Alerta Delta P */}
              <div 
                className={`mt-1 px-0.5 py-0.5 rounded text-[7px] font-bold uppercase tracking-wider ${getPressureDeltaAlert(d.deltaP).bgClass} shadow-sm text-center leading-tight flex flex-col`}
                title={`Variación de presión en 24h: ${getPressureDeltaAlert(d.deltaP).detail}`}
              >
                <span>{getPressureDeltaAlert(d.deltaP).label}</span>
                <span className="opacity-90">{getPressureDeltaAlert(d.deltaP).detail}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Multi-Line Chart */}
      <div className="h-40 w-full -ml-3 mt-4">
        <ResponsiveContainer width="108%" height="100%">
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="colorPressure" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <YAxis yAxisId="pressure" hide domain={[minPressure, maxPressure]} />
            <YAxis yAxisId="temp" hide domain={[minTemp, maxTemp]} />
            <YAxis yAxisId="humidity" hide domain={[0, 100]} />
            <YAxis yAxisId="wind" hide domain={[0, 'dataMax + 20']} />
            <YAxis yAxisId="precip" hide domain={[0, 'dataMax + 10']} />

            {/* Presión: Area y Línea Roja */}
            <Area
              yAxisId="pressure"
              type="monotone"
              dataKey="pressure"
              stroke="#f87171"
              strokeWidth={3}
              fillOpacity={1}
              fill="url(#colorPressure)"
              dot={{ r: 3, fill: "#f87171", strokeWidth: 1, stroke: "#1e293b" }}
              activeDot={{ r: 5 }}
            />
            {/* Temperatura: Línea Amarilla */}
            <Line
              yAxisId="temp"
              type="monotone"
              dataKey="temp"
              stroke="#fcd34d"
              strokeWidth={2}
              dot={{ r: 2, fill: "#fcd34d", strokeWidth: 1, stroke: "#1e293b" }}
            />
            {/* Humedad: Línea Azul */}
            <Line
              yAxisId="humidity"
              type="monotone"
              dataKey="humidity"
              stroke="#7dd3fc"
              strokeWidth={2}
              dot={{ r: 2, fill: "#7dd3fc", strokeWidth: 1, stroke: "#1e293b" }}
            />
            {/* Viento: Línea Turquesa */}
            <Line
              yAxisId="wind"
              type="monotone"
              dataKey="wind"
              stroke="#5eead4"
              strokeWidth={2}
              dot={{ r: 2, fill: "#5eead4", strokeWidth: 1, stroke: "#1e293b" }}
            />
            {/* Precipitación: Línea Índigo */}
            <Line
              yAxisId="precip"
              type="monotone"
              dataKey="precip"
              stroke="#a5b4fc"
              strokeWidth={2}
              dot={{ r: 2, fill: "#a5b4fc", strokeWidth: 1, stroke: "#1e293b" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Bottom row: Day names */}
      <div className="flex justify-between w-full px-2 mt-2">
        {chartData.map((d, idx) => (
          <div key={idx} className="flex-1 flex justify-center">
            <span className="text-xs opacity-90 capitalize drop-shadow-sm">{d.name}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
