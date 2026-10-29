import { useState, useEffect, useCallback } from 'react';
import type { Location, SeasonalForecastData, SeasonalOutlook } from '../types/weather';
import { buildOutlook, fetchSeasonal, getExpectedRun, getLocalToday } from '../utils/seasonal';

const CACHE_MAX_AGE = 24 * 60 * 60 * 1000;

export function useSeasonalForecast(location: Location) {
  const [outlook, setOutlook] = useState<SeasonalOutlook | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const retry = useCallback(() => setReloadToken(n => n + 1), []);

  useEffect(() => {
    let isMounted = true;

    async function fetchOutlook() {
      if (!location.latitude || !location.longitude) return;

      setLoading(true);
      setError(null);

      const now = Date.now();
      const run = getExpectedRun(now);
      const today = getLocalToday(location.timezone, now);
      // Seasonal data only changes with a new EC46 run (daily) or SEAS5 issue (monthly) — the expected run date invalidates the cache
      const cacheKey = `seasonal_cache_${location.latitude}_${location.longitude}`;

      try {
        const raw = localStorage.getItem(cacheKey);
        if (raw) {
          const cached = JSON.parse(raw) as { run: string; timestamp: number; data: SeasonalForecastData };
          if (cached.run === run && now - cached.timestamp < CACHE_MAX_AGE) {
            if (isMounted) {
              setOutlook(buildOutlook(cached.data, today, location.latitude));
              setLoading(false);
            }
            return;
          }
        }
      } catch { /* corrupt cache — fall through */ }

      try {
        const data = await fetchSeasonal(location.latitude, location.longitude);
        try { localStorage.setItem(cacheKey, JSON.stringify({ run, timestamp: now, data })); } catch { /* storage full */ }
        if (isMounted) setOutlook(buildOutlook(data, today, location.latitude));
      } catch (err) {
        console.error('Failed to fetch seasonal outlook:', err);
        if (isMounted) {
          setOutlook(null);
          setError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchOutlook();

    return () => {
      isMounted = false;
    };
  }, [location.latitude, location.longitude, location.timezone, reloadToken]);

  return { outlook, loading, error, retry };
}
