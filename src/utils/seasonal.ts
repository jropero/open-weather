import type {
  ClimateZone, ConfidenceLevel, SeasonalForecastData, SeasonalOutlook, SeasonalPeriod,
  SeasonalRawPeriod, SeasonalValue, SeasonalVariable, SeasonKey, SeasonName,
} from '../types/weather';

const SEASONAL_URL = 'https://seasonal-api.open-meteo.com/v1/seasonal';
const DAY_MS = 24 * 60 * 60 * 1000;

export const SEASONAL_VARIABLES: SeasonalVariable[] = ['temperature', 'precipitation', 'pressure', 'sunshine', 'snowfall'];

const API_PREFIX: Record<SeasonalVariable, string> = {
  temperature: 'temperature_2m',
  precipitation: 'precipitation',
  pressure: 'pressure_msl',
  sunshine: 'sunshine_duration',
  snowfall: 'snowfall',
};

// Weekly (EC46) has `_anomaly_gt0` probabilities only for these; monthly (SEAS5) has none
const PROB_VARIABLES: SeasonalVariable[] = ['temperature', 'precipitation', 'pressure'];

// Weekly/monthly precip, sunshine and snow are period totals; temp and pressure are period means
const IS_TOTAL: Record<SeasonalVariable, boolean> = {
  temperature: false, precipitation: true, pressure: false, sunshine: true, snowfall: true,
};

// --- Date helpers (plain YYYY-MM-DD strings, UTC arithmetic) ---

const toMs = (d: string) => Date.parse(`${d}T00:00:00Z`);
const toDateStr = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const addDays = (d: string, n: number) => toDateStr(toMs(d) + n * DAY_MS);
const daysBetween = (a: string, b: string) => Math.round((toMs(b) - toMs(a)) / DAY_MS);
const monthIndex = (d: string) => Number(d.slice(0, 4)) * 12 + Number(d.slice(5, 7)) - 1;
const monthStart = (idx: number) => `${Math.floor(idx / 12)}-${String((idx % 12) + 1).padStart(2, '0')}-01`;
const monthEnd = (d: string) => toDateStr(Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)), 0));

// Calendar date at the location (falls back to the device timezone)
export function getLocalToday(timezone?: string, now = Date.now()): string {
  const opts: Intl.DateTimeFormatOptions = { year: 'numeric', month: '2-digit', day: '2-digit' };
  try {
    return new Intl.DateTimeFormat('en-CA', { ...opts, timeZone: timezone }).format(now);
  } catch {
    return new Intl.DateTimeFormat('en-CA', opts).format(now);
  }
}

// EC46 is published daily around 20:30 UTC — the latest run is "today" only after ~22:00 UTC.
// Used as cache key so cached data is refetched exactly once a new run is out.
export function getExpectedRun(now = Date.now()): string {
  return toDateStr(now - 22 * 60 * 60 * 1000);
}

// --- Fetch & parse ---

function variableList(vars: SeasonalVariable[], withProb: boolean): string {
  return vars.flatMap(v => {
    const p = API_PREFIX[v];
    const fields = [`${p}_mean`, `${p}_anomaly`];
    if (withProb && PROB_VARIABLES.includes(v)) fields.push(`${p}_anomaly_gt0`);
    return fields;
  }).join(',');
}

const num = (x: unknown): number | null => (typeof x === 'number' && Number.isFinite(x) ? x : null);

function parseBlock(block: Record<string, unknown[]> | undefined, withProb: boolean): SeasonalRawPeriod[] {
  if (!block || !Array.isArray(block.time)) return [];
  const periods: SeasonalRawPeriod[] = [];
  block.time.forEach((start, i) => {
    if (typeof start !== 'string') return;
    let hasData = false;
    const values = {} as Record<SeasonalVariable, SeasonalValue>;
    for (const v of SEASONAL_VARIABLES) {
      const p = API_PREFIX[v];
      const anomaly = num(block[`${p}_anomaly`]?.[i]);
      if (anomaly !== null) hasData = true;
      values[v] = {
        mean: num(block[`${p}_mean`]?.[i]),
        anomaly,
        probAbove: withProb ? num(block[`${p}_anomaly_gt0`]?.[i]) : null,
      };
    }
    // Arrays run past the model horizon with nulls — keep only periods that carry data
    if (hasData) periods.push({ start, values });
  });
  return periods;
}

/**
 * Fetches weekly (EC46) and/or monthly (SEAS5) anomalies.
 * forecast_days=215 keeps all 7 SEAS5 months even between the 1st and the 5th, when the
 * newest issue is still last month's.
 */
export async function fetchSeasonal(
  latitude: number,
  longitude: number,
  { vars = SEASONAL_VARIABLES, weekly = true }: { vars?: SeasonalVariable[]; weekly?: boolean } = {}
): Promise<SeasonalForecastData> {
  const weeklyParam = weekly ? `&weekly=${variableList(vars, true)}` : '';
  const url = `${SEASONAL_URL}?latitude=${latitude}&longitude=${longitude}${weeklyParam}&monthly=${variableList(vars, false)}&forecast_days=215`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Seasonal API error ${res.status}`);
  const json = await res.json();
  return {
    weekly: parseBlock(json.weekly, true),
    monthly: parseBlock(json.monthly, false),
  };
}

// --- Seasons ---

export function getClimateZone(latitude: number): ClimateZone {
  if (Math.abs(latitude) < 23.44) return 'tropical';
  return latitude < 0 ? 'south' : 'north';
}

const SEASON_BY_MONTH: SeasonKey[] = ['DJF', 'DJF', 'MAM', 'MAM', 'MAM', 'JJA', 'JJA', 'JJA', 'SON', 'SON', 'SON', 'DJF'];
const NORTH_NAMES: Record<SeasonKey, SeasonName> = { DJF: 'winter', MAM: 'spring', JJA: 'summer', SON: 'autumn' };
const SOUTH_NAMES: Record<SeasonKey, SeasonName> = { DJF: 'summer', MAM: 'autumn', JJA: 'winter', SON: 'spring' };

// null for tropical locations: the widget shows the 3-month block (e.g. "dic–feb") instead
export function getSeasonName(key: SeasonKey, zone: ClimateZone): SeasonName | null {
  if (zone === 'tropical') return null;
  return zone === 'south' ? SOUTH_NAMES[key] : NORTH_NAMES[key];
}

// --- Confidence ---

const LEVEL_RANK: Record<ConfidenceLevel, number> = { low: 0, medium: 1, high: 2 };

// Weekly: share of the 51 EC46 members agreeing on the anomaly sign (avg of temp/precip/pressure).
// Week 3+ is capped at medium — sub-seasonal skill drops sharply even when members agree.
function weeklyConfidence(values: Record<SeasonalVariable, SeasonalValue>, lead: number) {
  const agreements = PROB_VARIABLES
    .map(v => values[v].probAbove)
    .filter((p): p is number => p !== null)
    .map(p => Math.max(p, 100 - p));
  const agreement = agreements.length
    ? Math.round(agreements.reduce((a, b) => a + b, 0) / agreements.length)
    : null;
  let confidence: ConfidenceLevel = agreement === null
    ? (lead < 2 ? 'medium' : 'low')
    : agreement >= 80 ? 'high' : agreement >= 65 ? 'medium' : 'low';
  if (lead >= 2 && confidence === 'high') confidence = 'medium';
  return { agreement, confidence };
}

// Monthly: SEAS5 offers no probabilities via the API, so lead time is the only honest signal.
// Current and next month: medium. Later: low. Never high.
const monthlyConfidence = (lead: number): ConfidenceLevel => (lead <= 1 ? 'medium' : 'low');

// --- Building the three tiers ---

// A current month with this many days or fewer left is hidden — "Next weeks" covers it better
const MIN_REMAINING_DAYS = 7;

function aggregate(months: SeasonalPeriod[]): Record<SeasonalVariable, SeasonalValue> {
  const totalDays = months.reduce((a, m) => a + m.days, 0);
  const values = {} as Record<SeasonalVariable, SeasonalValue>;
  for (const v of SEASONAL_VARIABLES) {
    const combine = (pick: (s: SeasonalValue) => number | null): number | null => {
      if (!months.length) return null;
      const xs = months.map(m => pick(m.values[v]));
      if (xs.some(x => x === null)) return null;
      return IS_TOTAL[v]
        ? (xs as number[]).reduce((a, b) => a + b, 0)
        : (xs as number[]).reduce((a, x, i) => a + x * months[i].days, 0) / totalDays;
    };
    values[v] = { mean: combine(s => s.mean), anomaly: combine(s => s.anomaly), probAbove: null };
  }
  return values;
}

function emptyValues(): Record<SeasonalVariable, SeasonalValue> {
  const values = {} as Record<SeasonalVariable, SeasonalValue>;
  for (const v of SEASONAL_VARIABLES) values[v] = { mean: null, anomaly: null, probAbove: null };
  return values;
}

function seasonColumn(
  kind: 'rest' | 'next', startIdx: number, expectedIdx: number[], months: SeasonalPeriod[], today: string
): SeasonalPeriod {
  const covered = months.filter(m => expectedIdx.includes(monthIndex(m.start)));
  const end = monthEnd(monthStart(startIdx + 2));
  const start = kind === 'rest' ? today : monthStart(startIdx);
  const confidence = covered.reduce<ConfidenceLevel>(
    (min, m) => (LEVEL_RANK[m.confidence] < LEVEL_RANK[min] ? m.confidence : min), 'medium'
  );
  return {
    start,
    end,
    days: daysBetween(start, end) + 1,
    inProgress: kind === 'rest',
    values: covered.length ? aggregate(covered) : emptyValues(),
    confidence: covered.length ? confidence : 'low',
    agreement: null,
    season: {
      key: SEASON_BY_MONTH[startIdx % 12],
      kind,
      months: covered.map(m => m.start),
      monthsExpected: expectedIdx.length,
    },
  };
}

export function buildOutlook(data: SeasonalForecastData, today: string, latitude: number): SeasonalOutlook {
  // Weeks: EC46 week 1 starts last Monday — kept and flagged as in progress (it is the most skilful week)
  const weeks: SeasonalPeriod[] = data.weekly
    .map((p, lead) => ({
      start: p.start,
      end: addDays(p.start, 6),
      days: 7,
      inProgress: p.start < today,
      values: p.values,
      ...weeklyConfidence(p.values, lead),
    }))
    .filter(p => p.end >= today);

  // Months: SEAS5 starts at its issue month, which can be entirely in the past (1st–5th of a month)
  const todayIdx = monthIndex(today);
  const months: SeasonalPeriod[] = data.monthly
    .map(p => {
      const end = monthEnd(p.start);
      return {
        start: p.start,
        end,
        days: daysBetween(p.start, end) + 1,
        inProgress: p.start < today,
        values: p.values,
        confidence: monthlyConfidence(monthIndex(p.start) - todayIdx),
        agreement: null,
      };
    })
    .filter(p => daysBetween(today, p.end) + 1 > (p.inProgress ? MIN_REMAINING_DAYS : 0));

  // Seasons: meteorological 3-month blocks; Dec belongs to the following DJF
  const month = Number(today.slice(5, 7));
  const seasonStartIdx = todayIdx - ((month % 12) % 3);
  const firstShownIdx = months.length && monthIndex(months[0].start) === todayIdx ? todayIdx : todayIdx + 1;
  const restIdx: number[] = [];
  for (let i = firstShownIdx; i <= seasonStartIdx + 2; i++) restIdx.push(i);
  const nextStartIdx = seasonStartIdx + 3;

  return {
    weeks,
    months,
    seasons: [
      seasonColumn('rest', seasonStartIdx, restIdx, months, today),
      seasonColumn('next', nextStartIdx, [nextStartIdx, nextStartIdx + 1, nextStartIdx + 2], months, today),
    ],
    zone: getClimateZone(latitude),
    today,
    seas5Issue: data.monthly[0]?.start ?? null,
  };
}

// --- Anomaly classification & formatting ---

export type AnomalyLevel = -2 | -1 | 0 | 1 | 2;

export interface AnomalyDisplay {
  level: AnomalyLevel;
  value: string; // signed number, e.g. "+1.5"
  unit: string;  // "°", "%", "mm", "hPa", "h", "cm"
}

// Floors (per day) for the relative scale, so near-zero climatologies don't explode into ±500 %
const REL_FLOOR_PER_DAY: Partial<Record<SeasonalVariable, number>> = {
  precipitation: 0.5, // mm
  sunshine: 1800,     // s (0.5 h)
  snowfall: 0.3,      // cm
};

// [near-normal limit, strong limit] — absolute for temp (K) & pressure (hPa), relative (%) otherwise
const THRESHOLDS: Record<SeasonalVariable, [number, number]> = {
  temperature: [0.5, 1.5],
  pressure: [1, 4],
  precipitation: [10, 30],
  sunshine: [10, 25],
  snowfall: [20, 50],
};

const signed = (x: number, digits: number) => {
  const r = Number(Math.abs(x).toFixed(digits));
  if (r === 0) return `±${(0).toFixed(digits)}`;
  return `${x > 0 ? '+' : '−'}${r.toFixed(digits)}`;
};

export function classifyAnomaly(variable: SeasonalVariable, v: SeasonalValue, days: number): AnomalyDisplay | null {
  if (v.anomaly === null) return null;
  const a = v.anomaly;
  let score: number;
  let value: string;
  let unit: string;

  if (variable === 'temperature' || variable === 'pressure') {
    score = a;
    value = signed(a, 1);
    unit = variable === 'temperature' ? '°' : 'hPa';
  } else {
    const floor = (REL_FLOOR_PER_DAY[variable] ?? 0) * days;
    const clim = v.mean !== null ? v.mean - a : null;
    score = (a / Math.max(clim ?? 0, floor)) * 100;
    if (variable === 'precipitation' && clim !== null && clim >= floor) {
      value = signed(score, 0);
      unit = '%';
    } else if (variable === 'precipitation') {
      value = signed(a, 1);
      unit = 'mm';
    } else if (variable === 'sunshine') {
      const h = a / 3600;
      value = signed(h, Math.abs(h) < 10 ? 1 : 0);
      unit = 'h';
    } else {
      value = signed(a, 1);
      unit = 'cm';
    }
  }

  const [near, strong] = THRESHOLDS[variable];
  const mag = Math.abs(score);
  const level = (mag < near ? 0 : (mag < strong ? 1 : 2) * Math.sign(score)) as AnomalyLevel;
  return { level, value, unit };
}

// Absolute value for the detail line (secondary info only)
export function formatAbsolute(variable: SeasonalVariable, x: number | null): string {
  if (x === null) return '—';
  switch (variable) {
    case 'temperature': return `${x.toFixed(1)} °C`;
    case 'precipitation': return `${Math.round(x)} mm`;
    case 'pressure': return `${x.toFixed(1)} hPa`;
    case 'sunshine': return `${Math.round(x / 3600)} h`;
    case 'snowfall': return `${x.toFixed(1)} cm`;
  }
}

/**
 * A row is shown when at least one period has data. Snowfall additionally needs a real
 * snow signal (forecast or normal ≥ 0.05 cm/day ≈ 1.5 cm/month), which hides it in
 * Santo Domingo or Auckland.
 */
export function hasMeaningfulRow(variable: SeasonalVariable, periods: SeasonalPeriod[]): boolean {
  const withData = periods.filter(p => p.values[variable].anomaly !== null);
  if (!withData.length) return false;
  if (variable !== 'snowfall') return true;
  return withData.some(p => {
    const { mean, anomaly } = p.values.snowfall;
    if (mean === null || anomaly === null) return false;
    return Math.max(mean, mean - anomaly) / p.days >= 0.05;
  });
}

// Diverging palette per variable: [strong below, mild below, near, mild above, strong above].
// Text colour per step keeps WCAG AA contrast on the cell background.
const PALETTE: Record<SeasonalVariable, [string, string, string, string]> = {
  temperature: ['bg-blue-600 text-white', 'bg-sky-300 text-slate-900', 'bg-orange-300 text-slate-900', 'bg-red-600 text-white'],
  precipitation: ['bg-amber-700 text-white', 'bg-amber-200 text-slate-900', 'bg-emerald-300 text-slate-900', 'bg-emerald-700 text-white'],
  pressure: ['bg-pink-700 text-white', 'bg-pink-300 text-slate-900', 'bg-indigo-300 text-slate-900', 'bg-indigo-600 text-white'],
  sunshine: ['bg-slate-500 text-white', 'bg-slate-300 text-slate-900', 'bg-yellow-200 text-slate-900', 'bg-yellow-400 text-slate-900'],
  snowfall: ['bg-stone-600 text-white', 'bg-stone-300 text-slate-900', 'bg-cyan-200 text-slate-900', 'bg-cyan-400 text-slate-900'],
};

export function getAnomalyClass(variable: SeasonalVariable, level: AnomalyLevel, surface: 'dark' | 'light' = 'dark'): string {
  if (level === 0) return surface === 'dark' ? 'bg-white/10 text-white ring-1 ring-inset ring-white/20' : 'bg-slate-100 text-slate-700';
  const p = PALETTE[variable];
  return level === -2 ? p[0] : level === -1 ? p[1] : level === 1 ? p[2] : p[3];
}
