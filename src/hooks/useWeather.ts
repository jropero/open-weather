import { useState, useEffect } from 'react';
import type { Location, WeatherData, DailyWeather } from '../types/weather';

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
        // Current and 8-day forecast (to calculate delta P for the 7th day)
        const currentUrl = `https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m,surface_pressure&past_days=8&daily=weather_code,temperature_2m_max,temperature_2m_min,surface_pressure_mean,relative_humidity_2m_mean,precipitation_sum,wind_speed_10m_max&timezone=auto`;
        
        const resCurrent = await fetch(currentUrl);
        if (!resCurrent.ok) throw new Error('Error fetching current weather data');
        const currentData = await resCurrent.json();

        // Historical data (2003, 1973, 1949)
        const years = [2003, 1973, 1949];
        // We get the same month/day but for those years
        const today = new Date();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');

        const historicalPromises = years.map(year => {
          const dateStr = `${year}-${month}-${day}`;
          const histUrl = `https://archive-api.open-meteo.com/v1/archive?latitude=${location.latitude}&longitude=${location.longitude}&start_date=${dateStr}&end_date=${dateStr}&daily=weather_code,temperature_2m_mean,wind_speed_10m_max,wind_direction_10m_dominant,surface_pressure_mean,relative_humidity_2m_mean,precipitation_sum&timezone=auto`;
          return fetch(histUrl).then(res => res.json());
        });

        const historicalResults = await Promise.all(historicalPromises);

        if (!isMounted) return;

        // Parse Daily Weather
        const dailyWeather: DailyWeather[] = currentData.daily.time.map((time: string, index: number) => ({
          date: time,
          weatherCode: currentData.daily.weather_code[index],
          maxTemp: currentData.daily.temperature_2m_max[index],
          minTemp: currentData.daily.temperature_2m_min[index],
          meanPressure: currentData.daily.surface_pressure_mean[index],
          humidity: currentData.daily.relative_humidity_2m_mean[index],
          precipitation: currentData.daily.precipitation_sum[index],
          windSpeed: currentData.daily.wind_speed_10m_max[index],
        }));

        // Parse Historical Weather
        const historicalData = years.map((year, index) => {
          const histYearData = historicalResults[index];
          return {
            year,
            data: {
              date: histYearData.daily.time[0],
              weatherCode: histYearData.daily.weather_code[0],
              maxTemp: histYearData.daily.temperature_2m_mean[0], // using mean as requested by API constraints if max not available, but let's use mean as main
              minTemp: histYearData.daily.temperature_2m_mean[0], // fallback
              meanPressure: histYearData.daily.surface_pressure_mean[0],
              humidity: histYearData.daily.relative_humidity_2m_mean ? histYearData.daily.relative_humidity_2m_mean[0] : 0,
              precipitation: histYearData.daily.precipitation_sum ? histYearData.daily.precipitation_sum[0] : 0,
              windSpeed: histYearData.daily.wind_speed_10m_max ? histYearData.daily.wind_speed_10m_max[0] : 0,
            }
          };
        });

        setData({
          current: {
            temperature: currentData.current.temperature_2m,
            humidity: currentData.current.relative_humidity_2m,
            weatherCode: currentData.current.weather_code,
            windSpeed: currentData.current.wind_speed_10m,
            windDirection: currentData.current.wind_direction_10m,
            surfacePressure: currentData.current.surface_pressure,
          },
          daily: dailyWeather,
          historical: historicalData
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
