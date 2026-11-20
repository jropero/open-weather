export type EnsembleVar =
  | 'temperature_2m'
  | 'precipitation'
  | 'pressure_msl'
  | 'wind_speed_10m'
  | 'sunshine_duration'
  | 'snowfall';

export interface EnsembleStats {
  mean: number;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
}

/**
 * One hourly step. `members` is index-aligned across points (member k is always at index k,
 * `null` when that member has no value), so a spaghetti line never jumps between members.
 * `stats` is `null` when no member has a value — never fabricated as 0.
 */
export interface EnsemblePoint {
  time: number; // ms UTC
  stats: EnsembleStats | null;
  members: (number | null)[];
}

export type SpreadLabel = 'agree' | 'disagree' | 'bimodal';

export interface SpreadClassification {
  label: SpreadLabel;
}

/**
 * Variables shown as one value per local day (hours of sunshine per day) instead of hourly.
 * Each day is drawn as a flat step across its hours so x positions still match the hourly
 * day gridlines. Precipitation and snowfall stay hourly on purpose: users read them to see
 * *which hour* is likely to be wet or snowy, which a daily total hides.
 */
export const DAILY_VARS: ReadonlySet<EnsembleVar> = new Set(['sunshine_duration']);

/** A local day needs at least this many hours inside the slice to get a daily total. */
export const MIN_DAY_HOURS = 20;
/** A member's daily total is dropped (null) when more than this many of its hours are missing. */
export const MAX_MISSING_HOURS = 2;

// ---- Ensemble window & raw response ---------------------------------------

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

/** Days requested from the ensemble API (ecmwf_ifs025 serves up to 15). */
export const ENSEMBLE_DAYS = 15;
/** A week needs at least this many days inside the ensemble window to be worth a chart. */
export const MIN_ENSEMBLE_DAYS_IN_WEEK = 2;

/** Raw member matrix as fetched/cached: `members[k][i]` = member k at hour i. */
export interface RawEnsemble {
  times: number[]; // ms UTC
  members: (number | null)[][];
}

const todayUtcMs = (now: number) => Math.floor(now / DAY_MS) * DAY_MS;

/**
 * How many days of the Monday-start week `weekStart` the ensemble window covers
 * (window = today 00:00 UTC … +ENSEMBLE_DAYS, same as the request).
 */
export function ensembleDaysInWeek(weekStart: string, now: number): number {
  const ws = Date.parse(`${weekStart}T00:00:00Z`);
  const from = Math.max(ws, todayUtcMs(now));
  const to = Math.min(ws + WEEK_MS, todayUtcMs(now) + ENSEMBLE_DAYS * DAY_MS);
  return Math.max(0, Math.round((to - from) / DAY_MS));
}

const roundValue = (v: number, variable: EnsembleVar) =>
  variable === 'sunshine_duration' ? Math.round(v) : Math.round(v * 100) / 100;

/**
 * Parses an Open-Meteo ensemble response: control run (`variable`) + perturbed members
 * (`variable_memberNN`, auto-detected). Non-numeric values become `null`; values are rounded
 * to keep the localStorage cache small.
 */
export function parseEnsembleResponse(json: unknown, variable: EnsembleVar): RawEnsemble {
  const hourly = ((json as { hourly?: Record<string, unknown[]> })?.hourly ?? {}) as Record<
    string,
    unknown[]
  >;
  const times = ((hourly.time ?? []) as string[]).map((s) => Date.parse(`${s}Z`));
  const memberKeys = Object.keys(hourly).filter(
    (k) => k === variable || k.startsWith(`${variable}_member`),
  );
  const members = memberKeys.map((k) =>
    times.map((_, i) => {
      const v = hourly[k]?.[i];
      return typeof v === 'number' && Number.isFinite(v) ? roundValue(v, variable) : null;
    }),
  );
  return { times, members };
}

/**
 * Slices one UTC week and converts sunshine to hours; DAILY_VARS become per-local-day totals
 * (`timeZone` = the location's IANA zone).
 */
export function toWeekPoints(
  raw: RawEnsemble,
  weekStart: string,
  variable: EnsembleVar,
  timeZone?: string,
): EnsemblePoint[] {
  const startMs = Date.parse(`${weekStart}T00:00:00Z`);
  const endMs = startMs + WEEK_MS;
  const scale = variable === 'sunshine_duration' ? 1 / 3600 : 1;
  const points: EnsemblePoint[] = [];
  raw.times.forEach((t, i) => {
    if (t < startMs || t >= endMs) return;
    points.push(
      makePoint(
        t,
        raw.members.map((m) => (m[i] === null ? null : m[i] * scale)),
      ),
    );
  });
  return DAILY_VARS.has(variable) ? toDailyTotals(points, timeZone) : points;
}

function sortedPercentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

export function computeStats(members: number[]): EnsembleStats {
  if (!members.length) return { mean: 0, p10: 0, p25: 0, p50: 0, p75: 0, p90: 0 };
  const sorted = [...members].sort((a, b) => a - b);
  const mean = members.reduce((a, b) => a + b, 0) / members.length;
  return {
    mean,
    p10: sortedPercentile(sorted, 10),
    p25: sortedPercentile(sorted, 25),
    p50: sortedPercentile(sorted, 50),
    p75: sortedPercentile(sorted, 75),
    p90: sortedPercentile(sorted, 90),
  };
}

const validMembers = (members: (number | null)[]): number[] =>
  members.filter((v): v is number => v !== null && Number.isFinite(v));

/** Builds a point; stats stay `null` when every member is missing. */
export function makePoint(time: number, members: (number | null)[]): EnsemblePoint {
  const valid = validMembers(members);
  return { time, members, stats: valid.length ? computeStats(valid) : null };
}

function localDayKeyFormatter(timeZone?: string): Intl.DateTimeFormat {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone });
  } catch {
    return new Intl.DateTimeFormat('en-CA');
  }
}

/** Sum of one member over a day's hours; null when more than MAX_MISSING_HOURS are missing. */
function memberDayTotal(hours: EnsemblePoint[], m: number): number | null {
  let sum = 0;
  let missing = 0;
  for (const h of hours) {
    const v = h.members[m];
    if (v === null || v === undefined || !Number.isFinite(v)) missing++;
    else sum += v;
  }
  return missing > MAX_MISSING_HOURS ? null : sum;
}

/**
 * Per-local-day totals, expanded back to the hourly grid (every hour of a day carries that
 * day's total, so the chart draws a flat step per day). Days with fewer than MIN_DAY_HOURS
 * hours in the slice (partial edge days) get all-null members, so a half day never looks
 * cloudy. Missing hours are never read as 0: a member with more than MAX_MISSING_HOURS
 * missing hours that day is null.
 */
export function toDailyTotals(points: EnsemblePoint[], timeZone?: string): EnsemblePoint[] {
  if (!points.length) return [];
  const fmt = localDayKeyFormatter(timeZone);
  const n = points[0].members.length;
  const byDay = new Map<string, EnsemblePoint[]>();
  for (const p of points) {
    const key = fmt.format(p.time);
    byDay.set(key, [...(byDay.get(key) ?? []), p]);
  }
  const totals = new Map<string, (number | null)[]>();
  byDay.forEach((hours, key) => {
    totals.set(
      key,
      Array.from({ length: n }, (_, m) =>
        hours.length >= MIN_DAY_HOURS ? memberDayTotal(hours, m) : null,
      ),
    );
  });
  return points.map((p) => makePoint(p.time, totals.get(fmt.format(p.time))!));
}

/**
 * Indices of points at local `hour` in `timeZone` — midnight for day separators,
 * noon for day labels (so a week starting mid-day still labels its first day).
 */
export function localMidnightIndices(
  points: EnsemblePoint[],
  timeZone?: string,
  hour = 0,
): number[] {
  let fmt: Intl.DateTimeFormat;
  try {
    fmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hourCycle: 'h23', timeZone });
  } catch {
    fmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hourCycle: 'h23' });
  }
  const result: number[] = [];
  points.forEach((p, i) => {
    if (Number(fmt.format(p.time)) === hour) result.push(i);
  });
  return result;
}

// Detect bimodality: significant gap in the central portion of the sorted distribution
function isBimodal(members: number[]): boolean {
  const sorted = [...members].sort((a, b) => a - b);
  const n = sorted.length;
  if (n < 4) return false;
  const totalRange = sorted[n - 1] - sorted[0];
  if (totalRange < 0.01) return false;
  const lo = Math.floor(n * 0.3);
  const hi = Math.ceil(n * 0.7);
  let maxGap = 0;
  for (let i = lo; i < hi - 1; i++) {
    maxGap = Math.max(maxGap, sorted[i + 1] - sorted[i]);
  }
  return maxGap > totalRange * 0.3;
}

/**
 * p90-p10 spread threshold to classify as "wide". Hourly values, except sunshine, which is a
 * daily total (DAILY_VARS).
 */
const WIDE_THRESHOLD: Record<EnsembleVar, number> = {
  temperature_2m: 4, // °C
  pressure_msl: 5, // hPa
  wind_speed_10m: 20, // km/h
  precipitation: 3, // mm per hour
  snowfall: 2, // cm per hour
  sunshine_duration: 3, // h per day (values are converted to hours)
};

// eslint-disable-next-line sonarjs/cognitive-complexity
export function classifySpread(
  points: EnsemblePoint[],
  variable: EnsembleVar,
): SpreadClassification {
  let peak: EnsemblePoint | null = null;
  let maxSpread = -Infinity;
  for (const p of points) {
    if (!p.stats) continue;
    const spread = p.stats.p90 - p.stats.p10;
    if (spread > maxSpread) {
      maxSpread = spread;
      peak = p;
    }
  }
  if (!peak) return { label: 'agree' };
  if (isBimodal(validMembers(peak.members))) return { label: 'bimodal' };
  if (maxSpread > WIDE_THRESHOLD[variable]) return { label: 'disagree' };
  return { label: 'agree' };
}
