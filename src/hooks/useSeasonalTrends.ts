import { useState } from 'react';
import type { ClimateZone, Location, SeasonalForecastData, SeasonalPeriod } from '../types/weather';
import { buildOutlook, fetchSeasonal, getLocalToday } from '../utils/seasonal';

const CACHE_KEY = 'seasonal_trend_cache';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

export type SeasonalTrend =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; season: SeasonalPeriod; zone: ClimateZone };

// Per-city entries so one failed city doesn't invalidate the others
type TrendCache = Record<string, { timestamp: number; data: SeasonalForecastData }>;

function readCache(now: number): TrendCache {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return {};
    const cache = JSON.parse(raw) as TrendCache;
    return Object.fromEntries(Object.entries(cache).filter(([, e]) => now - e.timestamp < CACHE_TTL));
  } catch {
    return {};
  }
}

// Same buildOutlook as the main widget — the compact trend is its "next season" column
function toTrend(loc: Location, data: SeasonalForecastData, now: number): SeasonalTrend {
  const outlook = buildOutlook(data, getLocalToday(loc.timezone, now), loc.latitude);
  return { status: 'ready', season: outlook.seasons[1], zone: outlook.zone };
}

/**
 * Seasonal trend for the comparison panel. Nothing is fetched until `load()` is called
 * (user action); results are cached for 24 h and restored on mount without a request.
 */
export function useSeasonalTrends(locations: Location[]) {
  const [trends, setTrends] = useState<Record<string, SeasonalTrend>>(() => {
    const now = Date.now();
    const cache = readCache(now);
    const initial: Record<string, SeasonalTrend> = {};
    for (const loc of locations) {
      if (cache[loc.id]) initial[loc.id] = toTrend(loc, cache[loc.id].data, now);
    }
    return initial;
  });

  const load = () => {
    const pending = locations.filter(l => {
      const status = trends[l.id]?.status;
      return status !== 'ready' && status !== 'loading';
    });
    if (!pending.length) return;

    setTrends(prev => ({ ...prev, ...Object.fromEntries(pending.map(l => [l.id, { status: 'loading' } as SeasonalTrend])) }));

    pending.forEach(async (loc) => {
      try {
        // Monthly temp + precip only: the compact trend needs nothing else, which keeps 12 calls cheap
        const data = await fetchSeasonal(loc.latitude, loc.longitude, { vars: ['temperature', 'precipitation'], weekly: false });
        const now = Date.now();
        try {
          const cache = readCache(now);
          cache[loc.id] = { timestamp: now, data };
          localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
        } catch { /* storage full */ }
        setTrends(prev => ({ ...prev, [loc.id]: toTrend(loc, data, now) }));
      } catch (err) {
        console.error(`Failed to fetch seasonal trend for ${loc.id}:`, err);
        setTrends(prev => ({ ...prev, [loc.id]: { status: 'error' } }));
      }
    });
  };

  return { trends, load };
}
