import type { HourlyWeather } from '../types/weather';
import { getGustLevel, type GustLevel } from './weatherCodes';

// Pure calculations behind the hero alert badges (moved out of App.tsx unchanged, so they can
// be tested). `hourly` is the 25-entry window starting at the current hour, times in UTC.

export type NightType = 'ecuatorial' | 'torrida' | 'tropical';
export type FrostType = 'ice' | 'frost';
export type PrecipType = 'rain' | 'snow' | 'freezing';

export interface PrecipOnset {
  minutesFromNow: number;
  type: PrecipType;
}

export interface WindAlert {
  gusts: number;
  minutesFromNow: number;
  level: GustLevel;
}

const toMs = (time: string) => new Date(time + 'Z').getTime();

/** Precipitation total (mm, 1 decimal) over the first `hours` entries (default: all). */
export function sumPrecip(hourly: HourlyWeather[], hours = hourly.length): number {
  let sum = 0;
  for (const h of hourly.slice(0, hours)) sum += h.precipitation || 0;
  return Math.round(sum * 10) / 10;
}

const hourFormatters = new Map<string, Intl.DateTimeFormat>();

/**
 * Hour of day (0–23) of a UTC hourly timestamp at the *location* (IANA `timeZone`).
 * Falls back to the device timezone when the zone is missing or invalid.
 */
export function localHour(time: string, timeZone?: string | null): number {
  const key = timeZone ?? '';
  let fmt = hourFormatters.get(key);
  if (!fmt) {
    try {
      fmt = new Intl.DateTimeFormat('en-GB', {
        hour: '2-digit',
        hourCycle: 'h23',
        timeZone: timeZone ?? undefined,
      });
    } catch {
      fmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hourCycle: 'h23' });
    }
    hourFormatters.set(key, fmt);
  }
  return Number(fmt.format(toMs(time)));
}

/** Night type from tonight's minimum (local hours 20–06 at the location). */
export function getNightType(
  hourly: HourlyWeather[],
  timeZone?: string | null,
): NightType | null {
  const tonight = hourly.filter((h) => {
    const hour = localHour(h.time, timeZone);
    return hour >= 20 || hour <= 6;
  });
  if (!tonight.length) return null;
  const minTonight = Math.min(...tonight.map((h) => h.temperature));
  if (minTonight > 25) return 'ecuatorial';
  if (minTonight >= 25) return 'torrida';
  if (minTonight >= 20) return 'tropical';
  return null;
}

/**
 * Ice (min ≤ 0 °C) or frost (min ≤ 2 °C or dew point ≤ 0 °C) overnight (local hours 20–08
 * at the location).
 */
export function getFrostType(
  hourly: HourlyWeather[],
  timeZone?: string | null,
): FrostType | null {
  const overnight = hourly.filter((h) => {
    const hour = localHour(h.time, timeZone);
    return hour >= 20 || hour <= 8;
  });
  if (!overnight.length) return null;
  const minTemp = Math.min(...overnight.map((h) => h.temperature));
  const dewPoints = overnight
    .map((h) => h.dewPoint)
    .filter((d): d is number => d !== undefined);
  const minDewPoint = dewPoints.length ? Math.min(...dewPoints) : Infinity;
  if (minTemp <= 0) return 'ice';
  if (minTemp <= 2 || minDewPoint <= 0) return 'frost';
  return null;
}

const SNOW_CODES = new Set([71, 72, 73, 74, 75, 76, 77, 85, 86]);
const FREEZING_CODES = new Set([56, 57, 66, 67]);

/** First hour with ≥ 0.1 mm, its type and how far away it is. */
export function getPrecipOnset(hourly: HourlyWeather[], now: number): PrecipOnset | null {
  const h = hourly.find((x) => x.precipitation >= 0.1);
  if (!h) return null;
  const minutesFromNow = Math.max(0, Math.round((toMs(h.time) - now) / 60000));
  let type: PrecipType = 'rain';
  if ((h.snowfall ?? 0) > 0 || SNOW_CODES.has(h.weatherCode)) type = 'snow';
  else if (FREEZING_CODES.has(h.weatherCode)) type = 'freezing';
  return { minutesFromNow, type };
}

/** Current gusts if already at a level, else the first of the next 12 hours that reaches one. */
export function getWindAlert(
  currentGusts: number,
  hourly: HourlyWeather[],
  now: number,
): WindAlert | null {
  const currentLevel = getGustLevel(currentGusts);
  if (currentLevel)
    return { gusts: Math.round(currentGusts), minutesFromNow: 0, level: currentLevel };
  for (const h of hourly.slice(1, 13)) {
    const level = getGustLevel(h.windGusts);
    if (level) {
      const minutesFromNow = Math.max(0, Math.round((toMs(h.time) - now) / 60000));
      return { gusts: Math.round(h.windGusts), minutesFromNow, level };
    }
  }
  return null;
}

/** "now" / "in 40min" / "in 3h" (es: "ahora" / "en 40min" / "en 3h"). */
export function formatLeadTime(minutesFromNow: number, isEn: boolean): string {
  if (minutesFromNow <= 0) return isEn ? 'now' : 'ahora';
  const prefix = isEn ? 'in' : 'en';
  if (minutesFromNow < 60) return `${prefix} ${minutesFromNow}min`;
  return `${prefix} ${Math.floor(minutesFromNow / 60)}h`;
}
