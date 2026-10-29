import type { DailyWeather, SummaryHour, WakingWindow } from '../types/weather';
import type { Language } from '../hooks/useLanguage';
import { getGustLevel, getMigraineRisk, GUST_THRESHOLDS, type GustLevel } from './weatherCodes';

// "Today & Tomorrow" summary: verdicts for the user's waking hours, in the location's local time.
// Pure functions only — wording lives in TodayTomorrowSummary.tsx.

const HOUR_MS = 60 * 60 * 1000;

export const SUMMARY_THRESHOLDS = {
  feltSimilar: 2,     // °C: |Δ felt max| below this → "similar to today"
  feltStrong: 4,      // °C: ranks higher in the teaser
  precipMm: 0.1,      // mm/h counted as precipitation
  wetProb: 40,        // %: modelled precip with at least this probability → "wet" hour
  possibleProb: 30,   // %: this probability alone (no modelled amount) → "possible" hour
  minProb: 15,        // %: modelled precip below this probability is ignored
  takeMm: 0.5,        // mm over wet hours → "take an umbrella"
  nightMm: 1,         // mm of night rain worth a side note
  nightSnowCm: 0.5,   // cm of night snow worth a side note
  wetMorningHours: 3, // rain in the last N night hours → wet roads when the day starts
  aqiNotable: 40,     // above "Fair" in getAqiInfo
  aqiPoor: 60,        // above "Moderate" in getAqiInfo
  pollenNotable: 10,  // above "Low" in getPollenLevel
  pollenHigh: 50,     // above "Mod" in getPollenLevel
  pressureDrop6h: -3, // same as the ⚡ 6h badge in the hero
} as const;

export type DayKey = 'today' | 'tomorrow';
export type PrecipKind = 'rain' | 'snow' | 'mixed' | 'freezing';
export interface HourRange { from: number; to: number } // local hours, `to` exclusive (may be 24)
export interface FeltRange { min: number; max: number }

export interface UmbrellaVerdict {
  level: 'none' | 'maybe' | 'take';
  kind: PrecipKind;
  ranges: HourRange[];
  intermittent: boolean; // more than two separate spells, shown as one span
  mm: number;
  cm: number;
  maxProb: number | null;
  thunder: boolean;
}

export interface WindVerdict {
  level: GustLevel | null; // null = below the hero's "breezy" threshold
  gusts: number;
  ranges: HourRange[];
}

export interface DayPart {
  date: string; // local YYYY-MM-DD
  from: number;
  to: number;
  felt: FeltRange | null;
  umbrella: UmbrellaVerdict | null; // null = no precipitation data
  wind: WindVerdict | null;         // null = no gust data
}

export interface NightNote {
  from: number;
  to: number;
  precip: { kind: PrecipKind; mm: number; cm: number; ranges: HourRange[] } | null;
  wetMorning: boolean;
  thunder: boolean;
  wind: { level: GustLevel; gusts: number } | null;
  frost: 'ice' | 'frost' | null;
  warmNight: 'ecuatorial' | 'torrida' | 'tropical' | null;
  minTemp: number | null;
}

export interface DaySummary {
  today: DayPart | null;    // remaining waking hours; null once today's window is over
  tomorrow: DayPart | null;
  earlyNight: NightNote | null; // now → today's window start (only when opened before it)
  night: NightNote | null;      // today's window end → tomorrow's window start
  todayFelt: FeltRange | null;  // full waking window of today — basis of the comparison
  feltDelta: number | null;     // tomorrow − today felt max (full windows), °C
  todayDaily: DailyWeather | null;
  tomorrowDaily: DailyWeather | null;
}

interface LocalHour extends SummaryHour {
  ms: number;
  date: string;
  hour: number;
}

// --- Local time of the location (IANA timezone; falls back to the device timezone) ---

function makeLocalizer(timezone?: string | null) {
  const opts: Intl.DateTimeFormatOptions = { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' };
  let fmt: Intl.DateTimeFormat;
  try {
    fmt = new Intl.DateTimeFormat('en-CA', { ...opts, timeZone: timezone ?? undefined });
  } catch {
    fmt = new Intl.DateTimeFormat('en-CA', opts);
  }
  return (ms: number) => {
    const p: Record<string, string> = {};
    for (const { type, value } of fmt.formatToParts(ms)) p[type] = value;
    return { date: `${p.year}-${p.month}-${p.day}`, hour: Number(p.hour) };
  };
}

const nextDate = (d: string) => new Date(Date.parse(`${d}T00:00:00Z`) + 24 * HOUR_MS).toISOString().slice(0, 10);
const round1 = (n: number) => Math.round(n * 10) / 10;
const sum = (hs: LocalHour[], f: (h: LocalHour) => number | null) => hs.reduce((acc, h) => acc + (f(h) ?? 0), 0);
const values = (hs: LocalHour[], f: (h: LocalHour) => number | null) =>
  hs.map(f).filter((v): v is number => v !== null && Number.isFinite(v));

// --- Hour classification (codes as in precipOnset / getWeatherInfo) ---

const isThunder = (c: number | null) => c === 95 || c === 96 || c === 99;
const isFreezing = (c: number | null) => c === 56 || c === 57 || c === 66 || c === 67;
const isSnow = (h: SummaryHour) =>
  (h.snowfall ?? 0) > 0 || (h.weatherCode !== null && ((h.weatherCode >= 71 && h.weatherCode <= 77) || h.weatherCode === 85 || h.weatherCode === 86));
const hasPrecip = (h: SummaryHour) => (h.precipitation ?? 0) >= SUMMARY_THRESHOLDS.precipMm;
// Missing probability doesn't block a modelled amount (amount alone still counts)
const isWet = (h: SummaryHour) =>
  hasPrecip(h) && (h.precipProbability === null || h.precipProbability >= SUMMARY_THRESHOLDS.wetProb);
// A modelled amount the ensemble gives almost no chance (< minProb) is not even "possible"
const isPossible = (h: SummaryHour) =>
  (hasPrecip(h) && (h.precipProbability === null || h.precipProbability >= SUMMARY_THRESHOLDS.minProb))
  || (h.precipProbability ?? 0) >= SUMMARY_THRESHOLDS.possibleProb
  || isThunder(h.weatherCode);

// Groups picked hours into spells; a single dry hour between two spells doesn't split them
function spells(seg: LocalHour[], pick: (h: LocalHour) => boolean) {
  const idx = seg.flatMap((h, i) => (pick(h) ? [i] : []));
  const groups: [number, number][] = [];
  for (const i of idx) {
    const last = groups[groups.length - 1];
    if (last && i - last[1] <= 2) last[1] = i;
    else groups.push([i, i]);
  }
  const toRange = ([a, b]: [number, number]): HourRange => ({ from: seg[a].hour, to: seg[b].hour + 1 });
  const hours = idx.map(i => seg[i]);
  if (groups.length > 2) {
    return { hours, ranges: [toRange([groups[0][0], groups[groups.length - 1][1]])], intermittent: true };
  }
  return { hours, ranges: groups.map(toRange), intermittent: false };
}

function precipKind(hours: LocalHour[]): PrecipKind {
  const withPrecip = hours.filter(hasPrecip);
  const base = withPrecip.length ? withPrecip : hours;
  if (base.some(h => isFreezing(h.weatherCode))) return 'freezing';
  const snowHours = base.filter(isSnow).length;
  if (snowHours === 0) return 'rain';
  return snowHours === base.length ? 'snow' : 'mixed';
}

function feltRange(seg: LocalHour[]): FeltRange | null {
  const v = values(seg, h => h.apparentTemperature);
  return v.length ? { min: Math.round(Math.min(...v)), max: Math.round(Math.max(...v)) } : null;
}

function assessUmbrella(seg: LocalHour[]): UmbrellaVerdict | null {
  if (seg.every(h => h.precipitation === null && h.precipProbability === null)) return null;

  const wet = spells(seg, isWet);
  const wetMm = sum(wet.hours, h => h.precipitation);
  let level: UmbrellaVerdict['level'] = 'none';
  let picked = wet;
  if (wetMm >= SUMMARY_THRESHOLDS.takeMm || wet.hours.some(h => isThunder(h.weatherCode))) {
    level = 'take';
  } else {
    picked = spells(seg, isPossible);
    if (picked.hours.length) level = 'maybe';
  }
  if (level === 'none') {
    return { level, kind: 'rain', ranges: [], intermittent: false, mm: 0, cm: 0, maxProb: null, thunder: false };
  }

  const probs = values(picked.hours, h => h.precipProbability);
  return {
    level,
    kind: precipKind(picked.hours),
    ranges: picked.ranges,
    intermittent: picked.intermittent,
    mm: round1(sum(picked.hours, h => h.precipitation)),
    cm: round1(sum(picked.hours, h => h.snowfall)),
    maxProb: probs.length ? Math.max(...probs) : null,
    thunder: picked.hours.some(h => isThunder(h.weatherCode)),
  };
}

// Same gust levels as the hero wind badge (getGustLevel)
function assessWind(seg: LocalHour[]): WindVerdict | null {
  const gusts = values(seg, h => h.windGusts);
  if (!gusts.length) return null;
  const max = Math.max(...gusts);
  const level = getGustLevel(max);
  if (!level) return { level: null, gusts: Math.round(max), ranges: [] };
  const { ranges } = spells(seg, h => (h.windGusts ?? 0) >= GUST_THRESHOLDS[level]);
  return { level, gusts: Math.round(max), ranges };
}

function assessNight(seg: LocalHour[]): NightNote | null {
  if (!seg.length) return null;

  const wet = spells(seg, isWet);
  const mm = round1(sum(wet.hours, h => h.precipitation));
  const cm = round1(sum(seg, h => h.snowfall));
  const precip = mm >= SUMMARY_THRESHOLDS.nightMm || cm >= SUMMARY_THRESHOLDS.nightSnowCm
    ? { kind: precipKind(wet.hours.length ? wet.hours : seg.filter(isSnow)), mm, cm, ranges: wet.ranges }
    : null;
  const wetMorning = !!precip && precip.kind !== 'snow' && seg.slice(-SUMMARY_THRESHOLDS.wetMorningHours).some(isWet);

  const gusts = values(seg, h => h.windGusts);
  const maxGust = gusts.length ? Math.max(...gusts) : 0;
  const gustLevel = getGustLevel(maxGust);
  const wind = gustLevel && gustLevel !== 'breezy' ? { level: gustLevel, gusts: Math.round(maxGust) } : null;

  // Thresholds as frostType / nightType in App.tsx
  const temps = values(seg, h => h.temperature);
  const minTemp = temps.length ? Math.min(...temps) : null;
  const frost = minTemp === null ? null : minTemp <= 0 ? 'ice' : minTemp <= 2 ? 'frost' : null;
  const warmNight = minTemp === null ? null : minTemp > 25 ? 'ecuatorial' : minTemp >= 25 ? 'torrida' : minTemp >= 20 ? 'tropical' : null;
  const thunder = seg.some(h => isThunder(h.weatherCode));

  if (!precip && !thunder && !wind && !frost && !warmNight) return null;
  return {
    from: seg[0].hour,
    to: seg[seg.length - 1].hour + 1,
    precip, wetMorning, thunder, wind, frost, warmNight,
    minTemp: minTemp === null ? null : Math.round(minTemp),
  };
}

function dayPart(date: string, seg: LocalHour[]): DayPart | null {
  if (!seg.length) return null;
  return {
    date,
    from: seg[0].hour,
    to: seg[seg.length - 1].hour + 1,
    felt: feltRange(seg),
    umbrella: assessUmbrella(seg),
    wind: assessWind(seg),
  };
}

export function buildDaySummary({ hours, daily, timezone, now, wakingWindow, currentGusts }: {
  hours: SummaryHour[];
  daily: DailyWeather[];
  timezone?: string | null;
  now: number;
  wakingWindow: WakingWindow;
  currentGusts?: number; // current gust reading, merged into the current hour (the hero badge uses it)
}): DaySummary {
  const local = makeLocalizer(timezone);
  const today = local(now).date;
  const tomorrow = nextDate(today);
  const { start, end } = wakingWindow;

  const all: LocalHour[] = hours.map(h => {
    const ms = Date.parse(h.time + 'Z');
    const isCurrent = ms <= now && now < ms + HOUR_MS;
    const windGusts = isCurrent && currentGusts !== undefined ? Math.max(h.windGusts ?? currentGusts, currentGusts) : h.windGusts;
    return { ...h, windGusts, ms, ...local(ms) };
  });
  const inWindow = (h: LocalHour) => h.hour >= start && h.hour < end;
  const remaining = (h: LocalHour) => h.ms + HOUR_MS > now;

  const todayFull = all.filter(h => h.date === today && inWindow(h));
  const tomorrowFull = all.filter(h => h.date === tomorrow && inWindow(h));
  const earlySeg = all.filter(h => h.date === today && h.hour < start && remaining(h));
  const nightSeg = all.filter(h => remaining(h) && ((h.date === today && h.hour >= end) || (h.date === tomorrow && h.hour < start)));

  // Comparison only when both full windows have a felt value for every hour
  const complete = (seg: LocalHour[]) => seg.length > 0 && seg.every(h => h.apparentTemperature !== null);
  const feltDelta = complete(todayFull) && complete(tomorrowFull)
    ? Math.round(Math.max(...values(tomorrowFull, h => h.apparentTemperature)) - Math.max(...values(todayFull, h => h.apparentTemperature)))
    : null;

  return {
    today: dayPart(today, todayFull.filter(remaining)),
    tomorrow: dayPart(tomorrow, tomorrowFull),
    earlyNight: assessNight(earlySeg),
    night: assessNight(nightSeg),
    todayFelt: feltRange(todayFull),
    feltDelta,
    todayDaily: daily.find(d => d.date === today) ?? null,
    tomorrowDaily: daily.find(d => d.date === tomorrow) ?? null,
  };
}

// Same inputs as the first row of FutureForecast (interday ΔP of daily means), so both always agree
export function getTomorrowMigraine(todayDaily: DailyWeather | null, tomorrowDaily: DailyWeather | null, lang: Language) {
  if (!todayDaily || !tomorrowDaily) return null;
  if (![todayDaily.meanPressure, tomorrowDaily.meanPressure, tomorrowDaily.humidity].every(Number.isFinite)) return null;
  const deltaP = Math.round(tomorrowDaily.meanPressure - todayDaily.meanPressure);
  return getMigraineRisk(deltaP, tomorrowDaily.meanPressure, tomorrowDaily.humidity, tomorrowDaily.precipitation, lang);
}

// --- Teaser ranking ---

export interface HealthSignals {
  todayMigraine: number | null;    // hero MIGR score
  tomorrowMigraine: number | null; // FutureForecast score
  pressureDrop6h: number | null;   // only set when the hero shows the ⚡ 6h badge
  aqi: number | null;              // current hour (today only)
  maxPollen: number | null;        // current hour (today only)
}

export type Highlight =
  | { topic: 'umbrella'; day: DayKey; umbrella: UmbrellaVerdict }
  | { topic: 'wind'; day: DayKey; level: GustLevel; gusts: number; ranges: HourRange[] }
  | { topic: 'felt'; day: 'tomorrow'; delta: number; feltMax: number }
  | { topic: 'migraine'; day: DayKey; score: number }
  | { topic: 'pressure'; day: 'today'; delta: number }
  | { topic: 'air'; day: 'today'; aqi: number }
  | { topic: 'pollen'; day: 'today'; value: number }
  | { topic: 'calm'; day: DayKey; felt: FeltRange | null };

const WIND_WEIGHT: Record<GustLevel, number> = { storm: 90, gale: 90, strong: 60, breezy: 20 };
const SECONDARY_MIN_WEIGHT = 30;

// Up to two points for the teaser: the most important one, plus a second if it matters too.
// Today outranks tomorrow at equal weight; health "now" values only count while today is shown.
export function getHighlights(s: DaySummary, health: HealthSignals): Highlight[] {
  const candidates: { h: Highlight; w: number }[] = [];
  const add = (h: Highlight, w: number) => candidates.push({ h, w });

  for (const [day, part, offset] of [['today', s.today, 0], ['tomorrow', s.tomorrow, 5]] as const) {
    if (!part) continue;
    const u = part.umbrella;
    if (u?.level === 'take') add({ topic: 'umbrella', day, umbrella: u }, (u.thunder ? 100 : 80) - offset);
    if (u?.level === 'maybe') add({ topic: 'umbrella', day, umbrella: u }, 35 - offset);
    const w = part.wind;
    if (w?.level) add({ topic: 'wind', day, level: w.level, gusts: w.gusts, ranges: w.ranges }, WIND_WEIGHT[w.level] - offset);
    const score = day === 'today' ? health.todayMigraine : health.tomorrowMigraine;
    if (score !== null && score >= 2) add({ topic: 'migraine', day, score }, (score >= 6 ? 85 : score >= 4 ? 75 : score >= 3 ? 45 : 18) - offset);
  }

  if (s.tomorrow?.felt && s.feltDelta !== null && Math.abs(s.feltDelta) >= SUMMARY_THRESHOLDS.feltSimilar) {
    add({ topic: 'felt', day: 'tomorrow', delta: s.feltDelta, feltMax: s.tomorrow.felt.max },
      Math.abs(s.feltDelta) >= SUMMARY_THRESHOLDS.feltStrong ? 58 : 50);
  }

  if (s.today) {
    if (health.pressureDrop6h !== null) add({ topic: 'pressure', day: 'today', delta: health.pressureDrop6h }, 46);
    if (health.aqi !== null && health.aqi > SUMMARY_THRESHOLDS.aqiNotable) {
      add({ topic: 'air', day: 'today', aqi: health.aqi }, health.aqi > SUMMARY_THRESHOLDS.aqiPoor ? 44 : 22);
    }
    if (health.maxPollen !== null && health.maxPollen > SUMMARY_THRESHOLDS.pollenHigh) {
      add({ topic: 'pollen', day: 'today', value: health.maxPollen }, 30);
    }
  }

  candidates.sort((a, b) => b.w - a.w); // stable: insertion order (today first) breaks ties
  const [first, ...rest] = candidates;
  if (!first) {
    const day: DayKey | null = s.today ? 'today' : s.tomorrow ? 'tomorrow' : null;
    return day ? [{ topic: 'calm', day, felt: (day === 'today' ? s.today : s.tomorrow)?.felt ?? null }] : [];
  }
  const second = rest.find(c => c.h.topic !== first.h.topic && c.w >= SECONDARY_MIN_WEIGHT);
  return second ? [first.h, second.h] : [first.h];
}
