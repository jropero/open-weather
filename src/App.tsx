import React from 'react';
import { LocationProvider, useLocationContext } from './context/LocationContext';
import { useWeather } from './hooks/useWeather';
import { getWeatherInfo, getThomsDiscomfortIndex, getMigraineRisk } from './utils/weatherCodes';
import { MapPin, Search, HelpCircle } from 'lucide-react';
import { DailyForecast } from './components/DailyForecast';
import { FutureForecast } from './components/FutureForecast';
import { HistoricalPressure } from './components/HistoricalPressure';
import { LocationSelector } from './components/LocationSelector';
import { LanguageProvider, useLanguage, type Language } from './context/LanguageContext';
import { HelpModal } from './components/HelpModal';
import { WormholeSection } from './components/WormholeSection';

function WeatherDashboard() {
  const { currentLocation } = useLocationContext();
  const { data, loading, error } = useWeather(currentLocation);
  const [isSelectorOpen, setIsSelectorOpen] = React.useState(false);
  const [isHelpOpen, setIsHelpOpen] = React.useState(false);
  const { language, setLanguage, t } = useLanguage();

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-400 to-blue-200 text-white font-sans">{language === 'en' ? 'Loading weather data...' : 'Cargando datos del clima...'}</div>;
  }

  if (error) {
    return <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-red-400 to-red-200 text-white font-sans">Error: {error}</div>;
  }

  if (!data) return null;

  const { icon: WeatherIcon, label: weatherLabel, color: weatherColor, animation: weatherAnimation, bgClass: weatherBg } = getWeatherInfo(data.current.weatherCode, language);
  
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
    <div className={`min-h-screen bg-gradient-to-b ${weatherBg || 'from-blue-400 to-blue-200'} text-white p-2 sm:p-4 font-sans selection:bg-blue-300 transition-all duration-1000 ease-in-out`}>
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

          {/* Botón de ayuda */}
          <button 
            onClick={() => setIsHelpOpen(true)} 
            className="p-2 bg-white/20 rounded-full backdrop-blur-sm hover:bg-white/30 transition-colors"
            title={language === 'en' ? 'Help & Science' : 'Ayuda y Ciencia'}
          >
            <HelpCircle size={18} />
          </button>

          <button onClick={() => setIsSelectorOpen(true)} className="p-2 bg-white/20 rounded-full backdrop-blur-sm hover:bg-white/30 transition-colors">
            <Search size={18} />
          </button>
        </div>
      </header>

      <main className="flex flex-col gap-6">
        <section className="text-center my-4">
          <div className="flex justify-center mb-4 drop-shadow-xl">
            <div className="relative">
              <WeatherIcon size={120} className={`${weatherColor} ${weatherAnimation}`} strokeWidth={1} />
            </div>
          </div>

          <div className="flex justify-center items-center gap-6 sm:gap-8 mb-2">
            {/* Left Progress Bar: Migraine Risk */}
            <div className="relative group flex flex-col items-center gap-1 cursor-pointer">
              {/* Custom Popover */}
              <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col gap-1 w-64 bg-slate-900/95 backdrop-blur-md border border-white/15 p-3.5 rounded-2xl shadow-2xl z-50 text-[11px] text-white text-left pointer-events-none transition-all duration-200">
                <span className="font-bold border-b border-white/10 pb-1 mb-1 text-xs text-purple-300 flex items-center justify-between">
                  <span>{language === 'en' ? 'Migraine Risk Score' : 'Riesgo de Migraña'}</span>
                  <span>{currentMigraineRisk.score}/6 pts</span>
                </span>
                <div className="flex flex-col gap-1.5">
                  {currentMigraineRisk.reasons.map((reason, idx) => (
                    <div key={idx} className="flex items-start gap-1">
                      <span className="text-purple-400">•</span>
                      <span>{reason}</span>
                    </div>
                  ))}
                </div>
                <span className="text-[10px] text-slate-400 mt-1 border-t border-white/10 pt-1">
                  {language === 'en' 
                    ? 'Based on pressure changes, absolute pressure, humidity, and rain.' 
                    : 'Basado en cambios de presión, presión absoluta, humedad y lluvia.'}
                </span>
              </div>

              <span className="text-[9px] font-bold tracking-widest opacity-75 uppercase">MIGR.</span>
              <div className="relative w-2.5 h-16 bg-white/15 rounded-full overflow-hidden flex flex-col justify-end border border-white/10 shadow-inner">
                <div 
                  className={`w-full rounded-full transition-all duration-1000 ease-out ${
                    currentMigraineRisk.score >= 6 ? 'bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.6)]' :
                    currentMigraineRisk.score >= 4 ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]' :
                    currentMigraineRisk.score >= 3 ? 'bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.6)]' :
                    currentMigraineRisk.score >= 2 ? 'bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.6)]' : 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]'
                  }`}
                  style={{ height: `${(currentMigraineRisk.score / 6) * 100}%` }}
                />
              </div>
              <span className="text-[11px] font-black">{currentMigraineRisk.score}</span>
            </div>

            {/* Temperature Display */}
            <h2 className="text-6xl font-light">{Math.round(data.current.temperature)}°</h2>

            {/* Right Progress Bar: Fatigue Level */}
            <div className="relative group flex flex-col items-center gap-1 cursor-pointer">
              {/* Custom Popover */}
              <div className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 hidden group-hover:flex flex-col gap-1 w-64 bg-slate-900/95 backdrop-blur-md border border-white/15 p-3.5 rounded-2xl shadow-2xl z-50 text-[11px] text-white text-left pointer-events-none transition-all duration-200">
                <span className="font-bold border-b border-white/10 pb-1 mb-1 text-xs text-indigo-300 flex items-center justify-between">
                  <span>{language === 'en' ? 'Discomfort Index' : 'Índice de Incomodidad'}</span>
                  <span>{currentThom.value.toFixed(1)} DI</span>
                </span>
                <div className="flex flex-col gap-1.5 font-mono text-[10px]">
                  {currentThom.reasons.map((reason, idx) => (
                    <div key={idx} className="flex items-start gap-1">
                      <span className="text-indigo-400">•</span>
                      <span>{reason}</span>
                    </div>
                  ))}
                </div>
                <span className="text-[10px] text-slate-400 mt-1 border-t border-white/10 pt-1">
                  {language === 'en'
                    ? "Thom's Index tracks biological stress combined from heat & humidity."
                    : 'El Índice de Thom mide el estrés biológico del calor y la humedad combinados.'}
                </span>
              </div>

              <span className="text-[9px] font-bold tracking-widest opacity-75 uppercase">FAT.</span>
              <div className="relative w-2.5 h-16 bg-white/15 rounded-full overflow-hidden flex flex-col justify-end border border-white/10 shadow-inner">
                <div 
                  className={`w-full rounded-full transition-all duration-1000 ease-out ${
                    currentThom.value >= 27 ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]' :
                    currentThom.value >= 24 ? 'bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.6)]' :
                    currentThom.value >= 21 ? 'bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.6)]' : 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]'
                  }`}
                  style={{ height: `${Math.max(10, Math.min(100, ((currentThom.value - 15) / 15) * 100))}%` }}
                />
              </div>
              <span className="text-[11px] font-black">{Math.round(currentThom.value)}</span>
            </div>
          </div>

          <p className="text-xl opacity-90 mb-1 capitalize">{weatherLabel}</p>
          <p className="text-sm font-medium opacity-80 mb-4">{t('label.humidity')}: {Math.round(data.current.humidity)}%</p>

          {data.pressureTrend && (
            <div className="flex gap-2 justify-center mt-2">
              <div className="bg-white/20 backdrop-blur-md rounded-full py-1.5 px-3.5 text-xs font-bold text-white border border-white/10 flex items-center gap-1.5 shadow-md">
                <span className="text-white/60 uppercase tracking-wider text-[10px]">3h</span>
                <span className={data.pressureTrend.delta3h <= -2 ? 'text-orange-200' : data.pressureTrend.delta3h > 2 ? 'text-blue-200' : ''}>
                  {data.pressureTrend.delta3h > 0 ? '+' : ''}{data.pressureTrend.delta3h} hPa
                </span>
              </div>
              <div className={`rounded-full py-1.5 px-3.5 text-xs font-bold border flex items-center gap-1.5 shadow-md backdrop-blur-md ${data.pressureTrend.delta6h <= -5 ? 'bg-red-500/30 border-red-400/40 text-white' : data.pressureTrend.delta6h <= -3 ? 'bg-amber-500/30 border-amber-400/40 text-white' : 'bg-white/20 border-white/10 text-white'}`}>
                <span className={`uppercase tracking-wider text-[10px] ${data.pressureTrend.delta6h <= -3 ? 'opacity-90' : 'text-white/60'}`}>6h</span>
                <span>
                  {data.pressureTrend.delta6h > 0 ? '+' : ''}{data.pressureTrend.delta6h} hPa
                </span>
                {data.pressureTrend.delta6h <= -3 && <span title={isEn ? "Significant 6h drop (Main migraine trigger)" : "Caída severa en 6h (Principal riesgo)"}>⚡</span>}
              </div>
            </div>
          )}
        </section>

        {/* Pressure and Humidity Highlight Card */}
        <section className="bg-white/95 backdrop-blur-md rounded-3xl p-4 sm:p-5 shadow-lg text-slate-800">
          <h3 className="text-sm uppercase tracking-wider mb-2 opacity-70 font-semibold">{t('title.pressure_humidity')}</h3>
          
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-extrabold text-slate-900">{Math.round(data.current.surfacePressure)} hPa</span>
            <span className="text-2xl font-light text-slate-400">,</span>
            <span className="text-3xl font-extrabold text-slate-900">{Math.round(data.current.humidity)}% {isEn ? 'RH' : 'HR'}</span>
          </div>

          <p className="mt-1 text-sm font-bold text-slate-600 mb-2 capitalize">
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
        <DailyForecast daily={data.daily} hourly={data.hourly} />

        {/* Future Forecast */}
        <FutureForecast daily={data.daily} />

        {/* Historical Weather Comparison */}
        <HistoricalPressure
          historical={data.historical}
          currentWeatherCode={data.current.weatherCode}
          currentTemp={data.current.temperature}
          currentHumidity={data.current.humidity}
        />

        {/* Wormhole Wind Speeds */}
        <WormholeSection 
          currentLocation={currentLocation} 
          currentWeatherData={{
            temperature: data.current.temperature,
            surfacePressure: data.current.surfacePressure,
            elevation: data.current.elevation || 0,
          }} 
        />
      </main>

      <LocationSelector isOpen={isSelectorOpen} onClose={() => setIsSelectorOpen(false)} />
      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
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
