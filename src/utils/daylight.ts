import type { SummaryHour } from '../types/weather';
import { HOUR_MS, makeLocalizer, spells, type HourRange } from './daySummary';

// Outdoor illuminance forecast. Lux is an ESTIMATE (±15 %) from the shortwave radiation the model
// provides: luminous efficacy ≈ 100 lm/W for direct sun and ≈ 120 lm/W for diffuse sky light.
export const DIRECT_EFFICACY = 100;
export const DIFFUSE_EFFICACY = 120;

export const DARK_LUX = 2000; // below: dark day
export const BRIGHT_LUX = 10000; // light-therapy threshold
export const VERY_BRIGHT_LUX = 50000;
export const EDGE_TRIM_LUX = 50; // leading/trailing hours below this are dropped from the strip
export const WINDOW_HOURS = 24;

export type LightLevel = 'dark' | 'dim' | 'bright' | 'very_bright';
export type LightVerdict = 'dark' | 'dim' | 'bright';

export function estimateLux(direct: number | null, diffuse: number | null): number | null {
  if (direct === null || diffuse === null) return null;
  return direct * DIRECT_EFFICACY + diffuse * DIFFUSE_EFFICACY;
}

export function luxLevel(lux: number): LightLevel {
  if (lux < DARK_LUX) return 'dark';
  if (lux < BRIGHT_LUX) return 'dim';
  return lux < VERY_BRIGHT_LUX ? 'bright' : 'very_bright';
}

/** "~25k" style, 2 significant digits; `sep` is the decimal separator. */
export function formatLux(lux: number, language: 'es' | 'en', long = true): string {
  const r = Number(lux.toPrecision(2));
  if (r < 1000) return String(Math.round(r));
  const n = String(r / 1000).replace('.', language === 'es' ? ',' : '.');
  if (!long) return `${n}k`;
  return language === 'es' ? `${n} mil` : `${n}k`;
}

export interface LightStripHour {
  ms: number;
  time: string;
  hour: number; // local hour at the location
  lux: number | null; // null = no data (never 0)
  level: LightLevel | null;
}

export interface LightOutlook {
  day: 'today' | 'tomorrow';
  hours: LightStripHour[];
  peakLux: number;
  peakHour: LightStripHour;
  brightRanges: HourRange[];
  startsNow: boolean; // the first bright spell includes the current hour
  verdict: LightVerdict;
}

const luxOf = (h: SummaryHour) =>
  estimateLux(h.directRadiation ?? null, h.diffuseRadiation ?? null);
// Radiation is the mean of the PRECEDING hour, so the hour after sunset can still carry light
const isDaylight = (h: SummaryHour) => h.isDay === true || (luxOf(h) ?? 0) > 0;

const isDim = (h: LightStripHour) => h.lux !== null && h.lux < EDGE_TRIM_LUX;

function trimEdges(hs: LightStripHour[]): LightStripHour[] {
  let a = 0;
  let b = hs.length;
  while (a < b && isDim(hs[a])) a++;
  while (b > a && isDim(hs[b - 1])) b--;
  return hs.slice(a, b);
}

function daylightBlock(hours: SummaryHour[], now: number): SummaryHour[] {
  const start = hours.findIndex((h) => {
    const ms = Date.parse(`${h.time}Z`);
    return ms <= now && now < ms + HOUR_MS;
  });
  if (start < 0) return [];
  const window = hours.slice(start, start + WINDOW_HOURS);
  const first = window.findIndex(isDaylight);
  if (first < 0) return [];
  const rest = window.slice(first);
  const end = rest.findIndex((h) => !isDaylight(h));
  return end < 0 ? rest : rest.slice(0, end);
}

export function buildLightOutlook(
  hours: SummaryHour[],
  now: number,
  timeZone?: string | null,
): LightOutlook | null {
  const local = makeLocalizer(timeZone);
  const strip = trimEdges(
    daylightBlock(hours, now).map((h) => {
      const ms = Date.parse(`${h.time}Z`);
      const lux = luxOf(h);
      return {
        ms,
        time: h.time,
        hour: local(ms).hour,
        lux,
        level: lux === null ? null : luxLevel(lux),
      };
    }),
  );
  const known = strip.filter((h) => h.lux !== null);
  if (!known.length) return null;

  const peakHour = known.reduce((best, h) => ((h.lux ?? 0) > (best.lux ?? 0) ? h : best));
  const peakLux = peakHour.lux ?? 0;
  const bright = spells(strip, (h) => (h.lux ?? 0) >= BRIGHT_LUX);
  let verdict: LightVerdict = 'dark';
  if (peakLux >= BRIGHT_LUX) verdict = 'bright';
  else if (peakLux >= DARK_LUX) verdict = 'dim';
  const day = local(strip[0].ms).date === local(now).date ? 'today' : 'tomorrow';
  return {
    day,
    hours: strip,
    peakLux,
    peakHour,
    brightRanges: bright.ranges,
    startsNow:
      day === 'today' && strip[0].ms <= now && bright.ranges[0]?.from === strip[0].hour,
    verdict,
  };
}
