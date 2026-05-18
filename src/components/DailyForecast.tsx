import type { DailyWeather } from '../types/weather';
import { getWeatherInfo, getThomsDiscomfortIndex, getPressureDeltaAlert } from '../utils/weatherCodes';
import { ComposedChart, Area, Line, Bar, ResponsiveContainer, YAxis, XAxis } from 'recharts';
import { useLanguage } from '../context/LanguageContext';

interface DailyForecastProps {
  daily: DailyWeather[];
}

export function DailyForecast({ daily }: DailyForecastProps) {
  const { language, t } = useLanguage();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayIndex = daily.findIndex(d => {
    const dDate = new Date(d.date);
    dDate.setHours(0, 0, 0, 0);
    return dDate.getTime() === today.getTime();
  });

  const startIndex = Math.max(0, todayIndex - 3);
  const targetDays = daily.slice(startIndex, startIndex + 7);

  const chartData = targetDays.map(d => {
    const actualIdx = daily.findIndex(x => x.date === d.date);
    const yesterday = actualIdx > 0 ? daily[actualIdx - 1] : d;
    const deltaP = Math.round(d.meanPressure - yesterday.meanPressure);

    const isToday = actualIdx === todayIndex;
    
    return {
      name: isToday 
        ? (language === 'en' ? 'TODAY' : 'HOY') 
        : new Date(d.date).toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US', { weekday: 'short' }),
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
    <section className="bg-slate-900/60 backdrop-blur-md rounded-3xl py-4 px-0.5 sm:p-6 shadow-xl mt-4 overflow-hidden text-white border border-slate-700/50">
      <h3 className="text-sm uppercase tracking-wider mb-6 opacity-90 font-semibold px-4">{t('title.daily_forecast')}</h3>

      {/* Top row: Icons and values */}
      <div className="flex justify-between w-full px-0 mb-2">
        {chartData.map((d, idx) => {
          const { icon: Icon, label } = getWeatherInfo(d.weatherCode, language);
          const thomIndex = getThomsDiscomfortIndex(d.temp, d.humidity, language);
          const deltaAlert = getPressureDeltaAlert(d.deltaP, language);

          return (
            <div key={idx} className="flex flex-col items-center flex-1 px-0.5">
              <div title={label}>
                <Icon size={22} className="text-white drop-shadow-md mb-2" />
              </div>
              <span className="text-[10px] font-bold text-red-400 drop-shadow-md leading-tight whitespace-nowrap" title={`${t('label.pressure')} (hPa)`}>{d.pressure} hPa</span>
              <span className="text-[10px] font-bold text-amber-300 drop-shadow-md leading-tight whitespace-nowrap" title={`${t('label.temp')} (°C)`}>{d.temp}°C</span>
              <span className="text-[10px] font-bold text-sky-300 drop-shadow-md leading-tight whitespace-nowrap" title={`${t('label.humidity')} (%)`}>{d.humidity}%</span>
              <span className="text-[10px] font-bold text-teal-300 drop-shadow-md leading-tight whitespace-nowrap" title={`${t('label.wind')} (km/h)`}>{d.wind} km/h</span>
              <span className="text-[10px] font-bold text-indigo-300 drop-shadow-md leading-tight whitespace-nowrap" title={`${t('label.rain')} (mm)`}>{d.precip} mm</span>
              
              {/* Índice de Incomodidad de Thom */}
              <div 
                className={`mt-1.5 px-1 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${thomIndex.bgClass} ${thomIndex.bgClass.includes('text-white') ? '' : 'text-slate-900'} shadow-sm text-center leading-none`}
                title={`${t('label.fatigue_calc')}: ${thomIndex.label}`}
              >
                {thomIndex.shortLabel}
              </div>

              {/* Alerta Delta P */}
              <div 
                className={`mt-1 px-0.5 py-0.5 rounded text-[7px] font-bold uppercase tracking-wider ${deltaAlert.bgClass} shadow-sm text-center leading-tight flex flex-col`}
                title={`Variación de presión en 24h: ${deltaAlert.detail}`}
              >
                <span>{deltaAlert.label}</span>
                <span className="opacity-90">{deltaAlert.detail}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Multi-Line Chart */}
      <div className="h-40 w-full -ml-2 mt-4 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_5%,black_95%,transparent)]">
        <ResponsiveContainer width="105%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 20, right: 0, left: 0, bottom: 0 }} barCategoryGap={2}>
            <defs>
              <linearGradient id="colorPressure" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0.2} />
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

            <YAxis yAxisId="pressure" hide domain={[minPressure, maxPressure]} />
            <YAxis yAxisId="temp" hide domain={[minTemp, maxTemp]} />
            <YAxis yAxisId="humidity" hide domain={[0, 100]} />
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

          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Bottom row: Day names */}
      <div className="flex justify-between w-full px-2 mt-2">
        {chartData.map((d, idx) => (
          <div key={idx} className="flex-1 flex justify-center">
            <span className={`text-xs drop-shadow-sm ${d.name === 'HOY' || d.name === 'TODAY' ? 'font-black tracking-widest text-white opacity-100' : 'capitalize opacity-90'}`}>
              {d.name}
            </span>
          </div>
        ))}
      </div>

      {/* Guía de Lectura del Gráfico */}
      <div className="mt-5 pt-4 px-4 border-t border-slate-700/50 text-[10px] sm:text-xs">
        <h4 className="font-bold text-slate-400 mb-2 uppercase tracking-wider text-[9px]">{t('label.how_to_interpret')}</h4>
        <div className="flex flex-col gap-y-2 opacity-90">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm bg-gradient-to-b from-[#ef4444]/40 to-transparent border-t-2 border-[#f87171] flex-shrink-0"></span>
            <span><strong className="text-slate-200">{t('label.mountain')}</strong> {t('label.pressure_desc')}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-1 rounded-full bg-[#fcd34d] flex-shrink-0"></span>
            <span><strong className="text-slate-200">{t('label.yellow_line')}</strong> {t('label.temperature')}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-sm bg-[#a5b4fc]/50 flex-shrink-0"></span>
            <span><strong className="text-slate-200">{t('label.indigo_cols')}</strong> {t('label.rain_vol')}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-gradient-to-r from-[#2563eb] to-[#7e22ce] flex-shrink-0"></span>
            <span><strong className="text-slate-200">{t('label.bg_aurora')}</strong> {t('label.humidity_risk')}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
