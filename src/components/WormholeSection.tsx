import { useEffect, useState } from 'react';
import { PREDEFINED_LOCATIONS } from '../context/LocationContext';
import type { Location } from '../types/weather';
import { calculateWormholeWindSpeed, generateWormholeExplanation } from '../utils/wormhole';
import type { LocationData } from '../utils/wormhole';
import { useLanguage } from '../context/LanguageContext';
import { Wind } from 'lucide-react';

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
  } | null;
  error?: boolean;
}

export function WormholeSection({ currentLocation, currentWeatherData }: WormholeSectionProps) {
  const [otherLocationsData, setOtherLocationsData] = useState<OtherLocationData[]>([]);
  const [loading, setLoading] = useState(true);
  const { language } = useLanguage();

  useEffect(() => {
    let isMounted = true;
    const fetchOtherLocations = async () => {
      setLoading(true);
      const otherLocs = PREDEFINED_LOCATIONS.filter(loc => loc.id !== currentLocation.id && loc.id !== 'gps');

      const promises = otherLocs.map(async (loc) => {
        try {
          const url = `https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}&current=temperature_2m,pressure_msl&timezone=auto`;
          const res = await fetch(url);
          if (!res.ok) throw new Error('Failed to fetch');
          const data = await res.json();
          return {
            location: loc,
            weather: {
              temperature: data.current.temperature_2m,
              surfacePressure: data.current.pressure_msl,
              elevation: data.elevation,
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
        <h3 className="text-sm uppercase tracking-wider mb-2 opacity-70 font-semibold">
          <Wind className="inline-block mr-2" size={16} />
          {language === 'en' ? 'Wormhole Wind Speeds' : 'Velocidades de Viento de Agujero de Gusano'}
        </h3>
        <p className="text-sm text-slate-500">{language === 'en' ? 'Calculating inter-spatial wind streams...' : 'Calculando corrientes de viento interespaciales...'}</p>
      </section>
    );
  }

  const locA: LocationData = {
    name: currentLocation.name,
    P_msl: currentWeatherData.surfacePressure,
    T_c: currentWeatherData.temperature,
    z: currentWeatherData.elevation,
  };

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
}
