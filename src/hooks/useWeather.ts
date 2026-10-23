import { useState, useEffect } from 'react';
import type { Location, WeatherData, DailyWeather, HourlyWeather, AirQualityData } from '../types/weather';

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
        // Current, hourly (for trends), and 8-day forecast (to calculate delta P for the 7th day)
        const modelParam = getModelParam(location.latitude, location.longitude);
        const currentUrl = `https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,wind_gusts_10m,wind_direction_10m,pressure_msl&hourly=temperature_2m,relative_humidity_2m,pressure_msl,precipitation,precipitation_probability,apparent_temperature,weather_code,wind_speed_10m,wind_gusts_10m,dew_point_2m,snowfall,cape&past_days=8&daily=weather_code,temperature_2m_max,temperature_2m_min,pressure_msl_mean,relative_humidity_2m_mean,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,sunrise,sunset&timezone=UTC${modelParam}`;
        
        const resCurrent = await fetch(currentUrl);
        if (!resCurrent.ok) throw new Error('Error fetching current weather data');
        const currentData = await resCurrent.json();

        // Parse Daily Weather
        const dailyWeather: DailyWeather[] = currentData.daily.time.map((time: string, index: number) => ({
          date: time,
          weatherCode: currentData.daily.weather_code[index],
          maxTemp: currentData.daily.temperature_2m_max[index],
          minTemp: currentData.daily.temperature_2m_min[index],
          meanPressure: currentData.daily.pressure_msl_mean[index],
          humidity: currentData.daily.relative_humidity_2m_mean[index],
          precipitation: currentData.daily.precipitation_sum[index],
          precipitationProbability: currentData.daily.precipitation_probability_max?.[index] ?? 0,
          windSpeed: currentData.daily.wind_speed_10m_max[index],
          sunrise: currentData.daily.sunrise?.[index] ?? '',
          sunset: currentData.daily.sunset?.[index] ?? '',
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

        if (!isMounted) return;

        // Set main weather data immediately (non-blocking)
        setData({
          current: {
            temperature: currentData.current.temperature_2m,
            humidity: currentData.current.relative_humidity_2m,
            weatherCode: currentData.current.weather_code,
            windSpeed: currentData.current.wind_speed_10m,
            windGusts: currentData.current.wind_gusts_10m ?? 0,
            windDirection: currentData.current.wind_direction_10m,
            surfacePressure: currentData.current.pressure_msl,
            elevation: currentData.elevation,
          },
          daily: dailyWeather,
          hourly: hourlyWeather,
          historical: [], // starts empty and loads asynchronously
          pressureTrend,
          airQuality: null, // starts null and loads asynchronously
        });
        setLoading(false);

        // Fetch Historical data (2003, 1973, 1949) asynchronously
        const years = [2003, 1973, 1949];
        // We get the same month/day but for those years
        const today = new Date();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');

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

        Promise.all(historicalPromises).then((historicalResults) => {
          if (!isMounted) return;

          const historicalData = historicalResults.map((result) => {
            if (result.error || !result.data) {
              return {
                year: result.year,
                data: null,
                error: true
              };
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
                sunrise: '',
                sunset: '',
              }
            };
          });

          setData(prev => {
            if (!prev) return null;
            return {
              ...prev,
              historical: historicalData
            };
          });
        }).catch((err) => {
          console.error("Failed to fetch historical weather data:", err);
        });

        // Fetch Air Quality data asynchronously (Europe only for pollen)
        const aqUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${location.latitude}&longitude=${location.longitude}&hourly=european_aqi,pm2_5,pm10,grass_pollen,birch_pollen,alder_pollen,mugwort_pollen,olive_pollen,ragweed_pollen&timezone=UTC&forecast_days=1`;
        fetch(aqUrl).then(async (res) => {
          if (!res.ok || !isMounted) return;
          const aqData = await res.json();
          if (!aqData?.hourly?.time) return;

          // Find current hour index
          const nowHour = new Date().toISOString().substring(0, 13);
          const idx = aqData.hourly.time.findIndex((t: string) => t.startsWith(nowHour));
          const i = idx >= 0 ? idx : 0;

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
          };

          setData(prev => {
            if (!prev) return null;
            return { ...prev, airQuality };
          });
        }).catch((err) => {
          console.error("Failed to fetch air quality data:", err);
        });
      } catch (err: any) {
        if (isMounted) setError(err.message);
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
