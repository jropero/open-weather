import { useState, useEffect } from 'react';
import type { SeasonalPeriod, SeasonalVariable, SeasonKey } from '../types/weather';
import {
  aggregateMonthly,
  aggregateSeasonal,
  findAnalogues,
  getAboveCount,
  computeClimatology,
  getERA5EndDate,
  getERA5StartDate,
  ALL_VARS,
  type ERA5DailyData,
  type ClimateDetailResult,
  type HistoricalPeriod,
} from '../utils/climateStats';

// ---- ERA5 Archive API ---------------------------------------------------

const ARCHIVE_URL = 'https://archive-api.open-meteo.com/v1/archive';
const CACHE_TTL = 24 * 60 * 60 * 1000;

function cacheKey(lat: number, lon: number): string {
  return `climate_hist_v2_${lat}_${lon}`;
}

async function fetchERA5(lat: number, lon: number): Promise<ERA5DailyData> {
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
  return {
    time,
    temp:     (d.temperature_2m_mean ?? []).map(nullify),
    precip:   (d.precipitation_sum   ?? []).map(nullify),
    pressure: (d.surface_pressure_mean ?? []).map(nullify),
    sunshine: (d.sunshine_duration   ?? []).map(nullify),
    snowfall: (d.snowfall_sum        ?? []).map(nullify),
  };
}

async function getERA5Data(lat: number, lon: number, key: string): Promise<ERA5DailyData> {
  // Try localStorage cache (24 h TTL)
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const cached = JSON.parse(raw) as { timestamp: number; daily: ERA5DailyData };
      if (Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.daily;
      }
    }
  } catch { /* corrupt — fall through */ }

  const daily = await fetchERA5(lat, lon);
  try {
    localStorage.setItem(key, JSON.stringify({ timestamp: Date.now(), daily }));
  } catch { /* storage full */ }
  return daily;
}

// ---- Result builders ----------------------------------------------------

function monthlyLabel(year: number, month: number, locale: string): string {
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString(locale, {
    month: 'short', year: 'numeric', timeZone: 'UTC',
  });
}

const SEASON_ABBR_ES: Record<SeasonKey, string> = { DJF: 'Inv', MAM: 'Prim', JJA: 'Ver', SON: 'Oto' };
const SEASON_ABBR_EN: Record<SeasonKey, string> = { DJF: 'Win', MAM: 'Spr', JJA: 'Sum', SON: 'Aut' };

function seasonLabel(seasonKey: SeasonKey, anchorYear: number, locale: string): string {
  const abbrs = locale.startsWith('es') ? SEASON_ABBR_ES : SEASON_ABBR_EN;
  const prefix = abbrs[seasonKey];
  if (seasonKey === 'DJF') {
    return `${prefix} ${anchorYear - 1}–${String(anchorYear).slice(2)}`;
  }
  return `${prefix} ${anchorYear}`;
}

function buildMonthlyResult(allMonthly: ReturnType<typeof aggregateMonthly>, period: SeasonalPeriod, locale: string): ClimateDetailResult {
  const targetMonth = Number(period.start.slice(5, 7));

  const sameMonth = allMonthly.filter(m => m.month === targetMonth);

  const historicalPeriods: HistoricalPeriod[] = sameMonth.map(m => ({
    label: monthlyLabel(m.year, m.month, locale),
    year: m.year,
    month: m.month,
    values: {
      temperature: m.temperature,
      precipitation: m.precipitation,
      pressure: m.pressure,
      sunshine: m.sunshine,
      snowfall: m.snowfall,
    },
  }));

  return buildResult(historicalPeriods, period, sameMonth.map(m => m.year));
}

function buildSeasonalResult(allMonthly: ReturnType<typeof aggregateMonthly>, period: SeasonalPeriod, locale: string): ClimateDetailResult {
  const allSeasonal = aggregateSeasonal(allMonthly);
  const targetKey = period.season?.key as SeasonKey;

  const sameSeason = allSeasonal.filter(s => s.seasonKey === targetKey);

  const historicalPeriods: HistoricalPeriod[] = sameSeason.map(s => ({
    label: seasonLabel(s.seasonKey, s.year, locale),
    year: s.year,
    seasonKey: s.seasonKey,
    values: {
      temperature: s.temperature,
      precipitation: s.precipitation,
      pressure: s.pressure,
      sunshine: s.sunshine,
      snowfall: s.snowfall,
    },
  }));

  return buildResult(historicalPeriods, period, sameSeason.map(s => s.year));
}

function buildResult(
  historicalPeriods: HistoricalPeriod[],
  period: SeasonalPeriod,
  years: number[],
): ClimateDetailResult {
  const { means, stds } = computeClimatology(historicalPeriods);

  // Anchor SEAS5 anomaly to the ERA5 observed baseline.
  // SEAS5 absolute values have a model cold bias vs ERA5; using ERA5_mean + SEAS5_anomaly
  // keeps the direction signal from SEAS5 while expressing it on the scale of observed history.
  const adj = (v: SeasonalVariable): number | null => {
    const anomaly = period.values[v].anomaly;
    const base = means[v];
    return anomaly !== null && base !== null ? base + anomaly : null;
  };
  const forecastValues: Record<SeasonalVariable, number | null> = {
    temperature:   adj('temperature'),
    precipitation: adj('precipitation'),
    pressure:      null, // surface_pressure vs pressure_msl — incompatible units
    sunshine:      adj('sunshine'),
    snowfall:      adj('snowfall'),
  };

  const analogues = findAnalogues(forecastValues, historicalPeriods, means, stds);

  const aboveCount: Record<SeasonalVariable, number | null> = {
    temperature: null, precipitation: null, pressure: null, sunshine: null, snowfall: null,
  };
  const stripValues: Record<SeasonalVariable, (number | null)[]> = {
    temperature: [], precipitation: [], pressure: [], sunshine: [], snowfall: [],
  };

  for (const v of ALL_VARS) {
    const fv = forecastValues[v];
    const hvals = historicalPeriods.map(hp => hp.values[v] ?? null);
    stripValues[v] = hvals;
    if (fv !== null) {
      const nonNull = hvals.filter((x): x is number => x !== null);
      aboveCount[v] = getAboveCount(fv, nonNull);
    }
  }

  return {
    analogues,
    aboveCount,
    totalYears: historicalPeriods.length,
    stripYears: years,
    stripValues,
    climMeans: means,
    climStds: stds,
    forecastValues,
  };
}

// ---- Hook ---------------------------------------------------------------

export function useHistoricalClimate(
  lat: number,
  lon: number,
  period: SeasonalPeriod,
  locale: string,
): { result: ClimateDetailResult | null; loading: boolean; error: string | null } {
  const [result, setResult] = useState<ClimateDetailResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isSeasonal = !!period.season;
  const periodKey = `${period.start}_${isSeasonal ? 'seas' : 'month'}`;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setResult(null);

    const key = cacheKey(lat, lon);

    async function load() {
      try {
        const era5 = await getERA5Data(lat, lon, key);
        const allMonthly = aggregateMonthly(era5);
        const r = isSeasonal
          ? buildSeasonalResult(allMonthly, period, locale)
          : buildMonthlyResult(allMonthly, period, locale);
        if (!cancelled) {
          setResult(r);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          setLoading(false);
        }
      }
    }

    load();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lon, periodKey, locale]);

  return { result, loading, error };
}
