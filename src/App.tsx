import React from 'react';
import { LocationProvider, useLocationContext } from './context/LocationContext';
import { useWeather } from './hooks/useWeather';
import { getWeatherInfo, getThomsDiscomfortIndex, getMigraineRisk, getWindDirection, getWindChillIndex, getStormPotential, getAqiInfo, getPollenLevel } from './utils/weatherCodes';
import WeatherSvgEffects, { wmoToCondition } from './components/WeatherSvgEffects';
import { RAIN_INTENSITY, generateWeatherParticles } from './utils/weatherParticles';
import AuroraSvg from './components/AuroraSvg';
import { MapPin, Search, HelpCircle, Wind } from 'lucide-react';
import { DailyForecast } from './components/DailyForecast';
import { FutureForecast } from './components/FutureForecast';
import { HistoricalPressure } from './components/HistoricalPressure';
import { LocationSelector } from './components/LocationSelector';
import { LanguageProvider, useLanguage, type Language } from './context/LanguageContext';
import { HelpModal } from './components/HelpModal';
import { OtherLocations } from './components/OtherLocations';

function WeatherDashboard() {
  const { currentLocation } = useLocationContext();
  const { data, loading, error } = useWeather(currentLocation);
  const [isSelectorOpen, setIsSelectorOpen] = React.useState(false);
  const [isHelpOpen, setIsHelpOpen] = React.useState(false);
  const { language, setLanguage, t } = useLanguage();
  const [activePopover, setActivePopover] = React.useState<'migraine' | 'fatigue' | null>(null);
  const [previewCondition, setPreviewCondition] = React.useState<string>('auto');

  React.useEffect(() => {
    const handleClose = () => setActivePopover(null);
    window.addEventListener('click', handleClose);
    return () => window.removeEventListener('click', handleClose);
  }, []);

  const tempDelta3h = data?.hourly[3] ? Math.round((data.hourly[3].temperature - data.current.temperature) * 10) / 10 : null;
  const tempDelta6h = data?.hourly[6] ? Math.round((data.hourly[6].temperature - data.current.temperature) * 10) / 10 : null;

  const rainNext3h = React.useMemo(() => {
    if (!data?.hourly.length) return 0;
    let sum = 0;
    for (let i = 0; i < Math.min(3, data.hourly.length); i++) {
      sum += data.hourly[i].precipitation || 0;
    }
    return Math.round(sum * 10) / 10;
  }, [data]);

  const rainNext6h = React.useMemo(() => {
    if (!data?.hourly.length) return 0;
    let sum = 0;
    for (let i = 0; i < Math.min(6, data.hourly.length); i++) {
      sum += data.hourly[i].precipitation || 0;
    }
    return Math.round(sum * 10) / 10;
  }, [data]);

  const rainNext24h = React.useMemo(() => {
    if (!data?.hourly.length) return 0;
    let sum = 0;
    for (let i = 0; i < data.hourly.length; i++) {
      sum += data.hourly[i].precipitation || 0;
    }
    return Math.round(sum * 10) / 10;
  }, [data]);

  const nightType = React.useMemo<'ecuatorial' | 'torrida' | 'tropical' | null>(() => {
    if (!data?.hourly.length) return null;
    const tonight = data.hourly.filter(h => {
      const hour = new Date(h.time + 'Z').getHours();
      return hour >= 20 || hour <= 6;
    });
    if (!tonight.length) return null;
    const minTonight = Math.min(...tonight.map(h => h.temperature));
    if (minTonight > 25) return 'ecuatorial';
    if (minTonight >= 25) return 'torrida';
    if (minTonight >= 20) return 'tropical';
    return null;
  }, [data]);

  const currentWindChill = React.useMemo(() => {
    if (!data) return null;
    return getWindChillIndex(data.current.temperature, data.current.windSpeed, language);
  }, [data, language]);

  const stormPotential = React.useMemo(() => {
    if (!data?.hourly.length) return null;
    const cape = data.hourly[0]?.cape ?? 0;
    const result = getStormPotential(cape, language);
    return result.level !== 'none' ? result : null;
  }, [data, language]);

  const frostType = React.useMemo<'ice' | 'frost' | null>(() => {
    if (!data?.hourly.length) return null;
    const overnight = data.hourly.filter(h => {
      const hour = new Date(h.time + 'Z').getHours();
      return hour >= 20 || hour <= 8;
    });
    if (!overnight.length) return null;
    const minTemp = Math.min(...overnight.map(h => h.temperature));
    const dewPoints = overnight.map(h => h.dewPoint).filter((d): d is number => d !== undefined);
    const minDewPoint = dewPoints.length ? Math.min(...dewPoints) : Infinity;
    if (minTemp <= 0) return 'ice';
    if (minTemp <= 2 || minDewPoint <= 0) return 'frost';
    return null;
  }, [data]);

  const precipOnset = React.useMemo<{ minutesFromNow: number; type: 'rain' | 'snow' | 'freezing' } | null>(() => {
    if (!data?.hourly.length) return null;
    const now = Date.now();
    for (let i = 0; i < data.hourly.length; i++) {
      const h = data.hourly[i];
      if (h.precipitation >= 0.1) {
        const onsetTime = new Date(h.time + 'Z').getTime();
        const minutesFromNow = Math.max(0, Math.round((onsetTime - now) / 60000));
        const isSnow = (h.snowfall ?? 0) > 0 || (h.weatherCode >= 71 && h.weatherCode <= 77) || h.weatherCode === 85 || h.weatherCode === 86;
        const isFreezing = h.weatherCode === 56 || h.weatherCode === 57 || h.weatherCode === 66 || h.weatherCode === 67;
        return { minutesFromNow, type: isSnow ? 'snow' : isFreezing ? 'freezing' : 'rain' };
      }
    }
    return null;
  }, [data]);

  const windAlert = React.useMemo<{ gusts: number; minutesFromNow: number; level: 'breezy' | 'strong' | 'gale' | 'storm' } | null>(() => {
    if (!data) return null;
    const getLevel = (gusts: number): 'breezy' | 'strong' | 'gale' | 'storm' | null => {
      if (gusts >= 89) return 'storm';
      if (gusts >= 62) return 'gale';
      if (gusts >= 40) return 'strong';
      if (gusts >= 28) return 'breezy';
      return null;
    };
    const currentLevel = getLevel(data.current.windGusts);
    if (currentLevel) return { gusts: Math.round(data.current.windGusts), minutesFromNow: 0, level: currentLevel };
    // Look ahead up to 12h for strengthening gusts
    const now = Date.now();
    for (const h of data.hourly.slice(1, 13)) {
      const level = getLevel(h.windGusts);
      if (level) {
        const minutesFromNow = Math.max(0, Math.round((new Date(h.time + 'Z').getTime() - now) / 60000));
        return { gusts: Math.round(h.windGusts), minutesFromNow, level };
      }
    }
    return null;
  }, [data]);

  // Must be before early returns (Rules of Hooks)
  const rainIntensity = RAIN_INTENSITY[data?.current.weatherCode ?? -1] ?? 0;
  const weatherParticles = React.useMemo(() => generateWeatherParticles(rainIntensity), [rainIntensity]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-400 to-blue-200 text-white font-sans">{language === 'en' ? 'Loading weather data...' : 'Cargando datos del clima...'}</div>;
  }

  if (error) {
    return <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-red-400 to-red-200 text-white font-sans">Error: {error}</div>;
  }

  if (!data) return null;

  const { icon: WeatherIcon, label: weatherLabel, color: weatherColor, animation: weatherAnimation, bgClass: weatherBg } = getWeatherInfo(data.current.weatherCode, language);

  const wmoCondition = previewCondition === 'auto'
    ? wmoToCondition(data.current.weatherCode)
    : previewCondition as ReturnType<typeof wmoToCondition>;

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
    language,
    data.hourly[0]?.cape
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
          {/* Preview weather condition (dev) */}
          <select
            value={previewCondition}
            onChange={(e) => setPreviewCondition(e.target.value)}
            className="appearance-none bg-white/25 border-0 text-white rounded-full py-1.5 pl-3.5 pr-7 text-xs font-bold focus:ring-2 focus:ring-white/50 backdrop-blur-md cursor-pointer outline-none hover:bg-white/30 transition-all"
            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='none' stroke='rgba(255,255,255,0.7)' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round' d='M2 4l4 4 4-4'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.6rem center' }}
          >
            <option value="auto" className="text-slate-800 bg-white">auto</option>
            <option value="clear" className="text-slate-800 bg-white">☀️ clear</option>
            <option value="partly-cloudy" className="text-slate-800 bg-white">⛅ partly</option>
            <option value="cloudy" className="text-slate-800 bg-white">☁️ cloudy</option>
            <option value="rain" className="text-slate-800 bg-white">🌧️ rain</option>
            <option value="storm" className="text-slate-800 bg-white">⛈️ storm</option>
            <option value="snow" className="text-slate-800 bg-white">❄️ snow</option>
            <option value="fog" className="text-slate-800 bg-white">🌫️ fog</option>
            <option value="aurora" className="text-slate-800 bg-white">🌌 aurora</option>
          </select>

          {/* Selector de idioma */}
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as Language)}
            className="appearance-none bg-white/25 border-0 text-white rounded-full py-1.5 pl-3.5 pr-7 text-xs font-bold focus:ring-2 focus:ring-white/50 backdrop-blur-md cursor-pointer outline-none hover:bg-white/30 transition-all uppercase tracking-wider"
            style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='none' stroke='rgba(255,255,255,0.7)' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round' d='M2 4l4 4 4-4'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.6rem center' }}
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
        {/* Hero with animated weather background */}
        <div className="relative my-4 rounded-2xl">
          {/* SVG atmospheric effects layer */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <svg viewBox="0 0 300 200" className="w-full h-full" preserveAspectRatio="xMidYMin slice" overflow="hidden">
              {previewCondition === 'aurora'
                ? <AuroraSvg />
                : <WeatherSvgEffects
                    condition={wmoCondition}
                    weatherParticles={weatherParticles}
                    fogGradientId="hero-fog"
                    rainIntensity={rainIntensity}
                  />
              }
            </svg>
            {wmoCondition === 'storm' && previewCondition !== 'aurora' && (
              <div className="absolute inset-0 bg-white opacity-0 anim-lightning" />
            )}
          </div>
          <section className="text-center">
          <div className="flex justify-center mb-4 drop-shadow-xl">
            <div className="relative">
              <WeatherIcon size={120} className={`${weatherColor} ${weatherAnimation}`} strokeWidth={1} />
            </div>
          </div>

          <div className="flex justify-center items-center gap-6 sm:gap-8 mb-2">
            {/* Left Progress Bar: Migraine Risk */}
            <div
              className="relative flex flex-col items-center gap-1 cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                setActivePopover(activePopover === 'migraine' ? null : 'migraine');
              }}
            >
              {/* Custom Popover */}
              <div
                className={`absolute bottom-full mb-3 left-1/2 -translate-x-1/2 flex flex-col gap-1 w-64 bg-slate-900/95 backdrop-blur-md border border-white/15 p-3.5 rounded-2xl shadow-2xl z-50 text-[11px] text-white text-left transition-all duration-200 origin-bottom ${activePopover === 'migraine' ? 'opacity-100 scale-100 translate-y-0 visible' : 'opacity-0 scale-95 translate-y-2 invisible pointer-events-none'
                  }`}
                onClick={(e) => e.stopPropagation()}
              >
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
                  className={`w-full rounded-full transition-all duration-1000 ease-out ${currentMigraineRisk.score >= 6 ? 'bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.6)]' :
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
            <div
              className="relative flex flex-col items-center gap-1 cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                setActivePopover(activePopover === 'fatigue' ? null : 'fatigue');
              }}
            >
              {/* Custom Popover */}
              <div
                className={`absolute bottom-full mb-3 left-1/2 -translate-x-1/2 flex flex-col gap-1 w-64 bg-slate-900/95 backdrop-blur-md border border-white/15 p-3.5 rounded-2xl shadow-2xl z-50 text-[11px] text-white text-left transition-all duration-200 origin-bottom ${activePopover === 'fatigue' ? 'opacity-100 scale-100 translate-y-0 visible' : 'opacity-0 scale-95 translate-y-2 invisible pointer-events-none'
                  }`}
                onClick={(e) => e.stopPropagation()}
              >
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

              {data.current.temperature < 10 && currentWindChill ? (
                <>
                  <span className="text-[9px] font-bold tracking-widest opacity-75 uppercase">{isEn ? 'WCI' : 'POLAR'}</span>
                  <div className="relative w-2.5 h-16 bg-white/15 rounded-full overflow-hidden flex flex-col justify-end border border-white/10 shadow-inner">
                    <div
                      className={`w-full rounded-full transition-all duration-1000 ease-out ${currentWindChill.value <= -25 ? 'bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.6)]' :
                          currentWindChill.value <= -10 ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]' :
                            currentWindChill.value <= 0 ? 'bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.6)]' : 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]'
                        }`}
                      style={{ height: `${Math.max(10, Math.min(100, ((15 - currentWindChill.value) / 30) * 100))}%` }}
                    />
                  </div>
                  <span className="text-[11px] font-black">{Math.round(currentWindChill.value)}°</span>
                </>
              ) : (
                <>
                  <span className="text-[9px] font-bold tracking-widest opacity-75 uppercase">FAT.</span>
                  <div className="relative w-2.5 h-16 bg-white/15 rounded-full overflow-hidden flex flex-col justify-end border border-white/10 shadow-inner">
                    <div
                      className={`w-full rounded-full transition-all duration-1000 ease-out ${currentThom.value >= 27 ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]' :
                          currentThom.value >= 24 ? 'bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.6)]' :
                            currentThom.value >= 21 ? 'bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.6)]' : 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]'
                        }`}
                      style={{ height: `${Math.max(10, Math.min(100, ((currentThom.value - 15) / 15) * 100))}%` }}
                    />
                  </div>
                  <span className="text-[11px] font-black">{Math.round(currentThom.value)}</span>
                </>
              )}
            </div>

          </div>

          <p className="text-xl opacity-90 mb-1 capitalize">{weatherLabel}</p>

          <div className="flex items-center justify-center gap-4 text-sm font-medium opacity-80 mb-4">
            <span>{t('label.humidity')}: {Math.round(data.current.humidity)}%</span>
            <span className="w-px h-4 bg-white/30" />
            <span className="flex items-center gap-1">
              <Wind size={14} />
              {data.current.windSpeed > 0
                ? `${Math.round(data.current.windSpeed)} km/h ${getWindDirection(data.current.windDirection, language)}`
                : t('label.wind_calm')}
              {data.current.windSpeed > 5 && data.current.temperature >= 15 && (
                <span className="text-emerald-300 text-[10px] ml-1">({t('label.wind_heat_relief')})</span>
              )}
              {data.current.windSpeed > 5 && data.current.temperature < 10 && (
                <span className="text-blue-200 text-[10px] ml-1">({t('label.wind_chill_warning')})</span>
              )}
            </span>
          </div>

          {data.pressureTrend && (Math.abs(data.pressureTrend.delta3h) >= 2 || Math.abs(data.pressureTrend.delta6h) >= 3) && (
            <div className="flex gap-2 justify-center mt-2">
              {Math.abs(data.pressureTrend.delta3h) >= 2 && (
                <div className="bg-white/20 backdrop-blur-md rounded-full py-1.5 px-3.5 text-xs font-bold text-white border border-white/10 flex items-center gap-1.5 shadow-md">
                  <span className="text-white/60 uppercase tracking-wider text-[10px]">3h</span>
                  <span className={data.pressureTrend.delta3h <= -2 ? 'text-orange-200' : 'text-blue-200'}>
                    {data.pressureTrend.delta3h > 0 ? '+' : ''}{data.pressureTrend.delta3h} hPa
                  </span>
                </div>
              )}
              {Math.abs(data.pressureTrend.delta6h) >= 3 && (
                <div className={`rounded-full py-1.5 px-3.5 text-xs font-bold border flex items-center gap-1.5 shadow-md backdrop-blur-md ${data.pressureTrend.delta6h <= -5 ? 'bg-red-500/30 border-red-400/40 text-white' : data.pressureTrend.delta6h <= -3 ? 'bg-amber-500/30 border-amber-400/40 text-white' : 'bg-blue-500/20 border-blue-400/30 text-white'}`}>
                  <span className="uppercase tracking-wider text-[10px] opacity-90">6h</span>
                  <span>
                    {data.pressureTrend.delta6h > 0 ? '+' : ''}{data.pressureTrend.delta6h} hPa
                  </span>
                  {data.pressureTrend.delta6h <= -3 && <span title={isEn ? "Significant 6h drop (Main migraine trigger)" : "Caída severa en 6h (Principal riesgo)"}>⚡</span>}
                </div>
              )}
            </div>
          )}

          {tempDelta3h !== null && tempDelta6h !== null && (
            <div className="flex gap-2 justify-center mt-2">
              <div className="bg-white/20 backdrop-blur-md rounded-full py-1.5 px-3.5 text-xs font-bold text-white border border-white/10 flex items-center gap-1.5 shadow-md">
                <span className="text-white/60 uppercase tracking-wider text-[10px]">3h</span>
                <span className={tempDelta3h > 0 ? 'text-orange-200' : tempDelta3h < 0 ? 'text-sky-200' : 'text-white'}>
                  {tempDelta3h > 0 ? '+' : ''}{tempDelta3h}°C
                </span>
              </div>
              <div className={`rounded-full py-1.5 px-3.5 text-xs font-bold border flex items-center gap-1.5 shadow-md backdrop-blur-md ${tempDelta6h >= 3 ? 'bg-red-500/30 border-red-400/40 text-white' : tempDelta6h > 0 ? 'bg-amber-500/30 border-amber-400/40 text-white' : 'bg-white/20 border-white/10 text-white'}`}>
                <span className={`uppercase tracking-wider text-[10px] ${tempDelta6h > 0 ? 'opacity-90' : 'text-white/60'}`}>6h</span>
                <span>
                  {tempDelta6h > 0 ? '+' : ''}{tempDelta6h}°C
                </span>
                {tempDelta6h >= 3 && <span title={isEn ? "Sharp temperature rise in 6h" : "Subida fuerte de temperatura en 6h"}>🔥</span>}
              </div>
            </div>
          )}

          {precipOnset && (
            <div className="flex flex-col items-center gap-1.5 mt-2">
              <div className={`rounded-full py-1.5 px-3.5 text-xs font-bold border flex items-center gap-1.5 shadow-md backdrop-blur-md ${
                precipOnset.type === 'snow' ? 'bg-cyan-500/30 border-cyan-400/40' :
                precipOnset.type === 'freezing' ? 'bg-indigo-500/30 border-indigo-400/40' :
                'bg-blue-500/30 border-blue-400/40'
              } text-white`}>
                <span>{precipOnset.type === 'snow' ? '❄️' : precipOnset.type === 'freezing' ? '🌨️' : '🌧️'}</span>
                <span className="uppercase tracking-wider text-[10px] text-white/70">
                  {precipOnset.type === 'snow' ? (isEn ? 'Snow' : 'Nieve') : precipOnset.type === 'freezing' ? (isEn ? 'Freezing rain' : 'Lluvia helada') : (isEn ? 'Rain' : 'Lluvia')}
                </span>
                {precipOnset.type === 'rain' && (() => {
                  const mmh = rainNext3h / 3;
                  const label = mmh >= 10 ? (isEn ? 'violent' : 'torrencial')
                    : mmh >= 2.5 ? (isEn ? 'heavy' : 'fuerte')
                    : mmh >= 0.5 ? (isEn ? 'moderate' : 'moderada')
                    : (isEn ? 'light' : 'leve');
                  return <><span className="text-white/40 text-[10px]">·</span><span className="text-white/80 text-[10px] font-semibold">{label}</span></>;
                })()}
                <span className="font-black">
                  {precipOnset.minutesFromNow <= 0
                    ? (isEn ? 'now' : 'ahora')
                    : precipOnset.minutesFromNow < 60
                      ? `${isEn ? 'in' : 'en'} ${precipOnset.minutesFromNow}min`
                      : `${isEn ? 'in' : 'en'} ${Math.floor(precipOnset.minutesFromNow / 60)}h${precipOnset.minutesFromNow % 60 >= 15 ? `${precipOnset.minutesFromNow % 60}min` : ''}`
                  }
                </span>
              </div>
              <div className="flex gap-1.5 justify-center">
                {([{ label: '3h', value: rainNext3h }, { label: '6h', value: rainNext6h }, { label: '24h', value: rainNext24h }] as const).map(({ label, value }) => (
                  <div key={label} className={`rounded-full py-1 px-2.5 text-[10px] font-bold border flex items-center gap-1 backdrop-blur-md ${
                    value > 0
                      ? precipOnset.type === 'snow' ? 'bg-cyan-500/20 border-cyan-400/30 text-cyan-200' :
                        precipOnset.type === 'freezing' ? 'bg-indigo-500/20 border-indigo-400/30 text-indigo-200' :
                        'bg-blue-500/20 border-blue-400/30 text-blue-200'
                      : 'bg-white/5 border-white/10 text-white/30'
                  }`}>
                    <span className="opacity-60">{label}</span>
                    <span className="font-black">{value > 0 ? `${value}mm` : '—'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {windAlert && (
            <div className="flex flex-col items-center gap-1.5 mt-2">
              <div className={`rounded-full py-1.5 px-3.5 text-xs font-bold border flex items-center gap-1.5 shadow-md backdrop-blur-md text-white ${
                windAlert.level === 'storm' ? 'bg-red-600/40 border-red-400/50' :
                windAlert.level === 'gale'  ? 'bg-orange-500/35 border-orange-400/45' :
                windAlert.level === 'strong'? 'bg-amber-500/30 border-amber-400/40' :
                                              'bg-teal-500/25 border-teal-400/35'
              }`}>
                <span>{windAlert.level === 'storm' ? '🌪️' : windAlert.level === 'gale' ? '💨' : '🌬️'}</span>
                <span className="uppercase tracking-wider text-[10px] text-white/70">
                  {windAlert.level === 'storm' ? (isEn ? 'Storm' : 'Borrasca') :
                   windAlert.level === 'gale'  ? (isEn ? 'Gale' : 'Vendaval') :
                   windAlert.level === 'strong'? (isEn ? 'Strong wind' : 'Viento fuerte') :
                                                 (isEn ? 'Breezy' : 'Ventoso')}
                </span>
                <span className="text-white/40 text-[10px]">·</span><span className="text-white font-bold text-[11px]">{windAlert.gusts} km/h</span>
                <span className="font-black">
                  {windAlert.minutesFromNow <= 0
                    ? (isEn ? 'now' : 'ahora')
                    : windAlert.minutesFromNow < 60
                      ? `${isEn ? 'in' : 'en'} ${windAlert.minutesFromNow}min`
                      : `${isEn ? 'in' : 'en'} ${Math.floor(windAlert.minutesFromNow / 60)}h`}
                </span>
              </div>
            </div>
          )}

          {nightType && (
            <div className={`mt-4 flex items-center justify-center gap-2 backdrop-blur-md rounded-full py-2 px-4 text-sm font-bold border shadow-md mx-auto w-fit ${
              nightType === 'ecuatorial'
                ? 'bg-purple-500/30 border-purple-400/40 text-white'
                : nightType === 'torrida'
                  ? 'bg-red-500/30 border-red-400/40 text-white'
                  : 'bg-amber-500/20 border-amber-400/30 text-white'
            }`}>
              <span className="text-lg">
                {nightType === 'ecuatorial' ? '🌊' : nightType === 'torrida' ? '🔥' : '🌙'}
              </span>
              <span>{t(`label.night_${nightType}`)}</span>
              <span className="text-[10px] opacity-80 font-normal">— {t(`label.night_${nightType}_desc`)}</span>
            </div>
          )}

          {frostType && (
            <div className={`mt-4 flex items-center justify-center gap-2 backdrop-blur-md rounded-full py-2 px-4 text-sm font-bold border shadow-md mx-auto w-fit ${
              frostType === 'ice'
                ? 'bg-cyan-900/40 border-cyan-400/40 text-white'
                : 'bg-slate-700/40 border-slate-400/30 text-white'
            }`}>
              <span className="text-lg">{frostType === 'ice' ? '🧊' : '🌨️'}</span>
              <span>{frostType === 'ice' ? (isEn ? 'Ice Risk' : 'Riesgo de Hielo') : (isEn ? 'Frost Risk' : 'Riesgo de Helada')}</span>
              <span className="text-[10px] opacity-80 font-normal">— {frostType === 'ice' ? (isEn ? 'sub-zero tonight' : 'bajo cero esta noche') : (isEn ? 'near-freezing overnight' : 'casi congelación overnight')}</span>
            </div>
          )}

          {stormPotential && (
            <div className={`mt-4 flex items-center justify-center gap-2 backdrop-blur-md rounded-full py-2 px-4 text-sm font-bold border shadow-md mx-auto w-fit ${
              stormPotential.level === 'extreme' ? 'bg-red-600/30 border-red-400/40 text-white' :
              stormPotential.level === 'strong' ? 'bg-orange-500/30 border-orange-400/40 text-white' :
              stormPotential.level === 'moderate' ? 'bg-yellow-400/20 border-yellow-400/40 text-white' :
              'bg-sky-400/20 border-sky-400/30 text-white'
            }`}>
              <span className="text-lg">⛈️</span>
              <span>{isEn ? 'Storm Potential' : 'Potencial Tormenta'}: {stormPotential.label}</span>
              <span className="text-[10px] opacity-80 font-normal">— CAPE {Math.round(stormPotential.cape)} J/kg</span>
            </div>
          )}

          {/* Shrimp Progress Bar */}
          {Math.floor(Math.max(0, currentThom.value - 15) / 3) > 0 && (
            <div className="flex flex-col items-center gap-1 mt-6">
              <span className="text-[9px] font-bold tracking-widest opacity-75 uppercase">{language === 'en' ? 'Shrimp Fatigue' : 'Índice Gamba'}</span>
              <div className="flex justify-center items-center h-12 gap-1 p-3 border border-white/10 bg-white/5 rounded-full backdrop-blur-sm">
                {Array.from({ length: 4 }).map((_, idx) => (
                  <span 
                    key={idx} 
                    className={`text-5xl transition-all duration-300 ${idx < Math.min(4, Math.floor(Math.max(0, currentThom.value - 15) / 3)) ? 'opacity-100 scale-100' : 'opacity-20 scale-90'}`}
                    >
                    🦐
                  </span>
                ))}
              </div>
              <span className="text-[10px] font-mono font-bold text-white/70">
                Thom: {currentThom.value.toFixed(1)} DI
              </span>
            </div>
          )}

          {/* Penguin Wind Chill (winter) */}
          {data.current.temperature < 10 && currentWindChill && (
            <div className="flex flex-col items-center gap-1 mt-6">
              <span className="text-[9px] font-bold tracking-widest opacity-75 uppercase">{isEn ? 'Wind Chill' : 'Índice Polar'}</span>
              <div className="flex justify-center items-center h-12 gap-1 p-3 border border-white/10 bg-white/5 rounded-full backdrop-blur-sm">
                {Array.from({ length: 4 }).map((_, idx) => {
                  const wci = currentWindChill.value;
                  const activePenguins = wci > 0 ? 1 : wci > -10 ? 2 : wci > -25 ? 3 : 4;
                  return (
                    <span
                      key={idx}
                      className={`text-5xl transition-all duration-300 ${idx < activePenguins ? 'opacity-100 scale-100' : 'opacity-20 scale-90'}`}
                    >
                      🐧
                    </span>
                  );
                })}
              </div>
              <span className="text-[10px] font-mono font-bold text-white/70">
                {isEn ? 'Feels like' : 'Sensación'}: {currentWindChill.value.toFixed(1)}°C
              </span>
            </div>
          )}
        </section>
        </div>

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

        {/* Air Quality Card */}
        {data.airQuality && data.airQuality.currentAqi !== null && (() => {
          const aq = data.airQuality!;
          const aqiInfo = getAqiInfo(aq.currentAqi!, language);
          const pollens: { emoji: string; name: string; value: number | null }[] = [
            { emoji: '🌿', name: isEn ? 'Grass' : 'Gramín.', value: aq.grassPollen },
            { emoji: '🌳', name: isEn ? 'Birch' : 'Abedul', value: aq.birchPollen },
            { emoji: '🌸', name: isEn ? 'Alder' : 'Aliso', value: aq.alderPollen },
            { emoji: '🌾', name: isEn ? 'Mugwort' : 'Artemisa', value: aq.mugwortPollen },
            { emoji: '🫒', name: isEn ? 'Olive' : 'Olivo', value: aq.olivePollen },
            { emoji: '🌻', name: isEn ? 'Ragweed' : 'Ambrosía', value: aq.ragweedPollen },
          ].filter(p => p.value !== null && p.value > 0);

          return (
            <section className="bg-white/95 backdrop-blur-md rounded-3xl p-4 sm:p-5 shadow-lg text-slate-800">
              <h3 className="text-sm uppercase tracking-wider mb-2 opacity-70 font-semibold">{isEn ? 'Air Quality' : 'Calidad del Aire'}</h3>

              <div className="flex items-center gap-3 mb-2">
                <span className="text-3xl font-extrabold text-slate-900">{Math.round(aq.currentAqi!)} AQI</span>
                <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${aqiInfo.bgClass}`}>{aqiInfo.label}</span>
              </div>

              {(aq.currentPm25 !== null || aq.currentPm10 !== null) && (
                <p className="text-xs text-slate-500 font-medium mb-3">
                  {aq.currentPm25 !== null && `PM2.5: ${aq.currentPm25.toFixed(1)} μg/m³`}
                  {aq.currentPm25 !== null && aq.currentPm10 !== null && '  ·  '}
                  {aq.currentPm10 !== null && `PM10: ${aq.currentPm10.toFixed(1)} μg/m³`}
                </p>
              )}

              {/* AQI range bar */}
              <div className="mb-3">
                <div className="relative w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 via-yellow-400 via-orange-400 to-purple-600 opacity-80"></div>
                  <div
                    className="absolute top-0 h-full w-1.5 bg-slate-900 rounded-full border border-white shadow-sm transition-all duration-1000 ease-out"
                    style={{ left: `calc(${Math.max(0, Math.min(100, (aq.currentAqi! / 100) * 100))}% - 3px)` }}
                  />
                </div>
                <div className="flex justify-between text-[9px] text-slate-400 font-bold mt-1 uppercase tracking-wider">
                  <span>{isEn ? 'Good (0)' : 'Bueno (0)'}</span>
                  <span>(100+) {isEn ? 'Extreme' : 'Extremo'}</span>
                </div>
              </div>

              {pollens.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-100">
                  {pollens.map(p => {
                    const level = getPollenLevel(p.value!, language);
                    if (!level) return null;
                    return (
                      <span key={p.name} className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${level.bgClass}`}>
                        {p.emoji} {p.name}: {level.label}
                      </span>
                    );
                  })}
                </div>
              )}
            </section>
          );
        })()}

        {/* Daily Forecast and Chart */}
        <DailyForecast daily={data.daily} hourly={data.hourly} timezone={currentLocation.timezone} />

        {/* Future Forecast */}
        <FutureForecast daily={data.daily} />

        {/* Other Locations */}
        <OtherLocations
          currentLocation={currentLocation}
          currentWeatherData={{
            temperature: data.current.temperature,
            surfacePressure: data.current.surfacePressure,
            elevation: data.current.elevation || 0,
          }}
        />

        {/* Historical Weather Comparison */}
        <HistoricalPressure
          historical={data.historical}
          currentWeatherCode={data.current.weatherCode}
          currentTemp={data.current.temperature}
          currentHumidity={data.current.humidity}
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
