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
 * Variables shown as a running total over the week, so the end of the curve equals the
 * weekly total shown in the outlook cell. Precipitation and snowfall stay hourly on purpose:
 * users read them to see *which day/hour* is likely to be wet or snowy, which a total hides.
 */
export const CUMULATIVE_VARS: ReadonlySet<EnsembleVar> = new Set(['sunshine_duration']);

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

/** Slices one UTC week, converts sunshine to hours, running totals for CUMULATIVE_VARS. */
export function toWeekPoints(
  raw: RawEnsemble,
  weekStart: string,
  variable: EnsembleVar,
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
  return CUMULATIVE_VARS.has(variable) ? toCumulative(points) : points;
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

/**
 * Running total per member from the first point. A missing hour adds nothing but keeps the
 * member's line going; a member that never had a value stays `null`.
 */
export function toCumulative(points: EnsemblePoint[]): EnsemblePoint[] {
  if (!points.length) return [];
  const n = points[0].members.length;
  const sums: (number | null)[] = Array.from({ length: n }, () => null);
  return points.map((p) => {
    for (let m = 0; m < n; m++) {
      const v = p.members[m];
      if (v !== null && v !== undefined && Number.isFinite(v)) sums[m] = (sums[m] ?? 0) + v;
    }
    return makePoint(p.time, [...sums]);
  });
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
 * running weekly total (CUMULATIVE_VARS).
 */
const WIDE_THRESHOLD: Record<EnsembleVar, number> = {
  temperature_2m: 4, // °C
  pressure_msl: 5, // hPa
  wind_speed_10m: 20, // km/h
  precipitation: 3, // mm per hour
  snowfall: 2, // cm per hour
  sunshine_duration: 10, // h per week (values are converted to hours)
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
