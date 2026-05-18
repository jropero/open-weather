import React from 'react';
import { LocationProvider, useLocationContext } from './context/LocationContext';
import { useWeather } from './hooks/useWeather';
import { getWeatherInfo, getThomsDiscomfortIndex, getPressureDeltaAlert, getMigraineRisk } from './utils/weatherCodes';
import { MapPin, Search } from 'lucide-react';
import { DailyForecast } from './components/DailyForecast';
import { FutureForecast } from './components/FutureForecast';
import { HistoricalPressure } from './components/HistoricalPressure';
import { LocationSelector } from './components/LocationSelector';
import { LanguageProvider, useLanguage, type Language } from './context/LanguageContext';

function WeatherDashboard() {
  const { currentLocation } = useLocationContext();
  const { data, loading, error } = useWeather(currentLocation);
  const [isSelectorOpen, setIsSelectorOpen] = React.useState(false);
  const { language, setLanguage, t } = useLanguage();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-400 to-blue-200 text-white font-sans">{language === 'en' ? 'Loading weather data...' : 'Cargando datos del clima...'}</div>;
  }

  if (error) {
    return <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-red-400 to-red-200 text-white font-sans">Error: {error}</div>;
  }

  if (!data) return null;

  const { icon: WeatherIcon, label: weatherLabel, color: weatherColor, animation: weatherAnimation } = getWeatherInfo(data.current.weatherCode, language);
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayIndex = data.daily.findIndex(d => {
    const dDate = new Date(d.date);
    dDate.setHours(0, 0, 0, 0);
    return dDate.getTime() === today.getTime();
  });

  const yesterday = todayIndex > 0 ? data.daily[todayIndex - 1] : null;
  const currentDeltaP = yesterday ? Math.round(data.current.surfacePressure - yesterday.meanPressure) : 0;

  const currentThom = getThomsDiscomfortIndex(data.current.temperature, data.current.humidity, language);
  const currentDeltaAlert = getPressureDeltaAlert(currentDeltaP, language);
  const currentMigraineRisk = getMigraineRisk(
    currentDeltaP,
    data.current.surfacePressure,
    data.current.humidity,
    data.daily.find(d => new Date(d.date).setHours(0, 0, 0, 0) === today.getTime())?.precipitation || 0,
    language
  );

  const isEn = language === 'en';
  const pressureText = data.current.surfacePressure > 1022 
    ? (isEn ? 'high pressure' : 'presión alta') 
    : data.current.surfacePressure < 1000 
      ? (isEn ? 'low pressure' : 'presión baja') 
      : (isEn ? 'normal pressure' : 'presión normal');
  const humidityText = data.current.humidity >= 70 
    ? (isEn ? 'high humidity' : 'humedad alta') 
    : data.current.humidity >= 40 
      ? (isEn ? 'comfortable humidity' : 'humedad confortable') 
      : (isEn ? 'low humidity' : 'humedad baja');
  const pressureHumDesc = isEn 
    ? `${pressureText} and ${humidityText}` 
    : `${pressureText} y ${humidityText}`;

  const getTranslatedLocationName = (name: string, lang: Language) => {
    if (currentLocation.id === 'gps') return lang === 'en' ? 'Current (GPS)' : 'Actual (GPS)';
    if (currentLocation.id === 'basel') return lang === 'en' ? 'Basel' : 'Basilea';
    if (currentLocation.id === 'reykjavik') return lang === 'en' ? 'Reykjavik' : 'Reikiavik';
    if (currentLocation.id === 'taipei') return lang === 'en' ? 'Taipei' : 'Taipéi';
    return name;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-400 to-blue-200 text-white p-2 sm:p-4 font-sans selection:bg-blue-300">
      <header className="flex justify-between items-center mb-8 px-2 sm:px-0 mt-2 sm:mt-0">
        <button onClick={() => setIsSelectorOpen(true)} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <MapPin className="text-white" />
          <h1 className="text-xl font-semibold">{getTranslatedLocationName(currentLocation.name, language)}</h1>
        </button>
        <div className="flex items-center gap-2">
          {/* Selector de idioma */}
          <select 
            value={language} 
            onChange={(e) => setLanguage(e.target.value as Language)}
            className="bg-white/25 border-0 text-white rounded-full py-1.5 px-3.5 text-xs font-bold focus:ring-2 focus:ring-white/50 backdrop-blur-md cursor-pointer outline-none hover:bg-white/30 transition-all uppercase tracking-wider"
          >
            <option value="es" className="text-slate-800 font-semibold bg-white">ES</option>
            <option value="en" className="text-slate-800 font-semibold bg-white">EN</option>
          </select>

          <button onClick={() => setIsSelectorOpen(true)} className="p-2 bg-white/20 rounded-full backdrop-blur-sm hover:bg-white/30 transition-colors">
            <Search size={18} />
          </button>
        </div>
      </header>

      <main className="flex flex-col gap-6">
        <section className="text-center my-4">
          <div className="flex justify-center mb-4 drop-shadow-xl">
            <WeatherIcon size={120} className={`${weatherColor} ${weatherAnimation}`} strokeWidth={1} />
          </div>
          <h2 className="text-6xl font-light mb-2">{Math.round(data.current.temperature)}°</h2>
          <p className="text-xl opacity-90 mb-1 capitalize">{weatherLabel}</p>
          <p className="text-sm font-medium opacity-80 mb-6">{t('label.humidity')}: {Math.round(data.current.humidity)}%</p>

          {/* Alertas Biometeorológicas Actuales */}
          <div className="flex justify-center items-center gap-3 flex-wrap">
            <div className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider ${currentThom.bgClass} ${currentThom.bgClass.includes('text-white') ? '' : 'text-slate-900'} shadow-md`} title={`Estrés Térmico: ${currentThom.label}`}>
              {t('label.fatigue')}: {currentThom.shortLabel}
            </div>

            <div className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider ${currentDeltaAlert.bgClass} shadow-md`} title={`Variación de presión respecto a ayer: ${currentDeltaAlert.detail}`}>
              Δ P: {currentDeltaAlert.label} {currentDeltaAlert.detail}
            </div>

            <div className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider ${currentMigraineRisk.bgClass} shadow-md flex items-center gap-2`} title={`Riesgo de Migraña basado en IA (DOI: 10.1111/head.14482): ${currentMigraineRisk.detail}`}>
              <span className="text-sm">🧠</span> {t('label.migraine')}: {currentMigraineRisk.label}
            </div>
          </div>

          {/* Desgloses Clínicos y Matemáticos */}
          <div className="mt-5 mx-auto max-w-sm text-left bg-white/10 backdrop-blur-md rounded-xl p-4 text-xs shadow-inner border border-white/10 flex flex-col gap-4">
            <div>
              <h4 className="font-bold opacity-90 mb-2 border-b border-white/20 pb-1.5 flex justify-between items-center">
                <span>{t('label.fatigue_calc')}</span>
                <span className="bg-black/20 px-2 py-0.5 rounded-full">{currentThom.value.toFixed(1)} DI</span>
              </h4>
              <ul className="list-disc list-inside opacity-90 space-y-1.5 font-medium ml-1">
                {currentThom.reasons.map((reason, idx) => (
                  <li key={idx} className="text-slate-200">
                    {reason}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="font-bold opacity-90 mb-2 border-b border-white/20 pb-1.5 flex justify-between items-center">
                <span>{t('label.migraine_doi')}</span>
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
          </div>
        </section>

        {/* Pressure and Humidity Highlight Card */}
        <section className="bg-white/95 backdrop-blur-md rounded-3xl p-4 sm:p-5 shadow-lg text-slate-800">
          <h3 className="text-sm uppercase tracking-wider mb-2 opacity-70 font-semibold">{t('title.pressure_humidity')}</h3>
          
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-extrabold text-slate-900">{Math.round(data.current.surfacePressure)} hPa</span>
            <span className="text-2xl font-light text-slate-400">,</span>
            <span className="text-3xl font-extrabold text-slate-900">{Math.round(data.current.humidity)}% {isEn ? 'RH' : 'HR'}</span>
          </div>

          <p className="mt-1 text-sm font-bold text-slate-600 mb-4 capitalize">
            {pressureHumDesc}
          </p>

          {/* Dos líneas de rango visual apiladas */}
          <div className="flex flex-col gap-3">
            {/* Rango Presión */}
            <div>
              <div className="relative w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-emerald-400 to-orange-500 opacity-80"></div>
                <div
                  className="absolute top-0 h-full w-1.5 bg-slate-900 rounded-full border border-white shadow-sm transition-all duration-1000 ease-out"
                  style={{ left: `calc(${Math.max(0, Math.min(100, ((Math.round(data.current.surfacePressure) - 980) / (1050 - 980)) * 100))}% - 3px)` }}
                ></div>
              </div>
              <div className="flex justify-between text-[9px] text-slate-400 font-bold mt-1 uppercase tracking-wider">
                <span>{isEn ? 'Pressure (980 hPa)' : 'Presión (980 hPa)'}</span>
                <span>(1050 hPa)</span>
              </div>
            </div>

            {/* Rango Humedad */}
            <div>
              <div className="relative w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-orange-400 via-emerald-400 to-blue-600 opacity-80"></div>
                <div
                  className="absolute top-0 h-full w-1.5 bg-slate-900 rounded-full border border-white shadow-sm transition-all duration-1000 ease-out"
                  style={{ left: `calc(${Math.max(0, Math.min(100, data.current.humidity))}% - 3px)` }}
                ></div>
              </div>
              <div className="flex justify-between text-[9px] text-slate-400 font-bold mt-1 uppercase tracking-wider">
                <span>{isEn ? 'Humidity (Dry 0%)' : 'Humedad (Seco 0%)'}</span>
                <span>{isEn ? '(Wet 100%)' : '(Húmedo 100%)'}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Daily Forecast and Chart */}
        <DailyForecast daily={data.daily} />

        {/* Future Forecast */}
        <FutureForecast daily={data.daily} />

        {/* Historical Weather Comparison */}
        <HistoricalPressure
          historical={data.historical}
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
    <LanguageProvider>
      <LocationProvider>
        <WeatherDashboard />
      </LocationProvider>
    </LanguageProvider>
  );
}
