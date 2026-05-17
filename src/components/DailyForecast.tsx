
import type { DailyWeather } from '../types/weather';
import { getWeatherInfo, getThomsDiscomfortIndex, getPressureDeltaAlert } from '../utils/weatherCodes';
import { ComposedChart, Area, Line, Bar, Scatter, ResponsiveContainer, YAxis, XAxis, ZAxis } from 'recharts';

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
      deltaP,
      bgValue: 100
    };
  });

  const minPressure = Math.min(...chartData.map(d => d.pressure)) - 5;
  const maxPressure = Math.max(...chartData.map(d => d.pressure)) + 5;
  const minTemp = Math.min(...chartData.map(d => d.temp)) - 5;
  const maxTemp = Math.max(...chartData.map(d => d.temp)) + 5;

  return (
    <section className="bg-slate-900/60 backdrop-blur-md rounded-3xl p-3 sm:p-6 shadow-xl mt-4 overflow-hidden text-white border border-slate-700/50">
      <h3 className="text-sm uppercase tracking-wider mb-6 opacity-90 font-semibold px-1">Últimos 7 Días (Evolución)</h3>

      {/* Top row: Icons and values */}
      <div className="flex justify-between w-full px-2 mb-2">
        {chartData.map((d, idx) => {
          const { icon: Icon, label } = getWeatherInfo(d.weatherCode);
          return (
            <div key={idx} className="flex flex-col items-center flex-1">
              <div title={label}>
              <Icon size={22} className="text-white drop-shadow-md mb-2" />
            </div>
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
      <div className="h-40 w-full -ml-2 mt-4 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_5%,black_95%,transparent)]">
        <ResponsiveContainer width="105%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 20, right: 0, left: 0, bottom: 0 }} barCategoryGap={0}>
            <defs>
              <linearGradient id="colorPressure" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0.0} />
              </linearGradient>
              <linearGradient id="humidityGradient" x1="0" y1="0" x2="1" y2="0">
                {chartData.map((d, i) => {
                  const offset = `${(i / (Math.max(1, chartData.length - 1))) * 100}%`;
                  let color = '#fbbf24'; // Amarillo (seco)
                  if (d.humidity >= 85) color = '#7e22ce'; // Morado fuerte (saturado)
                  else if (d.humidity >= 70) color = '#2563eb'; // Azul fuerte
                  else if (d.humidity >= 50) color = '#34d399'; // Verde
                  return <stop key={i} offset={offset} stopColor={color} />;
                })}
              </linearGradient>
            </defs>
            <XAxis dataKey="name" hide />
            <ZAxis type="number" dataKey="wind" range={[20, 250]} />

            <YAxis yAxisId="pressure" hide domain={[minPressure, maxPressure]} />
            <YAxis yAxisId="temp" hide domain={[minTemp, maxTemp]} />
            <YAxis yAxisId="humidity" hide domain={[0, 100]} />
            <YAxis yAxisId="wind" hide domain={[0, 'dataMax + 20']} />
            <YAxis yAxisId="precip" hide domain={[0, 'dataMax + 15']} />
            <YAxis yAxisId="bg" hide domain={[0, 100]} />

            {/* Fondo Dinámico de Humedad (Aurora) */}
            <Area
              yAxisId="bg"
              type="monotone"
              dataKey="bgValue"
              stroke="none"
              fill="url(#humidityGradient)"
              fillOpacity={0.25}
              isAnimationActive={false}
              activeDot={false}
            />

            {/* Precipitación: Columnas (Fondo) */}
            <Bar
              yAxisId="precip"
              dataKey="precip"
              fill="#a5b4fc"
              opacity={0.5}
              radius={[4, 4, 0, 0]}
            />

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

            {/* Viento: Burbujas Turquesa */}
            <Scatter
              yAxisId="wind"
              dataKey="wind"
              fill="#5eead4"
              opacity={0.8}
            />
          </ComposedChart>
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

      {/* Guía de Lectura del Gráfico */}
      <div className="mt-5 pt-4 border-t border-slate-700/50 text-[10px] sm:text-xs">
        <h4 className="font-bold text-slate-400 mb-2 uppercase tracking-wider text-[9px]">Cómo interpretar este gráfico</h4>
        <div className="grid grid-cols-2 gap-y-2 gap-x-2 opacity-90">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm bg-gradient-to-b from-[#ef4444]/40 to-transparent border-t-2 border-[#f87171] flex-shrink-0"></span>
            <span><strong className="text-slate-200">Montaña Roja:</strong> Presión Atmosférica</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-0.5 bg-[#fcd34d] flex-shrink-0"></span>
            <span><strong className="text-slate-200">Línea Amarilla:</strong> Temperatura</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm bg-[#a5b4fc] opacity-80 flex-shrink-0"></span>
            <span><strong className="text-slate-200">Columnas Índigo:</strong> Volumen de Lluvia</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 bg-gradient-to-r from-[#fcd34d] via-[#3b82f6] to-[#a855f7] rounded-sm opacity-60 flex-shrink-0"></span>
            <span><strong className="text-slate-200">Fondo (Aurora):</strong> Riesgo Humedad Alta</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex gap-0.5 items-center justify-center w-3 flex-shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-[#5eead4]"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-[#5eead4]"></span>
            </div>
            <span><strong className="text-slate-200">Burbujas:</strong> Viento (A mayor radio, más racha)</span>
          </div>
        </div>
      </div>
    </section>
  );
}
