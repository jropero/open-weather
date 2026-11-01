import { useState, useEffect } from 'react';
import type { SeasonalPeriod } from '../types/weather';
import {
  aggregateMonthly,
  aggregateSeasonal,
  getAboveCount,
  getERA5StartDate,
  getERA5EndDate,
  type ERA5DailyData,
} from '../utils/climateStats';

const ARCHIVE_URL = 'https://archive-api.open-meteo.com/v1/archive';
const CACHE_TTL = 24 * 60 * 60 * 1000;

function cacheKey(lat: number, lon: number): string {
  return `climate_hist_v2_${lat}_${lon}`;
}

async function getERA5Data(lat: number, lon: number, key: string): Promise<ERA5DailyData> {
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const cached = JSON.parse(raw) as { timestamp: number; daily: ERA5DailyData };
      if (Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.daily;
      }
    }
  } catch { /* corrupt — fall through */ }

  const startDate = getERA5StartDate();
  const endDate = getERA5EndDate();
  const url =
    `${ARCHIVE_URL}?latitude=${lat}&longitude=${lon}` +
    `&daily=temperature_2m_mean,precipitation_sum,surface_pressure_mean,sunshine_duration,snowfall_sum` +
    `&timezone=UTC&start_date=${startDate}&end_date=${endDate}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`ERA5 archive API ${res.status}`);
  const json = await res.json();
  const d = json.daily ?? {};

  const nullify = (x: unknown): number | null =>
    typeof x === 'number' && isFinite(x) ? x : null;

  const time: string[] = d.time ?? [];
  const daily: ERA5DailyData = {
    time,
    temp:     (d.temperature_2m_mean   ?? []).map(nullify),
    precip:   (d.precipitation_sum     ?? []).map(nullify),
    pressure: (d.surface_pressure_mean ?? []).map(nullify),
    sunshine: (d.sunshine_duration     ?? []).map(nullify),
    snowfall: (d.snowfall_sum          ?? []).map(nullify),
  };
  try {
    localStorage.setItem(key, JSON.stringify({ timestamp: Date.now(), daily }));
  } catch { /* storage full */ }
  return daily;
}

/**
 * Fetches ERA5 once (shared cache with ClimateDetailView), computes temperature
 * above-count for every period. Returns null while loading or on error.
 */
export function useAllPeriodRanks(
  lat: number,
  lon: number,
  periods: SeasonalPeriod[],
  isSeasonal: boolean,
): Map<string, { above: number; total: number }> | null {
  const [ranks, setRanks] = useState<Map<string, { above: number; total: number }> | null>(null);

  const periodsKey = periods.map(p => p.start).join(',');

  useEffect(() => {
    if (!periods.length) return;
    let cancelled = false;

    async function load() {
      try {
        const key = cacheKey(lat, lon);
        const era5 = await getERA5Data(lat, lon, key);
        const allMonthly = aggregateMonthly(era5);
        const result = new Map<string, { above: number; total: number }>();

        if (isSeasonal) {
          const allSeasonal = aggregateSeasonal(allMonthly);
          for (const period of periods) {
            const anomaly = period.values.temperature.anomaly;
            if (anomaly === null) continue;
            const seasonKey = period.season?.key;
            if (!seasonKey) continue;
            const periodKey = `${period.start}_seas`;

            const sameSeason = allSeasonal.filter(s => s.seasonKey === seasonKey);
            if (!sameSeason.length) continue;

            const histTemps = sameSeason.map(s => s.temperature);
            const climMean = histTemps.reduce((a, b) => a + b, 0) / histTemps.length;
            const forecastAdj = climMean + anomaly;
            const above = getAboveCount(forecastAdj, histTemps);
            result.set(periodKey, { above, total: histTemps.length });
          }
        } else {
          for (const period of periods) {
            const anomaly = period.values.temperature.anomaly;
            if (anomaly === null) continue;
            const targetMonth = Number(period.start.slice(5, 7));
            const periodKey = `${period.start}_month`;

            const sameMonth = allMonthly.filter(m => m.month === targetMonth);
            if (!sameMonth.length) continue;

            const histTemps = sameMonth.map(m => m.temperature);
            const climMean = histTemps.reduce((a, b) => a + b, 0) / histTemps.length;
            const forecastAdj = climMean + anomaly;
            const above = getAboveCount(forecastAdj, histTemps);
            result.set(periodKey, { above, total: histTemps.length });
          }
        }

        if (!cancelled) setRanks(result);
      } catch {
        // Silently fail — decorative
      }
    }

    load();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lon, periodsKey, isSeasonal]);

  return ranks;
}
