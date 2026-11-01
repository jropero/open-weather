import { useState, useEffect } from 'react';
import type { Location, WeatherData, DailyWeather, HourlyWeather, AirQualityData, SummaryHour } from '../types/weather';

function getModelParam(lat: number, lon: number): string {
  const isSwiss = lat >= 45.8 && lat <= 47.8 && lon >= 5.9 && lon <= 10.5;
  return isSwiss ? '&models=meteoswiss_icon_ch2' : '';
}

export function useWeather(location: Location) {
  const [data, setData] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchWeather() {
      if (!location.latitude || !location.longitude) return;

      setLoading(true);
      setError(null);

      try {
        const modelParam = getModelParam(location.latitude, location.longitude);
        // Fetch 1 (UTC): current + hourly only — hourly timestamps must be UTC so +Z parsing works throughout the app
        const currentUrl = `https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,wind_gusts_10m,wind_direction_10m,pressure_msl&hourly=temperature_2m,relative_humidity_2m,pressure_msl,precipitation,precipitation_probability,apparent_temperature,weather_code,wind_speed_10m,wind_gusts_10m,dew_point_2m,snowfall,cape&past_days=8&timezone=UTC${modelParam}`;
        // Fetch 2 (auto): all daily variables including sunrise/sunset — utc_offset_seconds in the response lets us convert sunrise/sunset back to UTC strings
        const dailyUrl = `https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}&daily=weather_code,temperature_2m_max,temperature_2m_min,pressure_msl_mean,relative_humidity_2m_mean,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,sunshine_duration,precipitation_hours,sunrise,sunset&past_days=8&timezone=auto${modelParam}`;
        // Fetch 3: current weather_code only from the global model (no models= param).
        // MeteoSwiss ICON-CH2 consistently misclassifies fog (code 45) as overcast (code 3); the global
        // model is more reliable for WMO fog detection. All other current/hourly values still come from
        // the MeteoSwiss model when available.
        const globalCodeUrl = modelParam
          ? `https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}&current=weather_code&timezone=UTC`
          : null;

        const fetches: Promise<Response>[] = [fetch(currentUrl), fetch(dailyUrl)];
        if (globalCodeUrl) fetches.push(fetch(globalCodeUrl));
        const [resCurrent, resDaily, resGlobalCode] = await Promise.all(fetches);
        if (!resCurrent.ok) throw new Error('Error fetching current weather data');
        if (!resDaily.ok) throw new Error('Error fetching daily weather data');
        const [currentData, dailyData] = await Promise.all([resCurrent.json(), resDaily.json()]);
        const globalCodeData = (resGlobalCode && resGlobalCode.ok) ? await resGlobalCode.json() : null;
        // Use global model weather_code if available (better fog detection); fall back to MeteoSwiss code
        const currentWeatherCode: number = globalCodeData?.current?.weather_code ?? currentData.current.weather_code;

        // sunrise/sunset come back as local-time strings from timezone=auto.
        // Convert to UTC-equivalent strings so existing +Z parsing in App.tsx / DailyForecast stays correct.
        const offsetMs = (dailyData.utc_offset_seconds ?? 0) * 1000;
        const toUtcStr = (local: string) =>
          local ? new Date(new Date(local + 'Z').getTime() - offsetMs).toISOString().slice(0, 16) : '';

        const dailyWeather: DailyWeather[] = dailyData.daily.time.map((time: string, index: number) => ({
          date: time,
          weatherCode: dailyData.daily.weather_code[index],
          maxTemp: dailyData.daily.temperature_2m_max[index],
          minTemp: dailyData.daily.temperature_2m_min[index],
          meanPressure: dailyData.daily.pressure_msl_mean[index],
          humidity: dailyData.daily.relative_humidity_2m_mean[index],
          precipitation: dailyData.daily.precipitation_sum[index],
          precipitationProbability: dailyData.daily.precipitation_probability_max?.[index] ?? 0,
          windSpeed: dailyData.daily.wind_speed_10m_max[index],
          sunshineDuration: dailyData.daily.sunshine_duration?.[index] ?? 0,
          precipitationHours: dailyData.daily.precipitation_hours?.[index] ?? 0,
          sunrise: toUtcStr(dailyData.daily.sunrise?.[index] ?? ''),
          sunset: toUtcStr(dailyData.daily.sunset?.[index] ?? ''),
        }));

        // Calculate Pressure Trend
        let pressureTrend = null;
        if (currentData.hourly?.time && currentData.hourly?.pressure_msl && currentData.current?.time) {
          const currentTime = currentData.current.time;
          // Find the index of the current hour (or closest matching hour string)
          const currentIndex = currentData.hourly.time.findIndex((t: string) => t === currentTime || t.startsWith(currentTime.substring(0, 13)));
          
          if (currentIndex >= 6) {
            const currentP = currentData.current.pressure_msl;
            const p3h = currentData.hourly.pressure_msl[currentIndex - 3];
            const p6h = currentData.hourly.pressure_msl[currentIndex - 6];
            
            if (p3h !== null && p6h !== null) {
              pressureTrend = {
                currentPressure: currentP,
                delta3h: Math.round((currentP - p3h) * 10) / 10,
                delta6h: Math.round((currentP - p6h) * 10) / 10
              };
            }
          }
        }

        // Parse Hourly Weather (next 24 hours starting from the current hour)
        const hourlyWeather: HourlyWeather[] = [];
        if (currentData.hourly?.time && currentData.current?.time) {
          const currentTime = currentData.current.time;
          const currentIndex = currentData.hourly.time.findIndex((t: string) => t === currentTime || t.startsWith(currentTime.substring(0, 13)));
          const startIndex = currentIndex >= 0 ? currentIndex : 0;

          for (let i = startIndex; i < Math.min(currentData.hourly.time.length, startIndex + 25); i++) {
            hourlyWeather.push({
              time: currentData.hourly.time[i],
              temperature: currentData.hourly.temperature_2m[i],
              humidity: currentData.hourly.relative_humidity_2m[i],
              pressure: currentData.hourly.pressure_msl[i],
              precipitation: currentData.hourly.precipitation?.[i] || 0,
              precipProbability: currentData.hourly.precipitation_probability?.[i] ?? 0,
              apparentTemperature: currentData.hourly.apparent_temperature?.[i] ?? currentData.hourly.temperature_2m[i],
              weatherCode: currentData.hourly.weather_code?.[i] || 0,
              windSpeed: currentData.hourly.wind_speed_10m?.[i] ?? 0,
              windGusts: currentData.hourly.wind_gusts_10m?.[i] ?? 0,
              dewPoint: currentData.hourly.dew_point_2m?.[i] ?? 0,
              snowfall: currentData.hourly.snowfall?.[i] ?? 0,
              cape: currentData.hourly.cape?.[i] ?? 0,
            });
          }
        }

        // Wider hourly range for the Today & Tomorrow summary (same response, no extra request).
        // −25 h reaches local midnight of today, +50 h reaches tomorrow 24:00 local (incl. a DST fallback hour).
        const summaryHours: SummaryHour[] = [];
        if (currentData.hourly?.time && currentData.current?.time) {
          const h = currentData.hourly;
          const currentIndex = h.time.findIndex((t: string) => t.startsWith(currentData.current.time.substring(0, 13)));
          if (currentIndex >= 0) {
            for (let i = Math.max(0, currentIndex - 25); i < Math.min(h.time.length, currentIndex + 51); i++) {
              summaryHours.push({
                time: h.time[i],
                temperature: h.temperature_2m?.[i] ?? null,
                apparentTemperature: h.apparent_temperature?.[i] ?? null,
                precipitation: h.precipitation?.[i] ?? null,
                precipProbability: h.precipitation_probability?.[i] ?? null,
                snowfall: h.snowfall?.[i] ?? null,
                weatherCode: h.weather_code?.[i] ?? null,
                windGusts: h.wind_gusts_10m?.[i] ?? null,
              });
            }
          }
        }

        if (!isMounted) return;

        // Set main weather data immediately (non-blocking)
        setData({
          current: {
            temperature: currentData.current.temperature_2m,
            humidity: currentData.current.relative_humidity_2m,
            weatherCode: currentWeatherCode,
            windSpeed: currentData.current.wind_speed_10m,
            windGusts: currentData.current.wind_gusts_10m ?? 0,
            windDirection: currentData.current.wind_direction_10m,
            surfacePressure: currentData.current.pressure_msl,
            elevation: currentData.elevation,
          },
          daily: dailyWeather,
          hourly: hourlyWeather,
          summaryHours,
          timezone: dailyData.timezone ?? null,
          historical: [], // starts empty and loads asynchronously
          pressureTrend,
          airQuality: null, // starts null and loads asynchronously
        });
        setLoading(false);

        // Fetch Historical data (2003, 1973, 1949) asynchronously
        const years = [2003, 1973, 1949];
        const today = new Date();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        // Cache key includes location + calendar date — historical data never changes for a given day
        const histCacheKey = `hist_cache_${location.latitude}_${location.longitude}_${month}-${day}`;

        Promise.resolve().then(async () => {
          // Try cache first
          try {
            const raw = localStorage.getItem(histCacheKey);
            if (raw) {
              const cached = JSON.parse(raw);
              if (isMounted) setData(prev => prev ? { ...prev, historical: cached } : null);
              return;
            }
          } catch { /* corrupt cache — fall through */ }

          const historicalPromises = years.map(async (year) => {
            const dateStr = `${year}-${month}-${day}`;
            const histUrl = `https://archive-api.open-meteo.com/v1/archive?latitude=${location.latitude}&longitude=${location.longitude}&start_date=${dateStr}&end_date=${dateStr}&daily=weather_code,temperature_2m_mean,wind_speed_10m_max,wind_direction_10m_dominant,pressure_msl_mean,relative_humidity_2m_mean,precipitation_sum&timezone=auto`;
            try {
              const res = await fetch(histUrl);
              if (!res.ok) throw new Error(`HTTP error ${res.status}`);
              const data = await res.json();
              if (!data || !data.daily || !data.daily.time || data.daily.time.length === 0) {
                throw new Error('Invalid historical data format');
              }
              return { year, data, error: false };
            } catch (err) {
              console.error(`Error fetching historical weather for ${year}:`, err);
              return { year, data: null, error: true };
            }
          });

          const historicalResults = await Promise.all(historicalPromises);
          if (!isMounted) return;

          const historicalData = historicalResults.map((result) => {
            if (result.error || !result.data) {
              return { year: result.year, data: null, error: true };
            }
            const histYearData = result.data;
            return {
              year: result.year,
              error: false,
              data: {
                date: histYearData.daily.time[0],
                weatherCode: histYearData.daily.weather_code[0],
                maxTemp: histYearData.daily.temperature_2m_mean[0],
                minTemp: histYearData.daily.temperature_2m_mean[0],
                meanPressure: histYearData.daily.pressure_msl_mean[0],
                humidity: histYearData.daily.relative_humidity_2m_mean ? histYearData.daily.relative_humidity_2m_mean[0] : 0,
                precipitation: histYearData.daily.precipitation_sum ? histYearData.daily.precipitation_sum[0] : 0,
                precipitationProbability: 0,
                windSpeed: histYearData.daily.wind_speed_10m_max ? histYearData.daily.wind_speed_10m_max[0] : 0,
                sunshineDuration: 0,
                precipitationHours: 0,
                sunrise: '',
                sunset: '',
              }
            };
          });

          try { localStorage.setItem(histCacheKey, JSON.stringify(historicalData)); } catch { /* storage full */ }
          setData(prev => prev ? { ...prev, historical: historicalData } : null);
        });

        // Fetch Air Quality data asynchronously (Europe only for pollen)
        const aqUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${location.latitude}&longitude=${location.longitude}&hourly=european_aqi,pm2_5,pm10,grass_pollen,birch_pollen,alder_pollen,mugwort_pollen,olive_pollen,ragweed_pollen,european_aqi_pm2_5,european_aqi_pm10,european_aqi_nitrogen_dioxide,european_aqi_ozone,european_aqi_sulphur_dioxide,uv_index&timezone=UTC&forecast_days=2`;
        fetch(aqUrl).then(async (res) => {
          if (!res.ok || !isMounted) return;
          const aqData = await res.json();
          if (!aqData?.hourly?.time) return;

          // Find current hour index
          const nowHour = new Date().toISOString().substring(0, 13);
          const idx = aqData.hourly.time.findIndex((t: string) => t.startsWith(nowHour));
          const i = idx >= 0 ? idx : 0;

          // Per-pollutant sub-AQIs at current hour
          const aqiPm25: number | null = aqData.hourly.european_aqi_pm2_5?.[i] ?? null;
          const aqiPm10: number | null = aqData.hourly.european_aqi_pm10?.[i] ?? null;
          const aqiNo2: number | null = aqData.hourly.european_aqi_nitrogen_dioxide?.[i] ?? null;
          const aqiO3: number | null = aqData.hourly.european_aqi_ozone?.[i] ?? null;
          const aqiSo2: number | null = aqData.hourly.european_aqi_sulphur_dioxide?.[i] ?? null;

          // Dominant pollutant: whichever sub-AQI is highest (only label if notable, i.e. > 20)
          const pollComponents = [
            { name: 'PM2.5', value: aqiPm25 },
            { name: 'PM10', value: aqiPm10 },
            { name: 'NO₂', value: aqiNo2 },
            { name: 'O₃', value: aqiO3 },
            { name: 'SO₂', value: aqiSo2 },
          ].filter((c): c is { name: string; value: number } => c.value !== null);
          pollComponents.sort((a, b) => b.value - a.value);
          const dominantPollutant = pollComponents.length > 0 && pollComponents[0].value > 20
            ? pollComponents[0].name
            : null;

          const airQuality: AirQualityData = {
            currentAqi: aqData.hourly.european_aqi?.[i] ?? null,
            currentPm25: aqData.hourly.pm2_5?.[i] ?? null,
            currentPm10: aqData.hourly.pm10?.[i] ?? null,
            grassPollen: aqData.hourly.grass_pollen?.[i] ?? null,
            birchPollen: aqData.hourly.birch_pollen?.[i] ?? null,
            alderPollen: aqData.hourly.alder_pollen?.[i] ?? null,
            mugwortPollen: aqData.hourly.mugwort_pollen?.[i] ?? null,
            olivePollen: aqData.hourly.olive_pollen?.[i] ?? null,
            ragweedPollen: aqData.hourly.ragweed_pollen?.[i] ?? null,
            uvIndex: aqData.hourly.uv_index?.[i] ?? null,
            dominantPollutant,
            hourlyAqi: (aqData.hourly.european_aqi?.slice(i, i + 24) ?? []).map((v: number | null) => v ?? 0),
            hourlyTime: aqData.hourly.time?.slice(i, i + 24) ?? [],
            aqiPm25,
            aqiPm10,
            aqiNo2,
            aqiO3,
            aqiSo2,
          };

          setData(prev => {
            if (!prev) return null;
            return { ...prev, airQuality };
          });
        }).catch((err) => {
          console.error("Failed to fetch air quality data:", err);
        });
      } catch (err) {
        if (isMounted) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchWeather();

    return () => {
      isMounted = false;
    };
  }, [location]);

  return { data, loading, error };
}
