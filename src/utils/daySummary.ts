import type { DailyWeather, SummaryHour, WakingWindow } from '../types/weather';
import { getGustLevel, GUST_THRESHOLDS, type GustLevel } from './weatherCodes';

// "Today & Tomorrow" summary: verdicts for the user's waking hours, in the location's local time.
// Pure functions only — wording lives in TodayTomorrowSummary.tsx.

const HOUR_MS = 60 * 60 * 1000;

export const SUMMARY_THRESHOLDS = {
  feltSimilar: 2, // °C: |Δ felt max| below this → "similar to today"
  feltStrong: 4, // °C: ranks higher in the teaser
  precipMm: 0.1, // mm/h counted as precipitation
  wetProb: 40, // %: modelled precip with at least this probability → "wet" hour
  possibleProb: 50, // %: an hour at or above this probability (with or without an amount) is "possible"
  takeMm: 0.5, // mm over wet hours → "take an umbrella"
  nightMm: 1, // mm of night rain worth a side note
  nightSnowCm: 0.5, // cm of night snow worth a side note
  wetMorningHours: 3, // rain in the last N night hours → wet roads when the day starts
  aqiNotable: 40, // above "Fair" in getAqiInfo
  aqiPoor: 60, // above "Moderate" in getAqiInfo
  pollenNotable: 10, // above "Low" in getPollenLevel
  pollenHigh: 50, // above "Mod" in getPollenLevel
  pressureDrop6h: -3, // same as the ⚡ 6h badge in the hero
} as const;

export type DayKey = 'today' | 'tomorrow' | 'dayAfterTomorrow';
export type PrecipKind = 'rain' | 'snow' | 'mixed' | 'freezing';
export interface HourRange {
  from: number;
  to: number;
} // local hours, `to` exclusive (may be 24)
export interface FeltRange {
  min: number;
  max: number;
}

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
  wind: WindVerdict | null; // null = no gust data
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
  today: DayPart | null; // remaining waking hours; null once today's window is over
  tomorrow: DayPart | null;
  dayAfterTomorrow: DayPart | null;
  earlyNight: NightNote | null; // now → today's window start (only when opened before it)
  night: NightNote | null; // today's window end → tomorrow's window start
  nightAfterTomorrow: NightNote | null;
  todayFelt: FeltRange | null; // full waking window of today — basis of the comparison
  tomorrowFelt: FeltRange | null;
  feltDelta: number | null; // tomorrow − today felt max (full windows), °C
  feltDeltaDayAfter: number | null;
  todayDaily: DailyWeather | null;
  tomorrowDaily: DailyWeather | null;
  dayAfterTomorrowDaily: DailyWeather | null;
}

interface LocalHour extends SummaryHour {
  ms: number;
  date: string;
  hour: number;
}

// --- Local time of the location (IANA timezone; falls back to the device timezone) ---

function makeLocalizer(timezone?: string | null) {
  const opts: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  };
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

const nextDate = (d: string) =>
  new Date(Date.parse(`${d}T00:00:00Z`) + 24 * HOUR_MS).toISOString().slice(0, 10);
const round1 = (n: number) => Math.round(n * 10) / 10;
const sum = (hs: LocalHour[], f: (h: LocalHour) => number | null) =>
  hs.reduce((acc, h) => acc + (f(h) ?? 0), 0);
const values = (hs: LocalHour[], f: (h: LocalHour) => number | null) =>
  hs.map(f).filter((v): v is number => v !== null && Number.isFinite(v));

// --- Hour classification (codes as in precipOnset / getWeatherInfo) ---

const isThunder = (c: number | null) => c === 95 || c === 96 || c === 99;
const isFreezing = (c: number | null) => c === 56 || c === 57 || c === 66 || c === 67;
const isSnow = (h: SummaryHour) =>
  (h.snowfall ?? 0) > 0 ||
  (h.weatherCode !== null &&
    ((h.weatherCode >= 71 && h.weatherCode <= 77) ||
      h.weatherCode === 85 ||
      h.weatherCode === 86));
const hasPrecip = (h: SummaryHour) => (h.precipitation ?? 0) >= SUMMARY_THRESHOLDS.precipMm;
// Missing probability doesn't block a modelled amount (amount alone still counts)
const isWet = (h: SummaryHour) =>
  hasPrecip(h) &&
  (h.precipProbability === null || h.precipProbability >= SUMMARY_THRESHOLDS.wetProb);
// "Possible" needs a ≥ possibleProb chance; a modelled amount without any probability still counts
const isPossible = (h: SummaryHour) =>
  (hasPrecip(h) && h.precipProbability === null) ||
  (h.precipProbability ?? 0) >= SUMMARY_THRESHOLDS.possibleProb ||
  isThunder(h.weatherCode);

// Groups picked hours into spells; a single dry hour between two spells doesn't split them
// eslint-disable-next-line sonarjs/cognitive-complexity
function spells(seg: LocalHour[], pick: (h: LocalHour) => boolean) {
  const idx = seg.flatMap((h, i) => (pick(h) ? [i] : []));
  const groups: [number, number][] = [];
  for (const i of idx) {
    const last = groups[groups.length - 1];
    if (last && i - last[1] <= 2) last[1] = i;
    else groups.push([i, i]);
  }
  const toRange = ([a, b]: [number, number]): HourRange => ({
    from: seg[a].hour,
    to: seg[b].hour + 1,
  });
  const hours = idx.map((i) => seg[i]);
  if (groups.length > 2) {
    return {
      hours,
      ranges: [toRange([groups[0][0], groups[groups.length - 1][1]])],
      intermittent: true,
    };
  }
  return { hours, ranges: groups.map(toRange), intermittent: false };
}

function precipKind(hours: LocalHour[]): PrecipKind {
  const withPrecip = hours.filter(hasPrecip);
  const base = withPrecip.length ? withPrecip : hours;
  if (base.some((h) => isFreezing(h.weatherCode))) return 'freezing';
  const snowHours = base.filter(isSnow).length;
  if (snowHours === 0) return 'rain';
  return snowHours === base.length ? 'snow' : 'mixed';
}

function feltRange(seg: LocalHour[]): FeltRange | null {
  const v = values(seg, (h) => h.apparentTemperature);
  return v.length ? { min: Math.round(Math.min(...v)), max: Math.round(Math.max(...v)) } : null;
}

// eslint-disable-next-line sonarjs/cognitive-complexity
function assessUmbrella(seg: LocalHour[]): UmbrellaVerdict | null {
  if (seg.every((h) => h.precipitation === null && h.precipProbability === null)) return null;

  const wet = spells(seg, isWet);
  const wetMm = sum(wet.hours, (h) => h.precipitation);
  let level: UmbrellaVerdict['level'] = 'none';
  let picked = wet;
  if (wetMm >= SUMMARY_THRESHOLDS.takeMm || wet.hours.some((h) => isThunder(h.weatherCode))) {
    level = 'take';
  } else {
    picked = spells(seg, isPossible);
    if (picked.hours.length) level = 'maybe';
  }
  if (level === 'none') {
    return {
      level,
      kind: 'rain',
      ranges: [],
      intermittent: false,
      mm: 0,
      cm: 0,
      maxProb: null,
      thunder: false,
    };
  }

  const probs = values(picked.hours, (h) => h.precipProbability);
  return {
    level,
    kind: precipKind(picked.hours),
    ranges: picked.ranges,
    intermittent: picked.intermittent,
    mm: round1(sum(picked.hours, (h) => h.precipitation)),
    cm: round1(sum(picked.hours, (h) => h.snowfall)),
    maxProb: probs.length ? Math.max(...probs) : null,
    thunder: picked.hours.some((h) => isThunder(h.weatherCode)),
  };
}

// Same gust levels as the hero wind badge (getGustLevel)
function assessWind(seg: LocalHour[]): WindVerdict | null {
  const gusts = values(seg, (h) => h.windGusts);
  if (!gusts.length) return null;
  const max = Math.max(...gusts);
  const level = getGustLevel(max);
  if (!level) return { level: null, gusts: Math.round(max), ranges: [] };
  const { ranges } = spells(seg, (h) => (h.windGusts ?? 0) >= GUST_THRESHOLDS[level]);
  return { level, gusts: Math.round(max), ranges };
}

// eslint-disable-next-line sonarjs/cognitive-complexity
function assessNight(seg: LocalHour[]): NightNote | null {
  if (!seg.length) return null;

  const wet = spells(seg, isWet);
  const mm = round1(sum(wet.hours, (h) => h.precipitation));
  const cm = round1(sum(seg, (h) => h.snowfall));
  const precip =
    mm >= SUMMARY_THRESHOLDS.nightMm || cm >= SUMMARY_THRESHOLDS.nightSnowCm
      ? {
          kind: precipKind(wet.hours.length ? wet.hours : seg.filter(isSnow)),
          mm,
          cm,
          ranges: wet.ranges,
        }
      : null;
  const wetMorning =
    !!precip &&
    precip.kind !== 'snow' &&
    seg.slice(-SUMMARY_THRESHOLDS.wetMorningHours).some(isWet);

  const gusts = values(seg, (h) => h.windGusts);
  const maxGust = gusts.length ? Math.max(...gusts) : 0;
  const gustLevel = getGustLevel(maxGust);
  const wind =
    gustLevel && gustLevel !== 'breezy'
      ? { level: gustLevel, gusts: Math.round(maxGust) }
      : null;

  // Thresholds as frostType / nightType in App.tsx
  const temps = values(seg, (h) => h.temperature);
  const minTemp = temps.length ? Math.min(...temps) : null;
  let frost: 'ice' | 'frost' | null = null;
  if (minTemp !== null) {
    if (minTemp <= 0) frost = 'ice';
    else if (minTemp <= 2) frost = 'frost';
  }
  let warmNight: 'ecuatorial' | 'torrida' | 'tropical' | null = null;
  if (minTemp !== null) {
    if (minTemp > 25) warmNight = 'ecuatorial';
    else if (minTemp >= 25) warmNight = 'torrida';
    else if (minTemp >= 20) warmNight = 'tropical';
  }
  const thunder = seg.some((h) => isThunder(h.weatherCode));

  if (!precip && !thunder && !wind && !frost && !warmNight) return null;
  return {
    from: seg[0].hour,
    to: seg[seg.length - 1].hour + 1,
    precip,
    wetMorning,
    thunder,
    wind,
    frost,
    warmNight,
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

export function buildDaySummary({
  hours,
  daily,
  timezone,
  now,
  wakingWindow,
  currentGusts,
}: {
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

  const all: LocalHour[] = hours.map((h) => {
    const ms = Date.parse(h.time + 'Z');
    const isCurrent = ms <= now && now < ms + HOUR_MS;
    const windGusts =
      isCurrent && currentGusts !== undefined
        ? Math.max(h.windGusts ?? currentGusts, currentGusts)
        : h.windGusts;
    return { ...h, windGusts, ms, ...local(ms) };
  });
  const inWindow = (h: LocalHour) => h.hour >= start && h.hour < end;
  const remaining = (h: LocalHour) => h.ms + HOUR_MS > now;

  const todayFull = all.filter((h) => h.date === today && inWindow(h));
  const tomorrowFull = all.filter((h) => h.date === tomorrow && inWindow(h));
  const dayAfterTomorrowDate = nextDate(tomorrow);
  const dayAfterTomorrowFull = all.filter(
    (h) => h.date === dayAfterTomorrowDate && inWindow(h),
  );
  const earlySeg = all.filter((h) => h.date === today && h.hour < start && remaining(h));
  const nightSeg = all.filter(
    (h) =>
      remaining(h) &&
      ((h.date === today && h.hour >= end) || (h.date === tomorrow && h.hour < start)),
  );
  const nightAfterTomorrowSeg = all.filter(
    (h) =>
      remaining(h) &&
      ((h.date === tomorrow && h.hour >= end) ||
        (h.date === dayAfterTomorrowDate && h.hour < start)),
  );

  // Comparison only when both full windows have a felt value for every hour
  const complete = (seg: LocalHour[]) =>
    seg.length > 0 && seg.every((h) => h.apparentTemperature !== null);
  const feltDelta =
    complete(todayFull) && complete(tomorrowFull)
      ? Math.round(
          Math.max(...values(tomorrowFull, (h) => h.apparentTemperature)) -
            Math.max(...values(todayFull, (h) => h.apparentTemperature)),
        )
      : null;
  const feltDeltaDayAfter =
    complete(tomorrowFull) && complete(dayAfterTomorrowFull)
      ? Math.round(
          Math.max(...values(dayAfterTomorrowFull, (h) => h.apparentTemperature)) -
            Math.max(...values(tomorrowFull, (h) => h.apparentTemperature)),
        )
      : null;

  return {
    today: dayPart(today, todayFull.filter(remaining)),
    tomorrow: dayPart(tomorrow, tomorrowFull),
    dayAfterTomorrow: dayPart(dayAfterTomorrowDate, dayAfterTomorrowFull),
    earlyNight: assessNight(earlySeg),
    night: assessNight(nightSeg),
    nightAfterTomorrow: assessNight(nightAfterTomorrowSeg),
    todayFelt: feltRange(todayFull),
    tomorrowFelt: feltRange(tomorrowFull),
    feltDelta,
    feltDeltaDayAfter,
    todayDaily: daily.find((d) => d.date === today) ?? null,
    tomorrowDaily: daily.find((d) => d.date === tomorrow) ?? null,
    dayAfterTomorrowDaily: daily.find((d) => d.date === dayAfterTomorrowDate) ?? null,
  };
}

// --- Hero rain strip: fixed next N hours from the current hour (not the waking window) ---

export const RAIN_STRIP_HOURS = 12;

// Sunshine seconds within an hour: ≥ 30 min = sun, ≥ 10 min = partly sunny
export const SUN_FULL_S = 1800;
export const SUN_SOME_S = 600;

// Night sky from cloud cover (%): ≤ 30 clear, ≤ 70 partly, above cloudy
export const NIGHT_CLEAR_MAX = 30;
export const NIGHT_PARTLY_MAX = 70;

export interface RainStripHour {
  ms: number; // UTC start of the hour
  hour: number; // local hour at the location
  mm: number | null; // null = no data (never drawn as dry)
  prob: number | null;
  kind: 'rain' | 'snow' | 'freezing' | null; // null = below the precipitation threshold
  sky: 'sun' | 'partly' | 'cloud' | 'moon' | 'moon_partly' | null; // dry sky; null = wet or no data
}

export interface RainOutlook {
  hours: RainStripHour[];
  umbrella: UmbrellaVerdict | null; // same rules as the Today & Tomorrow dialog, applied to these hours
  startsNow: boolean; // the first spell includes the current hour
  mm: number; // total over the strip
  cm: number;
  clearLevel: 'clear' | 'mixed'; // clear hours (sun/moon) ≥ half of the known-sky hours → 'clear'
  headerSky: 'sun' | 'moon' | 'partly' | 'moon_partly' | null; // first clear hour's sky, else first partly hour's
  clearRanges: HourRange[]; // spells of clear hours ('clear') or clear + partly hours ('mixed'), merged like rain spells
  clearIntermittent: boolean; // more than two clear spells, shown as one span
  clearStartsNow: boolean; // the first clear spell includes the current hour
  sunHours: number; // total sunshine over the strip in hours (nulls skipped)
}

type Sky = RainStripHour['sky'];
const isClearSky = (k: Sky) => k === 'sun' || k === 'moon';
const isPartlySky = (k: Sky) => k === 'partly' || k === 'moon_partly';

function clearSummary(skies: Sky[]) {
  const clear = skies.filter(isClearSky).length;
  const known = skies.filter((k) => k !== null).length;
  const level: RainOutlook['clearLevel'] = clear * 2 >= known && clear > 0 ? 'clear' : 'mixed';
  const header = skies.find(isClearSky) ?? skies.find(isPartlySky) ?? null;
  const pick = (k: Sky) => isClearSky(k) || (level === 'mixed' && isPartlySky(k));
  return { level, header: header as RainOutlook['headerSky'], pick };
}

function nightSky(cover: number | null | undefined): RainStripHour['sky'] {
  if (cover == null) return null;
  if (cover <= NIGHT_CLEAR_MAX) return 'moon';
  return cover <= NIGHT_PARTLY_MAX ? 'moon_partly' : 'cloud';
}

function daySky(h: SummaryHour): RainStripHour['sky'] {
  const s = h.sunshine ?? null;
  if (s === null) return null;
  if (s >= SUN_FULL_S) return 'sun';
  if (s >= SUN_SOME_S) return 'partly';
  return h.isDay === true ? 'cloud' : null;
}

function stripSky(h: SummaryHour, kind: RainStripHour['kind']): RainStripHour['sky'] {
  if (kind !== null) return null;
  return h.isDay === false ? nightSky(h.cloudCover) : daySky(h);
}

function stripKind(h: SummaryHour): RainStripHour['kind'] {
  if (!hasPrecip(h) && (h.snowfall ?? 0) <= 0) return null;
  if (isFreezing(h.weatherCode)) return 'freezing';
  return isSnow(h) ? 'snow' : 'rain';
}

export function buildRainOutlook({
  hours,
  now,
  timezone,
  span = RAIN_STRIP_HOURS,
}: {
  hours: SummaryHour[];
  now: number;
  timezone?: string | null;
  span?: number;
}): RainOutlook | null {
  const local = makeLocalizer(timezone);
  const startIdx = hours.findIndex((h) => {
    const ms = Date.parse(`${h.time}Z`);
    return ms <= now && now < ms + HOUR_MS;
  });
  if (startIdx < 0) return null;
  const seg: LocalHour[] = hours.slice(startIdx, startIdx + span).map((h) => {
    const ms = Date.parse(`${h.time}Z`);
    return { ...h, ms, ...local(ms) };
  });
  if (!seg.length) return null;

  const umbrella = assessUmbrella(seg);
  const strip: RainStripHour[] = seg.map((h) => {
    const kind = stripKind(h);
    return {
      ms: h.ms,
      hour: h.hour,
      mm: h.precipitation,
      prob: h.precipProbability,
      kind,
      sky: stripSky(h, kind),
    };
  });
  const first = umbrella?.ranges[0];
  const skyOf = new Map(seg.map((h, i) => [h.ms, strip[i].sky]));
  const cs = clearSummary(strip.map((h) => h.sky));
  const sunny = spells(seg, (h) => cs.pick(skyOf.get(h.ms) ?? null));
  return {
    hours: strip,
    umbrella,
    startsNow: !!first && umbrella?.level !== 'none' && first.from === seg[0].hour,
    mm: round1(sum(seg, (h) => h.precipitation)),
    cm: round1(sum(seg, (h) => h.snowfall)),
    clearLevel: cs.level,
    headerSky: cs.header,
    clearRanges: sunny.ranges,
    clearIntermittent: sunny.intermittent,
    clearStartsNow: sunny.ranges[0]?.from === seg[0].hour,
    sunHours: round1(sum(seg, (h) => h.sunshine ?? 0) / 3600),
  };
}

// --- Teaser ranking ---

export interface HealthSignals {
  pressureDrop6h: number | null; // only set when the hero shows the ⚡ 6h badge
  aqi: number | null; // current hour (today only)
  maxPollen: number | null; // current hour (today only)
}

export type Highlight =
  | { topic: 'umbrella'; day: DayKey; umbrella: UmbrellaVerdict }
  | { topic: 'wind'; day: DayKey; level: GustLevel; gusts: number; ranges: HourRange[] }
  | { topic: 'felt'; day: 'tomorrow' | 'dayAfterTomorrow'; delta: number; feltMax: number }
  | { topic: 'pressure'; day: 'today'; delta: number }
  | { topic: 'air'; day: 'today'; aqi: number }
  | { topic: 'pollen'; day: 'today'; value: number }
  | { topic: 'calm'; day: DayKey; felt: FeltRange | null };

const DAY_ORDER: DayKey[] = ['today', 'tomorrow', 'dayAfterTomorrow'];
const WIND_WEIGHT: Record<GustLevel, number> = { storm: 90, gale: 90, strong: 60, breezy: 20 };
const SECONDARY_MIN_WEIGHT = 30;

// Up to two points for the teaser: the most important one, plus a second if it matters too.
// Today outranks tomorrow at equal weight; health "now" values only count while today is shown.
// eslint-disable-next-line sonarjs/cognitive-complexity
export function getHighlights(
  s: DaySummary,
  health: HealthSignals,
  { omitTodayUmbrella = false }: { omitTodayUmbrella?: boolean } = {},
): Highlight[] {
  const candidates: { h: Highlight; w: number }[] = [];
  const add = (h: Highlight, w: number) => candidates.push({ h, w });

  for (const [day, part, offset] of [
    ['today', s.today, 0],
    ['tomorrow', s.tomorrow, 5],
    ['dayAfterTomorrow', s.dayAfterTomorrow, 10],
  ] as const) {
    if (!part) continue;
    // The hero rain strip already shows today's rain when it covers the rest of today's window
    const u = day === 'today' && omitTodayUmbrella ? null : part.umbrella;
    if (u?.level === 'take')
      add({ topic: 'umbrella', day, umbrella: u }, (u.thunder ? 100 : 80) - offset);
    if (u?.level === 'maybe') add({ topic: 'umbrella', day, umbrella: u }, 35 - offset);
    const w = part.wind;
    if (w?.level)
      add(
        { topic: 'wind', day, level: w.level, gusts: w.gusts, ranges: w.ranges },
        WIND_WEIGHT[w.level] - offset,
      );
  }

  if (
    s.tomorrow?.felt &&
    s.feltDelta !== null &&
    Math.abs(s.feltDelta) >= SUMMARY_THRESHOLDS.feltSimilar
  ) {
    add(
      { topic: 'felt', day: 'tomorrow', delta: s.feltDelta, feltMax: s.tomorrow.felt.max },
      Math.abs(s.feltDelta) >= SUMMARY_THRESHOLDS.feltStrong ? 58 : 50,
    );
  }
  if (
    s.dayAfterTomorrow?.felt &&
    s.feltDeltaDayAfter !== null &&
    Math.abs(s.feltDeltaDayAfter) >= SUMMARY_THRESHOLDS.feltSimilar
  ) {
    add(
      {
        topic: 'felt',
        day: 'dayAfterTomorrow',
        delta: s.feltDeltaDayAfter,
        feltMax: s.dayAfterTomorrow.felt.max,
      },
      Math.abs(s.feltDeltaDayAfter) >= SUMMARY_THRESHOLDS.feltStrong ? 48 : 40,
    );
  }

  if (s.today) {
    if (health.pressureDrop6h !== null)
      add({ topic: 'pressure', day: 'today', delta: health.pressureDrop6h }, 46);
    if (health.aqi !== null && health.aqi > SUMMARY_THRESHOLDS.aqiNotable) {
      add(
        { topic: 'air', day: 'today', aqi: health.aqi },
        health.aqi > SUMMARY_THRESHOLDS.aqiPoor ? 44 : 22,
      );
    }
    if (health.maxPollen !== null && health.maxPollen > SUMMARY_THRESHOLDS.pollenHigh) {
      add({ topic: 'pollen', day: 'today', value: health.maxPollen }, 30);
    }
  }

  // Significant candidates rank chronologically (earlier day first, then weight); the rest by weight
  const dayIndex = (h: Highlight) => DAY_ORDER.indexOf(h.day);
  const significant = candidates
    .filter((c) => c.w >= SECONDARY_MIN_WEIGHT)
    .sort((a, b) => dayIndex(a.h) - dayIndex(b.h) || b.w - a.w);
  const minor = candidates.filter((c) => c.w < SECONDARY_MIN_WEIGHT).sort((a, b) => b.w - a.w);
  const [first, ...rest] = [...significant, ...minor];
  if (!first) {
    let day: DayKey | null = null;
    if (s.today) day = 'today';
    else if (s.tomorrow) day = 'tomorrow';
    else if (s.dayAfterTomorrow) day = 'dayAfterTomorrow';
    if (!day) return [];
    const calmdayFelt = day === 'today' ? s.today : s.tomorrow;
    return [{ topic: 'calm', day, felt: calmdayFelt?.felt ?? null }];
  }
  const second = rest.find((c) => c.h.topic !== first.h.topic && c.w >= SECONDARY_MIN_WEIGHT);
  return second ? [first.h, second.h] : [first.h];
}

// --- Dialog presentation helpers (pure) ---

const DAY_KEYS: DayKey[] = ['today', 'tomorrow', 'dayAfterTomorrow'];

export type FeltAdjective = 'cooler' | 'colder' | 'warmer' | 'hotter' | 'milder';

// Adjective depends on how warm the day feels: "colder" in the cold, "hotter" in the heat
export function feltAdjective(delta: number, feltMax: number): FeltAdjective {
  if (delta < 0) return feltMax < 10 ? 'colder' : 'cooler';
  if (feltMax >= 25) return 'hotter';
  return feltMax < 10 ? 'milder' : 'warmer';
}

export interface FeltComparison {
  similar: boolean;
  adjective: FeltAdjective;
  delta: number; // this day's felt max − the base day's felt max
  tone: 'colder' | 'warmer' | 'similar';
  base: FeltRange; // the day it is compared with: today for tomorrow, tomorrow for the day after
}

// `delta` must be the matching DaySummary field (feltDelta vs today, feltDeltaDayAfter vs tomorrow)
// and `base` the matching basis range (todayFelt / tomorrowFelt).
export function compareFelt(
  delta: number | null,
  felt: FeltRange | null,
  base: FeltRange | null,
): FeltComparison | null {
  if (delta === null || !felt || !base) return null;
  const similar = Math.abs(delta) < SUMMARY_THRESHOLDS.feltSimilar;
  let tone: FeltComparison['tone'] = 'similar';
  if (!similar) tone = delta < 0 ? 'colder' : 'warmer';
  return { similar, adjective: feltAdjective(delta, felt.max), delta, tone, base };
}

export interface DayOverview {
  day: DayKey;
  part: DayPart;
  weatherCode: number | null; // the day's daily WMO code
  felt: FeltRange | null;
  umbrella: UmbrellaVerdict | null;
  strongWind: GustLevel | null; // only strong / gale / storm (breezy is not worth a glyph)
}

const OVERCAST_CODE = 3;

// A day the umbrella verdict calls dry must not wear a rain/snow/thunder icon: show overcast instead
export function overviewSky(
  code: number | null,
  umbrellaLevel: UmbrellaVerdict['level'] | null,
) {
  if (code !== null && code >= 51 && umbrellaLevel === 'none') return OVERCAST_CODE;
  return code;
}

const isStrongWind = (level: GustLevel | null | undefined): level is GustLevel =>
  level === 'strong' || level === 'gale' || level === 'storm';

// One compact card per shown day; skips days without data (today once its window is over)
export function buildOverview(summary: DaySummary): DayOverview[] {
  const dailies = {
    today: summary.todayDaily,
    tomorrow: summary.tomorrowDaily,
    dayAfterTomorrow: summary.dayAfterTomorrowDaily,
  };
  return DAY_KEYS.flatMap((day) => {
    const part = summary[day];
    if (!part) return [];
    return [
      {
        day,
        part,
        weatherCode: overviewSky(
          dailies[day]?.weatherCode ?? null,
          part.umbrella?.level ?? null,
        ),
        felt: part.felt,
        umbrella: part.umbrella,
        strongWind: isStrongWind(part.wind?.level) ? part.wind.level : null,
      },
    ];
  });
}

// Dry (umbrella verdict "none") and no wind worth mentioning → one collapsed row
export function isCalmDay(part: DayPart): boolean {
  return part.umbrella?.level === 'none' && !part.wind?.level;
}

export interface NightChip {
  id: string;
  labelKey: string;
  vars: Record<string, string | number>;
  varKeys: Record<string, string>; // translation keys resolved (and lower-cased) into vars
  ranges: HourRange[];
  tone: 'rain' | 'wind' | 'cold' | 'warm' | 'storm';
}

function chip(
  id: string,
  tone: NightChip['tone'],
  labelKey: string,
  extra: Partial<Pick<NightChip, 'vars' | 'varKeys' | 'ranges'>> = {},
): NightChip {
  return { id, tone, labelKey, vars: {}, varKeys: {}, ranges: [], ...extra };
}

function precipChip(note: NightNote): NightChip[] {
  const p = note.precip;
  if (!p) return [];
  const labelKey = `summary.night.${p.kind}`;
  return [chip('precip', 'rain', labelKey, { vars: { mm: p.mm, cm: p.cm }, ranges: p.ranges })];
}

function windChip(note: NightNote): NightChip[] {
  if (!note.wind) return [];
  return [
    chip('wind', 'wind', 'summary.night.wind', {
      vars: { g: note.wind.gusts },
      varKeys: { level: `summary.wind.${note.wind.level}` },
    }),
  ];
}

function coldChip(note: NightNote): NightChip[] {
  if (!note.frost) return [];
  return [
    chip('frost', 'cold', `summary.night.${note.frost}`, { vars: { t: note.minTemp ?? '' } }),
  ];
}

function warmChip(note: NightNote): NightChip[] {
  if (!note.warmNight) return [];
  return [
    chip('warm', 'warm', 'summary.night.warm', {
      vars: { t: note.minTemp ?? '' },
      varKeys: { label: `label.night_${note.warmNight}` },
    }),
  ];
}

// The night side notes as separate chips (wording and order: rain, wet roads, thunder, wind, cold, warm)
export function buildNightChips(note: NightNote): NightChip[] {
  return [
    ...precipChip(note),
    ...(note.wetMorning ? [chip('wet', 'rain', 'summary.night.wet_morning')] : []),
    ...(note.thunder ? [chip('thunder', 'storm', 'summary.night.thunder')] : []),
    ...windChip(note),
    ...coldChip(note),
    ...warmChip(note),
  ];
}
