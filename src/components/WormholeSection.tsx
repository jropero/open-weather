import { useEffect, useState } from 'react';
import { PREDEFINED_LOCATIONS } from '../context/LocationContext';
import type { Location } from '../types/weather';
import { calculateWormholeWindSpeed, generateWormholeExplanation } from '../utils/wormhole';
//import type { LocationData } from '../utils/wormhole';
import { useLanguage, type Language } from '../context/LanguageContext';
import { Globe, Droplets, Gauge } from 'lucide-react';
import { getWeatherInfo, getThomsDiscomfortIndex } from '../utils/weatherCodes';

interface WormholeSectionProps {
  currentLocation: Location;
  currentWeatherData: {
    temperature: number;
    surfacePressure: number;
    elevation: number;
  };
}

interface OtherLocationData {
  location: Location;
  weather: {
    temperature: number;
    surfacePressure: number;
    elevation: number;
    humidity: number;
    weatherCode: number;
  } | null;
  error?: boolean;
}

const getTranslatedName = (loc: Location, lang: Language) => {
  if (loc.id === 'gps') return lang === 'en' ? 'Current (GPS)' : 'Actual (GPS)';
  if (loc.id === 'basel') return lang === 'en' ? 'Basel' : 'Basilea';
  if (loc.id === 'reykjavik') return lang === 'en' ? 'Reykjavik' : 'Reikiavik';
  if (loc.id === 'taipei') return lang === 'en' ? 'Taipei' : 'Taipéi';
  return loc.name;
};

const getPressureLevelLabel = (pressure: number, lang: Language) => {
  const isEn = lang === 'en';
  if (pressure > 1022) return isEn ? 'high' : 'alta';
  if (pressure < 1000) return isEn ? 'low' : 'baja';
  return isEn ? 'medium' : 'media';
};

export function WormholeSection({ currentLocation }: WormholeSectionProps) {
  const [otherLocationsData, setOtherLocationsData] = useState<OtherLocationData[]>([]);
  const [loading, setLoading] = useState(true);
  const { language } = useLanguage();

  // Keep references to wormhole helper functions to prevent compilation/lint errors while commented out
  if (false as boolean) {
    console.log(calculateWormholeWindSpeed, generateWormholeExplanation);
  }

  useEffect(() => {
    let isMounted = true;
    const fetchOtherLocations = async () => {
      setLoading(true);
      const otherLocs = PREDEFINED_LOCATIONS.filter(loc => loc.id !== currentLocation.id && loc.id !== 'gps');

      const promises = otherLocs.map(async (loc) => {
        try {
          const url = `https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}&current=temperature_2m,relative_humidity_2m,weather_code,pressure_msl&timezone=auto`;
          const res = await fetch(url);
          if (!res.ok) throw new Error('Failed to fetch');
          const data = await res.json();
          return {
            location: loc,
            weather: {
              temperature: data.current.temperature_2m,
              surfacePressure: data.current.pressure_msl,
              elevation: data.elevation,
              humidity: data.current.relative_humidity_2m,
              weatherCode: data.current.weather_code,
            }
          };
        } catch (error) {
          return { location: loc, weather: null, error: true };
        }
      });

      const results = await Promise.all(promises);
      if (isMounted) {
        setOtherLocationsData(results);
        setLoading(false);
      }
    };

    fetchOtherLocations();
    return () => { isMounted = false; };
  }, [currentLocation.id]);

  if (loading) {
    return (
      <section className="bg-white/95 backdrop-blur-md rounded-3xl p-4 sm:p-5 shadow-lg text-slate-800 mt-6">
        <h3 className="text-sm uppercase tracking-wider mb-2 opacity-70 font-semibold flex items-center">
          <Globe className="inline-block mr-2 text-indigo-500 animate-pulse" size={18} />
          {language === 'en' ? 'Other Locations' : 'Otras Ubicaciones'}
        </h3>
        <p className="text-sm text-slate-500">{language === 'en' ? 'Fetching current weather data...' : 'Obteniendo datos del clima...'}</p>
      </section>
    );
  }

  // ==========================================
  // ORIGINAL WORMHOLE WIND SPEED RENDERING (COMMENTED OUT TO BE RETAINED)
  // ==========================================
  /*
  const locA: LocationData = {
    name: currentLocation.name,
    P_msl: currentWeatherData.surfacePressure,
    T_c: currentWeatherData.temperature,
    z: currentWeatherData.elevation,
  };

  if (loading) {
    return (
      <section className="bg-white/95 backdrop-blur-md rounded-3xl p-4 sm:p-5 shadow-lg text-slate-800 mt-6">
        <h3 className="text-sm uppercase tracking-wider mb-2 opacity-70 font-semibold">
          <Wind className="inline-block mr-2" size={16} />
          {language === 'en' ? 'Wormhole Wind Speeds' : 'Velocidades de Viento de Agujero de Gusano'}
        </h3>
        <p className="text-sm text-slate-500">{language === 'en' ? 'Calculating inter-spatial wind streams...' : 'Calculando corrientes de viento interespaciales...'}</p>
      </section>
    );
  }

  return (
    <section className="bg-white/95 backdrop-blur-md rounded-3xl p-4 sm:p-5 shadow-lg text-slate-800 mt-6">
      <h3 className="text-sm uppercase tracking-wider mb-4 opacity-70 font-semibold flex items-center">
        <Wind className="inline-block mr-2 text-indigo-500" size={18} />
        {language === 'en' ? 'Wormhole Wind Speeds' : 'Velocidades de Viento de Agujero de Gusano'}
      </h3>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {otherLocationsData.map(({ location, weather, error }) => {
          if (error || !weather) return null;

          const locB: LocationData = {
            name: location.name,
            P_msl: weather.surfacePressure,
            T_c: weather.temperature,
            z: weather.elevation,
          };

          const result = calculateWormholeWindSpeed(locA, locB, 'km/h', language);
          const explanation = generateWormholeExplanation(result.windSpeed, locA, locB, language);

          return (
            <div key={location.id} className="bg-slate-50 border border-slate-100 rounded-2xl p-3 flex flex-col shadow-sm">
              <span className="font-bold text-slate-700 text-sm mb-1">{location.name}</span>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-2xl font-black text-indigo-600">{Math.round(result.windSpeed)}</span>
                <span className="text-xs font-bold text-slate-400">km/h</span>
              </div>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold" title={result.flowDirection}>
                {result.flowDirection}
              </p>
              <p className="text-[11px] text-slate-600 mt-2 leading-tight italic">
                {explanation}
              </p>
              {result.isChokedFlow && (
                <span className="mt-1 text-[10px] font-bold text-orange-600 bg-orange-100 px-2 py-0.5 rounded-full inline-block self-start">
                  {language === 'en' ? 'CHOKED FLOW (MACH 1)' : 'FLUJO AHOGADO (MACH 1)'}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
  */

  // ==========================================
  // NEW COMPACT OTHER LOCATIONS WEATHER VIEW
  // ==========================================
  return (
    <section className="bg-white/95 backdrop-blur-md rounded-3xl p-4 sm:p-5 shadow-lg text-slate-800 mt-6">
      <h3 className="text-sm uppercase tracking-wider mb-4 opacity-70 font-semibold flex items-center">
        <Globe className="inline-block mr-2 text-indigo-500" size={18} />
        {language === 'en' ? 'Weather in Other Locations' : 'El Clima en Otras Ubicaciones'}
      </h3>

      <div className="flex flex-col gap-2">
        {otherLocationsData.map(({ location, weather, error }) => {
          if (error || !weather) return null;

          const translatedName = getTranslatedName(location, language);
          const { icon: WeatherIcon, label: weatherLabel, colorDark: weatherColor } = getWeatherInfo(weather.weatherCode, language);
          const thom = getThomsDiscomfortIndex(weather.temperature, weather.humidity, language);

          return (
            <div key={location.id} className="bg-slate-50 hover:bg-indigo-50/20 border border-slate-100 hover:border-indigo-100 rounded-2xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-0.5">
              {/* Line 1: Location details & Current conditions */}
              <div className="flex items-center justify-between sm:justify-start gap-4 w-full sm:w-auto">
                <div className="flex items-center gap-2">
                  <div className="bg-slate-100 rounded-lg p-1 flex items-center justify-center">
                    <WeatherIcon size={20} className={weatherColor} strokeWidth={1.5} />
                  </div>
                  <div className="font-bold text-slate-700 text-sm truncate" title={`${translatedName} (${Math.round(weather.elevation)}m)`}>
                    {translatedName} <span className="text-[10px] text-slate-400 font-normal">({Math.round(weather.elevation)}m)</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-sm font-extrabold text-slate-800">{Math.round(weather.temperature)}°</span>
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider hidden sm:inline" title={weatherLabel}>
                    • {weatherLabel}
                  </span>
                </div>
              </div>

              {/* Line 2 / Right Column: Pressure and Humidity metrics */}
              <div className="flex items-center gap-4 text-[11px] text-slate-500 border-t sm:border-t-0 border-slate-100 pt-2 sm:pt-0">
                <div className="flex items-center gap-1.5" title={language === 'en' ? 'Pressure' : 'Presión'}>
                  <Gauge size={12} className="text-slate-400" />
                  <span className="font-bold text-slate-600">
                    {Math.round(weather.surfacePressure)} <span className="text-[8px] text-slate-400 font-semibold">hPa</span>{' '}
                    <span className="text-[9px] text-slate-400 font-semibold">
                      ({getPressureLevelLabel(weather.surfacePressure, language)})
                    </span>
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5" title={language === 'en' ? 'Humidity' : 'Humedad'}>
                    <Droplets size={12} className="text-sky-400" />
                    <span className="font-bold text-slate-600">{Math.round(weather.humidity)}%</span>
                  </div>
                  <span className={`text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full ${thom.bgClass} ${thom.bgClass.includes('text-white') ? '' : 'text-slate-800'} shadow-sm border border-black/5`} title={`${language === 'en' ? 'Thom Discomfort/Fatigue Level' : 'Nivel de Fatiga/Incomodidad'}: ${thom.label}`}>
                    {thom.shortLabel}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

