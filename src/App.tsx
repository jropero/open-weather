import React from 'react';
import { LocationProvider, useLocationContext } from './context/LocationContext';
import { useWeather } from './hooks/useWeather';
import { getWeatherInfo, getPressureDescription, getThomsDiscomfortIndex, getPressureDeltaAlert, getMigraineRisk } from './utils/weatherCodes';
import { MapPin, Search } from 'lucide-react';
import { DailyForecast } from './components/DailyForecast';
import { FutureForecast } from './components/FutureForecast';
import { HistoricalPressure } from './components/HistoricalPressure';
import { LocationSelector } from './components/LocationSelector';

function WeatherDashboard() {
  const { currentLocation } = useLocationContext();
  const { data, loading, error } = useWeather(currentLocation);
  const [isSelectorOpen, setIsSelectorOpen] = React.useState(false);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-400 to-blue-200 text-white">Cargando datos del clima...</div>;
  }

  if (error) {
    return <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-red-400 to-red-200 text-white">Error: {error}</div>;
  }

  if (!data) return null;

  const WeatherIcon = getWeatherInfo(data.current.weatherCode).icon;
  const weatherLabel = getWeatherInfo(data.current.weatherCode).label;
  const pressureDesc = getPressureDescription(data.current.surfacePressure);

  const today = new Date();
  today.setHours(0,0,0,0);
  const todayIndex = data.daily.findIndex(d => {
    const dDate = new Date(d.date);
    dDate.setHours(0,0,0,0);
    return dDate.getTime() === today.getTime();
  });
  
  const yesterday = todayIndex > 0 ? data.daily[todayIndex - 1] : null;
  const currentDeltaP = yesterday ? Math.round(data.current.surfacePressure - yesterday.meanPressure) : 0;

  const currentThom = getThomsDiscomfortIndex(data.current.temperature, data.current.humidity);
  const currentDeltaAlert = getPressureDeltaAlert(currentDeltaP);
  const currentMigraineRisk = getMigraineRisk(
    currentDeltaP, 
    data.current.surfacePressure, 
    data.current.humidity, 
    data.daily.find(d => new Date(d.date).setHours(0,0,0,0) === today.getTime())?.precipitation || 0
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-400 to-blue-200 text-white p-2 sm:p-4 font-sans selection:bg-blue-300">
      <header className="flex justify-between items-center mb-8 px-2 sm:px-0 mt-2 sm:mt-0">
        <button onClick={() => setIsSelectorOpen(true)} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <MapPin className="text-white" />
          <h1 className="text-xl font-semibold">{currentLocation.name}</h1>
        </button>
        <button onClick={() => setIsSelectorOpen(true)} className="p-2 bg-white/20 rounded-full backdrop-blur-sm hover:bg-white/30 transition-colors">
          <Search size={20} />
        </button>
      </header>

      <main className="flex flex-col gap-6">
        <section className="text-center my-4">
          <div className="flex justify-center mb-4 drop-shadow-xl">
            <WeatherIcon size={120} className="text-yellow-300 fill-current" strokeWidth={1} />
          </div>
          <h2 className="text-6xl font-light mb-2">{Math.round(data.current.temperature)}°</h2>
          <p className="text-xl opacity-90 mb-1">{weatherLabel}</p>
          <p className="text-sm font-medium opacity-80 mb-6">Humedad: {Math.round(data.current.humidity)}%</p>

          {/* Alertas Biometeorológicas Actuales */}
          <div className="flex justify-center items-center gap-3 flex-wrap">
            <div className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider ${currentThom.bgClass} ${currentThom.bgClass.includes('text-white') ? '' : 'text-slate-900'} shadow-md`} title={`Estrés Térmico: ${currentThom.label}`}>
              Fatiga: {currentThom.shortLabel}
            </div>
            
            <div className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider ${currentDeltaAlert.bgClass} shadow-md`} title={`Variación de presión respecto a ayer: ${currentDeltaAlert.detail}`}>
              Δ P: {currentDeltaAlert.label} {currentDeltaAlert.detail}
            </div>

            <div className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider ${currentMigraineRisk.bgClass} shadow-md flex items-center gap-2`} title={`Riesgo de Migraña basado en IA (DOI: 10.1111/head.14482): ${currentMigraineRisk.detail}`}>
              <span className="text-sm">🧠</span> Riesgo Migraña: {currentMigraineRisk.label}
            </div>
          </div>

          {/* Desglose Matemático del Riesgo */}
          <div className="mt-5 mx-auto max-w-sm text-left bg-white/10 backdrop-blur-md rounded-xl p-4 text-xs shadow-inner border border-white/10">
            <h4 className="font-bold opacity-90 mb-2 border-b border-white/20 pb-1.5 flex justify-between items-center">
              <span>Desglose Clínico (DOI: 10.1111/head.14482)</span>
              <span className="bg-black/20 px-2 py-0.5 rounded-full">{currentMigraineRisk.score} / 6 pts</span>
            </h4>
            <ul className="list-disc list-inside opacity-90 space-y-1.5 font-medium ml-1">
              {currentMigraineRisk.reasons.map((reason, idx) => (
                <li key={idx} className={reason.includes('+') ? 'text-white' : 'text-slate-300'}>
                  {reason}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Pressure Highlight Card */}
        <section className="bg-white/95 backdrop-blur-md rounded-3xl p-6 shadow-lg text-slate-800">
          <h3 className="text-sm uppercase tracking-wider mb-2 opacity-70 font-semibold">Presión Atmosférica</h3>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-extrabold">{Math.round(data.current.surfacePressure)}</span>
            <span className="text-lg opacity-80 font-medium">hPa</span>
          </div>
          <p className="mt-2 text-sm font-bold text-slate-600">{pressureDesc}</p>
        </section>

        {/* Daily Forecast and Chart */}
        <DailyForecast daily={data.daily} />

        {/* Future Forecast */}
        <FutureForecast daily={data.daily} />

        {/* Historical Pressure Comparison */}
        <HistoricalPressure 
          historical={data.historical} 
          currentPressure={data.current.surfacePressure} 
          currentWeatherCode={data.current.weatherCode}
          currentTemp={data.current.temperature}
          currentHumidity={data.current.humidity}
        />
      </main>

      <LocationSelector isOpen={isSelectorOpen} onClose={() => setIsSelectorOpen(false)} />
    </div>
  );
}

export default function App() {
  return (
    <LocationProvider>
      <WeatherDashboard />
    </LocationProvider>
  );
}
