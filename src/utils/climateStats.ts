import type { SeasonalVariable, SeasonKey } from '../types/weather';
import type { AnomalyLevel } from './seasonal';

// ---- Shared types --------------------------------------------------------

export interface ERA5DailyData {
  time: string[];
  temp: (number | null)[];
  precip: (number | null)[];
  pressure: (number | null)[];
  sunshine: (number | null)[];
  snowfall: (number | null)[];
}

export interface MonthlyClimate {
  yearMonth: string; // "YYYY-MM"
  year: number;
  month: number; // 1-12
  temperature: number;
  precipitation: number;
  pressure: number;
  sunshine: number; // seconds
  snowfall: number; // cm
}

export interface SeasonalClimate {
  key: string; // e.g. "DJF_2024"
  seasonKey: SeasonKey;
  year: number; // anchor year (Jan/Feb year; Dec belongs to previous calendar year)
  temperature: number;
  precipitation: number;
  pressure: number;
  sunshine: number;
  snowfall: number;
}

export interface HistoricalPeriod {
  label: string;
  year: number;
  month?: number; // set for monthly periods
  seasonKey?: SeasonKey; // set for seasonal periods
  values: Partial<Record<SeasonalVariable, number>>;
}

export interface AnalogueYear {
  label: string;
  year: number;
  month?: number;
  seasonKey?: SeasonKey;
  distance: number;
  similarity: number; // 0–1, higher = more similar to forecast
}

export interface ClimateDetailResult {
  analogues: AnalogueYear[];
  // Comparison: how many of the last N years had a lower value than the forecast
  aboveCount: Record<SeasonalVariable, number | null>;
  totalYears: number;
  // Strip data: one entry per historical year (chronological)
  stripYears: number[];
  stripValues: Record<SeasonalVariable, (number | null)[]>;
  climMeans: Record<SeasonalVariable, number | null>;
  climStds: Record<SeasonalVariable, number | null>;
  forecastValues: Record<SeasonalVariable, number | null>;
}

// ---- Constants -----------------------------------------------------------

export const ALL_VARS: SeasonalVariable[] = [
  'temperature',
  'precipitation',
  'pressure',
  'sunshine',
  'snowfall',
];

const ERA5_YEARS_BACK = 10;

/** RMS z-score distance (σ) at which an analogue counts as 0 % similar. */
export const ANALOGUE_ZERO_SIMILARITY = 2;

// ---- Date helpers --------------------------------------------------------

/** Returns YYYY-MM-DD for the last day of the previous month (ERA5 lag ~5 days). */
export function getERA5EndDate(): string {
  const now = new Date();
  const lastDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
  return lastDay.toISOString().slice(0, 10);
}

/** Returns YYYY-MM-DD for 10 years before the current month start. */
export function getERA5StartDate(): string {
  const now = new Date();
  const y = now.getUTCFullYear() - ERA5_YEARS_BACK;
  const m = String(now.getUTCMonth() + 1).padStart(2, '0'); // current month, 10 years back
  return `${y}-${m}-01`;
}

// ---- Math helpers --------------------------------------------------------

function mean(xs: number[]): number {
  if (!xs.length) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function std(xs: number[], m: number): number {
  if (xs.length < 2) return 0;
  const variance = xs.reduce((a, x) => a + (x - m) ** 2, 0) / xs.length;
  return Math.sqrt(variance);
}

// ---- Monthly aggregation -------------------------------------------------

/**
 * Aggregates ERA5 daily data into monthly totals/means.
 * temperature & pressure: mean; precipitation, sunshine, snowfall: sum.
 */
// eslint-disable-next-line sonarjs/cognitive-complexity
export function aggregateMonthly(daily: ERA5DailyData): MonthlyClimate[] {
  type Acc = {
    temp: number[];
    precip: number[];
    pressure: number[];
    sunshine: number[];
    snowfall: number[];
  };
  const groups = new Map<string, Acc>();

  for (let i = 0; i < daily.time.length; i++) {
    const ym = daily.time[i].slice(0, 7); // "YYYY-MM"
    if (!groups.has(ym))
      groups.set(ym, { temp: [], precip: [], pressure: [], sunshine: [], snowfall: [] });
    const g = groups.get(ym)!;
    if (daily.temp[i] !== null) g.temp.push(daily.temp[i] as number);
    if (daily.precip[i] !== null) g.precip.push(daily.precip[i] as number);
    if (daily.pressure[i] !== null) g.pressure.push(daily.pressure[i] as number);
    if (daily.sunshine[i] !== null) g.sunshine.push(daily.sunshine[i] as number);
    if (daily.snowfall[i] !== null) g.snowfall.push(daily.snowfall[i] as number);
  }

  const result: MonthlyClimate[] = [];
  for (const [ym, g] of Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b))) {
    if (!g.temp.length && !g.pressure.length) continue;
    const year = Number(ym.slice(0, 4));
    const month = Number(ym.slice(5, 7));
    result.push({
      yearMonth: ym,
      year,
      month,
      temperature: g.temp.length ? mean(g.temp) : 0,
      precipitation: g.precip.reduce((a, b) => a + b, 0),
      pressure: g.pressure.length ? mean(g.pressure) : 0,
      sunshine: g.sunshine.reduce((a, b) => a + b, 0),
      snowfall: g.snowfall.reduce((a, b) => a + b, 0),
    });
  }
  return result;
}

// ---- Seasonal aggregation ------------------------------------------------

function getSeasonInfo(
  year: number,
  month: number,
): { seasonKey: SeasonKey; anchorYear: number } {
  if (month <= 2) return { seasonKey: 'DJF', anchorYear: year };
  if (month <= 5) return { seasonKey: 'MAM', anchorYear: year };
  if (month <= 8) return { seasonKey: 'JJA', anchorYear: year };
  if (month <= 11) return { seasonKey: 'SON', anchorYear: year };
  // December
  return { seasonKey: 'DJF', anchorYear: year + 1 };
}

/**
 * Aggregates monthly records into meteorological seasons.
 * DJF_2024 = Dec 2023 + Jan 2024 + Feb 2024 (anchor year = 2024).
 * Only complete 3-month seasons are returned.
 */
// eslint-disable-next-line sonarjs/cognitive-complexity
export function aggregateSeasonal(monthly: MonthlyClimate[]): SeasonalClimate[] {
  type Acc = { seasonKey: SeasonKey; anchorYear: number; months: MonthlyClimate[] };
  const groups = new Map<string, Acc>();

  for (const m of monthly) {
    const { seasonKey, anchorYear } = getSeasonInfo(m.year, m.month);
    const gk = `${seasonKey}_${anchorYear}`;
    if (!groups.has(gk)) groups.set(gk, { seasonKey, anchorYear, months: [] });
    groups.get(gk)!.months.push(m);
  }

  const result: SeasonalClimate[] = [];
  for (const [key, g] of Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b))) {
    if (g.months.length < 3) continue; // incomplete — skip
    result.push({
      key,
      seasonKey: g.seasonKey,
      year: g.anchorYear,
      temperature: mean(g.months.map((m) => m.temperature)),
      precipitation: g.months.reduce((a, m) => a + m.precipitation, 0),
      pressure: mean(g.months.map((m) => m.pressure)),
      sunshine: g.months.reduce((a, m) => a + m.sunshine, 0),
      snowfall: g.months.reduce((a, m) => a + m.snowfall, 0),
    });
  }
  return result;
}

// ---- Climatology (last 10 years) -----------------------------------------

/** Computes mean and std from all provided historical periods (the last 10 years). */
export function computeClimatology(periods: HistoricalPeriod[]): {
  means: Record<SeasonalVariable, number | null>;
  stds: Record<SeasonalVariable, number | null>;
} {
  const means: Record<SeasonalVariable, number | null> = {
    temperature: null,
    precipitation: null,
    pressure: null,
    sunshine: null,
    snowfall: null,
  };
  const stds: Record<SeasonalVariable, number | null> = {
    temperature: null,
    precipitation: null,
    pressure: null,
    sunshine: null,
    snowfall: null,
  };

  for (const v of ALL_VARS) {
    const vals = periods
      .map((p) => p.values[v])
      .filter((x): x is number => x !== undefined && x !== null);
    if (vals.length >= 2) {
      means[v] = mean(vals);
      stds[v] = std(vals, means[v]!);
    }
  }
  return { means, stds };
}

// ---- Analogue finding ----------------------------------------------------

/**
 * Finds the 3 past years/seasons most similar to the forecast using
 * normalised z-score Euclidean distance across all 5 variables.
 */
// eslint-disable-next-line sonarjs/cognitive-complexity
export function findAnalogues(
  forecastMeans: Record<SeasonalVariable, number | null>,
  historicalPeriods: HistoricalPeriod[],
  climMean: Record<SeasonalVariable, number | null>,
  climStd: Record<SeasonalVariable, number | null>,
): AnalogueYear[] {
  // Pre-compute forecast z-scores
  const fz: Partial<Record<SeasonalVariable, number>> = {};
  for (const v of ALL_VARS) {
    const fm = forecastMeans[v];
    const cm = climMean[v];
    const cs = climStd[v];
    if (fm !== null && cm !== null && cs !== null && cs > 0) {
      fz[v] = (fm - cm) / cs;
    }
  }

  const candidates: AnalogueYear[] = [];

  for (const hp of historicalPeriods) {
    let sumSq = 0;
    let count = 0;
    for (const v of ALL_VARS) {
      const hv = hp.values[v];
      const cm = climMean[v];
      const cs = climStd[v];
      const fzv = fz[v];
      if (
        hv !== undefined &&
        hv !== null &&
        cm !== null &&
        cs !== null &&
        cs > 0 &&
        fzv !== undefined
      ) {
        const hz = (hv - cm) / cs;
        sumSq += (hz - fzv) ** 2;
        count++;
      }
    }
    if (count > 0) {
      candidates.push({
        label: hp.label,
        year: hp.year,
        month: hp.month,
        seasonKey: hp.seasonKey,
        distance: Math.sqrt(sumSq / count),
        similarity: 0, // computed below
      });
    }
  }

  candidates.sort((a, b) => a.distance - b.distance);

  // Absolute scale: identical = 1, an RMS difference of ANALOGUE_ZERO_SIMILARITY σ or more = 0.
  // (Normalising to the worst candidate made the top 3 look close even when none was.)
  for (const r of candidates) {
    r.similarity = Math.max(0, 1 - r.distance / ANALOGUE_ZERO_SIMILARITY);
  }

  return candidates.slice(0, 3);
}

// ---- "Above count" comparison -------------------------------------------

/**
 * Returns how many historical values are strictly below forecastValue.
 * Used for: "Más cálido que en K de los últimos N años".
 */
export function getAboveCount(forecastValue: number, historicalValues: number[]): number {
  return historicalValues.filter((v) => v < forecastValue).length;
}

// ---- Holistic summary ----------------------------------------------------

/** Tie-break order when several variables share the largest |level|. */
const SUMMARY_PRIORITY: SeasonalVariable[] = [
  'temperature',
  'precipitation',
  'sunshine',
  'pressure',
  'snowfall',
];

/**
 * Returns the translation key of a plain-language summary sentence.
 * `levels` come from `classifyAnomaly` — the same thresholds the heatmap uses, so the
 * sentence never contradicts the cell colours (e.g. "wetter" while the cell says normal).
 */
// eslint-disable-next-line sonarjs/cognitive-complexity
export function getHolisticSummaryKey(
  levels: Record<SeasonalVariable, AnomalyLevel | null>,
): string {
  const temp = levels.temperature ?? 0;
  const precip = levels.precipitation ?? 0;

  if (temp !== 0 && precip !== 0) {
    return `climate.summary.${temp > 0 ? 'warm' : 'cold'}_${precip > 0 ? 'wet' : 'dry'}`;
  }

  let top: SeasonalVariable | null = null;
  let topMag = 0;
  for (const v of SUMMARY_PRIORITY) {
    const mag = Math.abs(levels[v] ?? 0);
    if (mag > topMag) {
      topMag = mag;
      top = v;
    }
  }
  if (!top) return 'climate.summary.normal';
  return `climate.summary.${top}.${(levels[top] ?? 0) > 0 ? 'above' : 'below'}`;
}
