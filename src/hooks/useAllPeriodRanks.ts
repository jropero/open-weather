import { useState, useEffect } from 'react';
import type { SeasonalPeriod } from '../types/weather';
import { aggregateMonthly, aggregateSeasonal, getAboveCount } from '../utils/climateStats';
import { getERA5Data } from './useHistoricalClimate';

/**
 * Fetches ERA5 once (shared cache + in-flight request with ClimateDetailView), computes temperature
 * above-count for every period. Returns null while loading or on error.
 */
export function useAllPeriodRanks(
  lat: number,
  lon: number,
  periods: SeasonalPeriod[],
  isSeasonal: boolean,
): Map<string, { above: number; total: number }> | null {
  // Tagged with the coordinates they were computed for: period keys (start dates) are the same
  // for every location, so untagged results would leak to the next location.
  const [state, setState] = useState<{
    coords: string;
    ranks: Map<string, { above: number; total: number }>;
  } | null>(null);
  const coords = `${lat}_${lon}`;

  const periodsKey = periods.map((p) => p.start).join(',');

  useEffect(() => {
    if (!periods.length) return;
    let cancelled = false;

    // eslint-disable-next-line sonarjs/cognitive-complexity
    async function load() {
      try {
        const era5 = await getERA5Data(lat, lon);
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

            const sameSeason = allSeasonal.filter((s) => s.seasonKey === seasonKey);
            if (!sameSeason.length) continue;

            const histTemps = sameSeason.map((s) => s.temperature);
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

            const sameMonth = allMonthly.filter((m) => m.month === targetMonth);
            if (!sameMonth.length) continue;

            const histTemps = sameMonth.map((m) => m.temperature);
            const climMean = histTemps.reduce((a, b) => a + b, 0) / histTemps.length;
            const forecastAdj = climMean + anomaly;
            const above = getAboveCount(forecastAdj, histTemps);
            result.set(periodKey, { above, total: histTemps.length });
          }
        }

        if (!cancelled) setState({ coords: `${lat}_${lon}`, ranks: result });
      } catch {
        // Silently fail — decorative
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lon, periodsKey, isSeasonal]);

  return state?.coords === coords ? state.ranks : null;
}
