import React from 'react';
import { LocationProvider } from './context/LocationContext';
import { useLocationContext } from './hooks/useLocationContext';
import { useWeather } from './hooks/useWeather';
import { useNow } from './hooks/useNow';
import {
  getWeatherInfo,
  getThomsDiscomfortIndex,
  getMigraineRisk,
  getWindChillIndex,
  getStormPotential,
  wmoToCondition,
} from './utils/weatherCodes';
import { getNightType, getFrostType, getWindAlert } from './utils/heroAlerts';
import { AlertBadges } from './components/AlertBadges';
import { AirQualityCard } from './components/AirQualityCard';
import { StaleDataBanner } from './components/StaleDataBanner';
import WeatherSvgEffects from './components/WeatherSvgEffects';
import { RAIN_INTENSITY, generateWeatherParticles } from './utils/weatherParticles';
import AuroraSvg from './components/AuroraSvg';
import { MapPin, Search, HelpCircle, Cloud } from 'lucide-react';
import { DailyForecast } from './components/DailyForecast';
import { FutureForecast } from './components/FutureForecast';
import { HistoricalPressure } from './components/HistoricalPressure';
import { LocationSelector } from './components/LocationSelector';
import { LanguageProvider } from './context/LanguageContext';
import { useLanguage, type Language } from './hooks/useLanguage';
import { OtherLocations } from './components/OtherLocations';
import { TodayTomorrowSummary } from './components/TodayTomorrowSummary';
import { RainStrip } from './components/RainStrip';
import { LightStrip } from './components/LightStrip';
import { HeroIcon } from './components/HeroIcon';
import { ConditionLine } from './components/ConditionLine';
import { migraineLevelIndex } from './utils/heroMetrics';
import { SunEventLine } from './components/SunEventLine';
import { FreshnessLine } from './components/FreshnessLine';
import { PullIndicator } from './components/PullIndicator';
import { HeroMetrics } from './components/HeroMetrics';
import { PreviewSelect } from './components/PreviewSelect';
import { FeltTemp } from './components/FeltTemp';
import { FatiguePopoverContent } from './components/FatiguePopoverContent';
import { purgeStaleCache } from './utils/cacheCleanup';

// Code-split: the help text and the long-range outlook (with its two drill-down dialogs and
// the seasonal/ensemble/ERA5 logic) load in their own chunks after the first paint
const HelpModal = React.lazy(() =>
  import('./components/HelpModal').then((m) => ({ default: m.HelpModal })),
);
const LongRangeOutlook = React.lazy(() =>
  import('./components/LongRangeOutlook').then((m) => ({ default: m.LongRangeOutlook })),
);

// eslint-disable-next-line sonarjs/cognitive-complexity
function WeatherDashboard() {
  const { currentLocation } = useLocationContext();
  const { data, loading, error, stale, fetchedAt, refreshing, refresh } =
    useWeather(currentLocation);
  const [isSelectorOpen, setIsSelectorOpen] = React.useState(false);
  const [isHelpOpen, setIsHelpOpen] = React.useState(false);
  const summaryDialogRef = React.useRef<HTMLDialogElement>(null);
  const { language, setLanguage, t } = useLanguage();
  const [activePopover, setActivePopover] = React.useState<'migraine' | 'fatigue' | null>(null);
  const [previewCondition, setPreviewCondition] = React.useState<string>('auto');
  // Dev tool: the weather-condition preview select only shows with ?preview in the URL
  const [showPreview] = React.useState(() =>
    new URLSearchParams(globalThis.location.search).has('preview'),
  );
  const now = useNow();

  React.useEffect(() => {
    purgeStaleCache();
  }, []);

  React.useEffect(() => {
    const handleClose = () => setActivePopover(null);
    window.addEventListener('click', handleClose);
    return () => window.removeEventListener('click', handleClose);
  }, []);

  const tempDelta3h = data?.hourly[3]
    ? Math.round((data.hourly[3].temperature - data.current.temperature) * 10) / 10
    : null;
  const tempDelta6h = data?.hourly[6]
    ? Math.round((data.hourly[6].temperature - data.current.temperature) * 10) / 10
    : null;

  // Badge inputs — pure helpers in utils/heroAlerts.ts (tested); cheap, so not memoized
  const hourly = data?.hourly ?? [];
  // "Night" = local hours at the location (API timezone, else the saved location's zone)
  const locationTz = data?.timezone ?? currentLocation.timezone;
  const nightType = getNightType(hourly, locationTz);
  const frostType = getFrostType(hourly, locationTz);
  const windAlert = data ? getWindAlert(data.current.windGusts, hourly, now) : null;

  // Not memoized: cheap, and React Compiler treats `data.current` like a ref and can't preserve a manual memo on it
  const currentWindChill = data
    ? getWindChillIndex(data.current.temperature, data.current.windSpeed, language)
    : null;
  const penguinFelt = getPenguinFelt(
    data?.current.apparentTemperature,
    currentWindChill?.value,
  );

  const stormPotential = React.useMemo(() => {
    if (!data?.hourly.length) return null;
    const cape = data.hourly[0]?.cape ?? 0;
    const result = getStormPotential(cape, language);
    return result.level !== 'none' ? result : null;
  }, [data, language]);

  // Must be before early returns (Rules of Hooks)
  const rainIntensity = RAIN_INTENSITY[data?.current.weatherCode ?? -1] ?? 0;
  const weatherParticles = React.useMemo(
    () => generateWeatherParticles(rainIntensity),
    [rainIntensity],
  );

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-400 to-blue-200 text-white font-sans"
        aria-live="polite"
      >
        {t('app.loading')}
      </div>
    );
  }

  // Only reached when there is nothing to show (no network and no last-good copy)
  if (error && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-b from-slate-700 to-slate-900 text-white font-sans">
        <div className="max-w-sm text-center flex flex-col items-center gap-3" role="alert">
          <Cloud size={48} strokeWidth={1.2} className="text-slate-300" aria-hidden="true" />
          <h1 className="text-lg font-bold">{t('app.error.title')}</h1>
          <p className="text-sm text-slate-300">{t('app.error.detail')}</p>
          <button
            type="button"
            onClick={refresh}
            className="mt-2 px-5 py-2 rounded-full bg-white text-slate-900 text-sm font-bold hover:bg-sky-100 transition-colors"
          >
            {t('app.retry')}
          </button>
          <p className="text-[11px] text-slate-400 break-all">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const todayDaily = data.daily.find((d) => {
    const dDate = new Date(d.date);
    dDate.setHours(0, 0, 0, 0);
    const t = new Date(now);
    t.setHours(0, 0, 0, 0);
    return dDate.getTime() === t.getTime();
  });
  const isNight =
    todayDaily?.sunrise && todayDaily?.sunset
      ? now < new Date(todayDaily.sunrise + 'Z').getTime() ||
        now > new Date(todayDaily.sunset + 'Z').getTime()
      : false;

  const {
    icon: WeatherIcon,
    label: weatherLabel,
    color: weatherColor,
    animation: weatherAnimation,
    bgClass: weatherBg,
  } = getWeatherInfo(data.current.weatherCode, language, isNight);

  const wmoCondition =
    previewCondition === 'auto'
      ? wmoToCondition(data.current.weatherCode)
      : (previewCondition as ReturnType<typeof wmoToCondition>);

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const todayIndex = data.daily.findIndex((d) => {
    const dDate = new Date(d.date);
    dDate.setHours(0, 0, 0, 0);
    return dDate.getTime() === today.getTime();
  });

  const yesterday = todayIndex > 0 ? data.daily[todayIndex - 1] : null;
  const currentDeltaP = yesterday
    ? Math.round(data.current.surfacePressure - yesterday.meanPressure)
    : 0;

  const currentThom = getThomsDiscomfortIndex(
    data.current.temperature,
    data.current.humidity,
    language,
  );
  const currentMigraineRisk = getMigraineRisk(
    currentDeltaP,
    data.current.surfacePressure,
    data.current.humidity,
    data.daily.find((d) => new Date(d.date).setHours(0, 0, 0, 0) === today.getTime())
      ?.precipitation || 0,
    language,
    data.hourly[0]?.cape,
  );

  const isEn = language === 'en';
  const isPolar = data.current.temperature < 10 && currentWindChill != null;

  let pressureText: string;
  if (data.current.surfacePressure > 1022) {
    pressureText = isEn ? 'high pressure' : 'presión alta';
  } else if (data.current.surfacePressure < 1000) {
    pressureText = isEn ? 'low pressure' : 'presión baja';
  } else {
    pressureText = isEn ? 'normal pressure' : 'presión normal';
  }

  let humidityText: string;
  if (data.current.humidity >= 70) {
    humidityText = isEn ? 'high humidity' : 'humedad alta';
  } else if (data.current.humidity >= 40) {
    humidityText = isEn ? 'comfortable humidity' : 'humedad confortable';
  } else {
    humidityText = isEn ? 'low humidity' : 'humedad baja';
  }
  const pressureHumDesc = isEn
    ? `${pressureText} and ${humidityText}`
    : `${pressureText} y ${humidityText}`;

  // eslint-disable-next-line sonarjs/cognitive-complexity
  const getTranslatedLocationName = (name: string, lang: Language) => {
    if (currentLocation.id === 'gps') return lang === 'en' ? 'Current (GPS)' : 'Actual (GPS)';
    if (currentLocation.id === 'basel') return lang === 'en' ? 'Basel' : 'Basilea';
    if (currentLocation.id === 'reykjavik') return lang === 'en' ? 'Reykjavik' : 'Reikiavik';
    if (currentLocation.id === 'taipei') return lang === 'en' ? 'Taipei' : 'Taipéi';
    return name;
  };

  // --- Computed display values extracted from JSX to avoid nested ternaries ---

  const alertProps = {
    pressureTrend: data.pressureTrend,
    tempDelta3h,
    tempDelta6h,
    windAlert,
    nightType,
    frostType,
    stormPotential,
    isFog: wmoCondition === 'fog',
    weatherCode: data.current.weatherCode,
    onOpenDetails: () => summaryDialogRef.current?.showModal(),
  };

  let migraineBarClass: string;
  if (currentMigraineRisk.score >= 6)
    migraineBarClass = 'bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.6)]';
  else if (currentMigraineRisk.score >= 4)
    migraineBarClass = 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]';
  else if (currentMigraineRisk.score >= 3)
    migraineBarClass = 'bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.6)]';
  else if (currentMigraineRisk.score >= 2)
    migraineBarClass = 'bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.6)]';
  else migraineBarClass = 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]';

  const migraineLevelWord = t(`migr.level.${migraineLevelIndex(currentMigraineRisk.score)}`);
  const migraineTextClass =
    [
      'text-emerald-300',
      'text-emerald-300',
      'text-yellow-300',
      'text-orange-300',
      'text-red-300',
      'text-red-300',
      'text-purple-300',
    ][currentMigraineRisk.score] ?? 'text-emerald-300';

  let windChillBarClass: string;
  if (!currentWindChill || currentWindChill.value > 0)
    windChillBarClass = 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]';
  else if (currentWindChill.value <= -25)
    windChillBarClass = 'bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.6)]';
  else if (currentWindChill.value <= -10)
    windChillBarClass = 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]';
  else windChillBarClass = 'bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.6)]';

  let thomBarClass: string;
  if (currentThom.value >= 27) thomBarClass = 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]';
  else if (currentThom.value >= 24)
    thomBarClass = 'bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.6)]';
  else if (currentThom.value >= 21)
    thomBarClass = 'bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.6)]';
  else thomBarClass = 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]';

  /* eslint-disable sonarjs/cognitive-complexity */
  return (
    <div
      className={`min-h-screen bg-gradient-to-b ${weatherBg || 'from-blue-400 to-blue-200'} text-white p-2 sm:p-4 font-sans selection:bg-blue-300 transition-all duration-1000 ease-in-out`}
    >
      <header className="flex justify-between items-center gap-2 mb-1 px-2 sm:px-0">
        {/* min-w-0 + truncate: long names (e.g. Corral de Almaguer) shrink instead of pushing the controls off-screen */}
        <button
          onClick={() => setIsSelectorOpen(true)}
          className="flex items-center gap-2 min-w-0 hover:opacity-80 transition-opacity"
        >
          <MapPin className="text-white shrink-0" />
          <h1 className="text-xl font-semibold truncate">
            {getTranslatedLocationName(currentLocation.name, language)}
          </h1>
        </button>
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {showPreview && (
            <PreviewSelect value={previewCondition} onChange={setPreviewCondition} />
          )}

          {/* Selector de idioma */}
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as Language)}
            aria-label="Language / Idioma"
            className="appearance-none bg-white/25 border-0 text-white rounded-full py-1.5 pl-3.5 pr-7 text-xs font-bold focus:ring-2 focus:ring-white/50 backdrop-blur-md cursor-pointer outline-none hover:bg-white/30 transition-all uppercase tracking-wider"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='none' stroke='rgba(255,255,255,0.7)' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round' d='M2 4l4 4 4-4'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 0.6rem center',
            }}
          >
            <option value="es" className="text-slate-800 font-semibold bg-white">
              ES
            </option>
            <option value="en" className="text-slate-800 font-semibold bg-white">
              EN
            </option>
          </select>

          {/* Botón de ayuda */}
          <button
            onClick={() => setIsHelpOpen(true)}
            className="p-2 bg-white/20 rounded-full backdrop-blur-sm hover:bg-white/30 transition-colors"
            title={language === 'en' ? 'Help & Science' : 'Ayuda y Ciencia'}
          >
            <HelpCircle size={18} />
          </button>

          <button
            onClick={() => setIsSelectorOpen(true)}
            aria-label={language === 'en' ? 'Search location' : 'Buscar ubicación'}
            className="p-2 bg-white/20 rounded-full backdrop-blur-sm hover:bg-white/30 transition-colors"
          >
            <Search size={18} />
          </button>
        </div>
      </header>

      <PullIndicator onRefresh={refresh} />

      {stale && fetchedAt !== null && (
        <StaleDataBanner
          fetchedAt={fetchedAt}
          now={now}
          refreshing={refreshing}
          onRetry={refresh}
        />
      )}

      <main className="flex flex-col gap-6">
        {/* Hero with animated weather background */}
        <div className="relative mb-4 rounded-2xl">
          {/* SVG atmospheric effects layer */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden">
            <svg
              viewBox="0 0 300 200"
              className="w-full h-full"
              preserveAspectRatio="xMidYMin slice"
              overflow="hidden"
            >
              {previewCondition === 'aurora' ? (
                <AuroraSvg />
              ) : (
                <WeatherSvgEffects
                  condition={wmoCondition}
                  weatherParticles={weatherParticles}
                  fogGradientId="hero-fog"
                  rainIntensity={rainIntensity}
                  windGusts={data.current.windGusts}
                  isNight={isNight}
                />
              )}
            </svg>
            {wmoCondition === 'storm' && previewCondition !== 'aurora' && (
              <div className="absolute inset-0 bg-white opacity-0 anim-lightning" />
            )}
          </div>
          <section className="text-center pt-6">
            <div className="flex justify-center items-center gap-4 sm:gap-8 mb-2">
              {/* Left Progress Bar: Migraine Risk */}
              <div
                // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- wrapper contains positioned popover; layout preserved
                role="button"
                tabIndex={0}
                className="relative flex flex-col items-center gap-1 cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  setActivePopover(activePopover === 'migraine' ? null : 'migraine');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.stopPropagation();
                    setActivePopover(activePopover === 'migraine' ? null : 'migraine');
                  }
                }}
              >
                {/* Custom Popover */}
                {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */}
                <div
                  className={`absolute top-full mt-3 left-0 flex flex-col gap-1 w-64 bg-slate-900/95 backdrop-blur-md border border-white/15 p-3.5 rounded-2xl shadow-2xl z-50 text-[11px] text-white text-left transition-all duration-200 origin-top-left ${
                    activePopover === 'migraine'
                      ? 'opacity-100 scale-100 translate-y-0 visible'
                      : 'opacity-0 scale-95 translate-y-2 invisible pointer-events-none'
                  }`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <span className="font-bold border-b border-white/10 pb-1 mb-1 text-xs text-purple-300 flex items-center justify-between">
                    <span>
                      {language === 'en' ? 'Migraine Risk Score' : 'Riesgo de Migraña'}
                    </span>
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

                <span className="text-[9px] font-bold tracking-widest opacity-75 uppercase">
                  MIGR.
                </span>
                <div className="relative w-2.5 h-16 bg-white/15 rounded-full overflow-hidden flex flex-col justify-end border border-white/10 shadow-inner">
                  <div
                    className={`w-full rounded-full transition-all duration-1000 ease-out ${migraineBarClass}`}
                    style={{
                      height: `${(currentMigraineRisk.score / 6) * 100}%`,
                    }}
                  />
                </div>
                <span className="text-[11px] font-black">{currentMigraineRisk.score}</span>
                {/* Zero-width wrapper: the level word never widens the gauge column */}
                <span
                  className="absolute left-1/2 top-full mt-0.5 flex w-0 justify-center overflow-visible"
                  title={t('hero.migr.level').replace('{level}', migraineLevelWord)}
                >
                  <span
                    className={`whitespace-nowrap text-[9px] font-bold uppercase leading-none tracking-wide ${migraineTextClass}`}
                  >
                    {migraineLevelWord}
                  </span>
                </span>
              </div>

              {/* Temperature + weather icon */}
              <div className="flex items-center gap-1">
                <h2 className="text-6xl font-light">{Math.round(data.current.temperature)}°</h2>
                <FeltTemp value={data.current.apparentTemperature} />
                <HeroIcon
                  icon={WeatherIcon}
                  className={`${weatherColor} ${weatherAnimation}`}
                  nightCloudy={isNight && [1, 2, 3].includes(data.current.weatherCode)}
                />
              </div>

              {/* Right Progress Bar: Fatigue Level */}
              <div
                // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- wrapper contains positioned popover; layout preserved
                role="button"
                tabIndex={0}
                className="relative flex flex-col items-center gap-1 cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  setActivePopover(activePopover === 'fatigue' ? null : 'fatigue');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.stopPropagation();
                    setActivePopover(activePopover === 'fatigue' ? null : 'fatigue');
                  }
                }}
              >
                {/* Custom Popover */}
                {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events */}
                <div
                  className={`absolute top-full mt-3 right-0 flex flex-col gap-1 w-64 bg-slate-900/95 backdrop-blur-md border border-white/15 p-3.5 rounded-2xl shadow-2xl z-50 text-[11px] text-white text-left transition-all duration-200 origin-top-right ${
                    activePopover === 'fatigue'
                      ? 'opacity-100 scale-100 translate-y-0 visible'
                      : 'opacity-0 scale-95 translate-y-2 invisible pointer-events-none'
                  }`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <FatiguePopoverContent
                    polar={isPolar}
                    thom={currentThom}
                    windChill={currentWindChill}
                  />
                </div>

                {isPolar && currentWindChill ? (
                  <>
                    <span className="text-[9px] font-bold tracking-widest opacity-75 uppercase">
                      {isEn ? 'WCI' : 'POLAR'}
                    </span>
                    <div className="relative w-2.5 h-16 bg-white/15 rounded-full overflow-hidden flex flex-col justify-end border border-white/10 shadow-inner">
                      <div
                        className={`w-full rounded-full transition-all duration-1000 ease-out ${windChillBarClass}`}
                        style={{
                          height: `${Math.max(10, Math.min(100, ((15 - currentWindChill.value) / 30) * 100))}%`,
                        }}
                      />
                    </div>
                    <span className="text-[11px] font-black" title={t('hero.wci.title')}>
                      {Math.round(currentWindChill.value)}
                    </span>
                  </>
                ) : (
                  <>
                    <span className="text-[9px] font-bold tracking-widest opacity-75 uppercase">
                      FAT.
                    </span>
                    <div className="relative w-2.5 h-16 bg-white/15 rounded-full overflow-hidden flex flex-col justify-end border border-white/10 shadow-inner">
                      <div
                        className={`w-full rounded-full transition-all duration-1000 ease-out ${thomBarClass}`}
                        style={{
                          height: `${Math.max(10, Math.min(100, ((currentThom.value - 15) / 15) * 100))}%`,
                        }}
                      />
                    </div>
                    <span className="text-[11px] font-black">
                      {Math.round(currentThom.value)}
                    </span>
                  </>
                )}
              </div>
            </div>

            <ConditionLine
              label={weatherLabel}
              max={todayDaily?.maxTemp}
              min={todayDaily?.minTemp}
            />

            <HeroMetrics
              humidity={data.current.humidity}
              windSpeed={data.current.windSpeed}
              windDirection={data.current.windDirection}
              windGusts={data.current.windGusts}
              uvIndex={data.airQuality?.uvIndex}
            />
            <SunEventLine daily={data.daily} now={now} timezone={locationTz} />

            {/* Severe alerts: banners under the condition line, above the rain strip */}
            <AlertBadges {...alertProps} part="urgent" />

            {/* Rain in the next 12 h: sentence + hourly bars (replaces the rain alert tile) */}
            <RainStrip
              hours={data.summaryHours}
              now={now}
              timezone={locationTz}
              onOpenDetails={() => summaryDialogRef.current?.showModal()}
            />

            {/* Outdoor light (lux) over the next daylight block */}
            <LightStrip hours={data.summaryHours} now={now} timezone={locationTz} />

            {/* Shrimp Progress Bar */}
            {Math.floor(Math.max(0, currentThom.value - 15) / 3) > 0 && (
              <div className="flex flex-col items-center gap-1 mt-2 mb-3">
                <span className="text-[9px] font-bold tracking-widest opacity-75 uppercase">
                  {language === 'en' ? 'Shrimp Fatigue' : 'Índice Gamba'}
                </span>
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
              <div className="flex flex-col items-center gap-1 mt-2 mb-3">
                <span className="text-[9px] font-bold tracking-widest opacity-75 uppercase">
                  {isEn ? 'Wind Chill' : 'Índice Polar'}
                </span>
                <div className="flex justify-center items-center h-12 gap-1 p-3 border border-white/10 bg-white/5 rounded-full backdrop-blur-sm">
                  {Array.from({ length: 4 }).map((_, idx) => {
                    const wci = currentWindChill.value;
                    let activePenguins: number;
                    if (wci > 0) activePenguins = 1;
                    else if (wci > -10) activePenguins = 2;
                    else if (wci > -25) activePenguins = 3;
                    else activePenguins = 4;
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
                  {t('hero.penguin.felt').replace('{n}', String(penguinFelt))}
                </span>
              </div>
            )}

            {/* Today & Tomorrow: one teaser line, details in a dialog */}
            <TodayTomorrowSummary
              data={data}
              now={now}
              placeName={getTranslatedLocationName(currentLocation.name, language)}
              timezone={currentLocation.timezone}
              dialogRef={summaryDialogRef}
            />

            {/* Alert badges — grouped by category, each group is its own flex row */}
            <AlertBadges {...alertProps} />

            {!stale && fetchedAt !== null && (
              <FreshnessLine
                fetchedAt={fetchedAt}
                refreshing={refreshing}
                onRefresh={refresh}
              />
            )}
          </section>
        </div>

        {/* Pressure/Humidity + Air Quality — 2-column on mobile */}
        <div className="grid grid-cols-2 gap-3">
          {/* Pressure and Humidity */}
          <section
            className={`bg-gradient-to-br from-white to-indigo-50 rounded-2xl p-3 shadow-lg text-slate-800 flex flex-col gap-2 ${!(data.airQuality && data.airQuality.currentAqi !== null) ? 'col-span-2' : ''}`}
          >
            <h3 className="text-xs uppercase tracking-widest text-slate-500 font-bold leading-tight">
              {t('title.pressure_humidity')}
            </h3>

            <div className="flex flex-col gap-1">
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black text-slate-900 leading-none">
                  {Math.round(data.current.surfacePressure)}
                </span>
                <span className="text-xs text-slate-400 font-bold uppercase">hPa</span>
              </div>
              <div className="relative w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 via-emerald-400 to-orange-500 opacity-80" />
                <div
                  className="absolute top-0 h-full w-1 bg-slate-900 rounded-full border border-white shadow-sm transition-all duration-1000 ease-out"
                  style={{
                    left: `calc(${Math.max(0, Math.min(100, ((Math.round(data.current.surfacePressure) - 980) / 70) * 100))}% - 2px)`,
                  }}
                />
              </div>
              <div className="flex justify-between text-xs text-slate-400 font-bold">
                <span>980</span>
                <span>1050</span>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black text-slate-900 leading-none">
                  {Math.round(data.current.humidity)}%
                </span>
                <span className="text-xs text-slate-400 font-bold uppercase">
                  {isEn ? 'RH' : 'HR'}
                </span>
              </div>
              <div className="relative w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-orange-400 via-emerald-400 to-blue-600 opacity-80" />
                <div
                  className="absolute top-0 h-full w-1 bg-slate-900 rounded-full border border-white shadow-sm transition-all duration-1000 ease-out"
                  style={{
                    left: `calc(${Math.max(0, Math.min(100, data.current.humidity))}% - 2px)`,
                  }}
                />
              </div>
              <div className="flex justify-between text-xs text-slate-400 font-bold">
                <span>{isEn ? 'Dry' : 'Seco'}</span>
                <span>{isEn ? 'Wet' : 'Húm.'}</span>
              </div>
            </div>

            <p className="text-xs text-slate-500 font-medium leading-tight capitalize">
              {pressureHumDesc}
            </p>
          </section>

          {/* Air Quality Card */}
          {data.airQuality && data.airQuality.currentAqi !== null && (
            <AirQualityCard
              aq={{ ...data.airQuality, currentAqi: data.airQuality.currentAqi }}
              timezone={data.timezone}
            />
          )}
        </div>

        {/* Daily Forecast and Chart */}
        <DailyForecast
          daily={data.daily}
          hourly={data.hourly}
          timezone={currentLocation.timezone}
        />

        {/* Future Forecast */}
        <FutureForecast daily={data.daily} />

        {/* Long-Range Outlook (weeks → months → seasons) — continues the timeline after the 3-day forecast */}
        <React.Suspense
          fallback={
            <div
              className="bg-slate-900/60 rounded-3xl p-6 mt-4 h-48 animate-pulse"
              aria-hidden="true"
            />
          }
        >
          <LongRangeOutlook key={currentLocation.id} location={currentLocation} />
        </React.Suspense>

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
      {isHelpOpen && (
        <React.Suspense fallback={null}>
          <HelpModal isOpen onClose={() => setIsHelpOpen(false)} />
        </React.Suspense>
      )}
    </div>
  );
  /* eslint-enable sonarjs/cognitive-complexity */
}

function getPenguinFelt(
  apparent: number | null | undefined,
  windChill: number | undefined,
): number {
  const v = typeof apparent === 'number' && Number.isFinite(apparent) ? apparent : windChill;
  return Math.round(v ?? 0);
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
