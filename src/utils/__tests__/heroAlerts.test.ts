import { describe, it, expect } from 'vite-plus/test';
import type { HourlyWeather } from '../../types/weather';
import {
  sumPrecip,
  getNightType,
  getFrostType,
  getPrecipOnset,
  getWindAlert,
  formatLeadTime,
  localHour,
} from '../heroAlerts';

const START = Date.parse('2026-11-16T12:00:00Z');
const H = 3_600_000;

/** 24 consecutive hours (UTC strings without Z, as the API returns them). */
function hours(over: (i: number) => Partial<HourlyWeather> = () => ({})): HourlyWeather[] {
  return Array.from({ length: 24 }, (_, i) => ({
    time: new Date(START + i * H).toISOString().slice(0, 16),
    temperature: 10,
    humidity: 70,
    pressure: 1013,
    precipitation: 0,
    precipProbability: 0,
    weatherCode: 3,
    windSpeed: 10,
    windGusts: 15,
    dewPoint: 5,
    snowfall: 0,
    apparentTemperature: 10,
    cape: 0,
    ...over(i),
  }));
}

describe('sumPrecip', () => {
  it('sums the first N hours, rounded to 0.1 mm', () => {
    const h = hours((i) => ({ precipitation: i < 3 ? 0.33 : 1 }));
    expect(sumPrecip(h, 3)).toBe(1);
    expect(sumPrecip(h, 6)).toBe(4);
    expect(sumPrecip(h)).toBe(22);
  });
});

// A flat 24-hour series always contains night hours in any device timezone,
// so these tests don't depend on the machine's TZ
describe('getNightType', () => {
  it('flat 26 °C → ecuatorial, 25 °C → torrida, 21 °C → tropical, 15 °C → none', () => {
    expect(getNightType(hours(() => ({ temperature: 26 })))).toBe('ecuatorial');
    expect(getNightType(hours(() => ({ temperature: 25 })))).toBe('torrida');
    expect(getNightType(hours(() => ({ temperature: 21 })))).toBe('tropical');
    expect(getNightType(hours(() => ({ temperature: 15 })))).toBeNull();
  });

  it('empty input → null', () => {
    expect(getNightType([])).toBeNull();
  });
});

describe('localHour', () => {
  it('reads the hour at the location, not on the device', () => {
    expect(localHour('2026-11-16T12:00', 'Europe/Zurich')).toBe(13); // UTC+1
    expect(localHour('2026-11-16T12:00', 'Pacific/Auckland')).toBe(1); // UTC+13
    expect(localHour('2026-11-16T12:00', 'UTC')).toBe(12);
  });

  it('an invalid zone falls back to the device timezone instead of throwing', () => {
    const h = localHour('2026-11-16T12:00', 'Not/AZone');
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThan(24);
  });
});

// Series starts 2026-11-16 12:00 UTC; index i = UTC hour (12 + i) % 24
const utcHour = (i: number) => (12 + i) % 24;

describe('night/frost use the location timezone', () => {
  it('tropical night: warm only during Auckland night hours (UTC 07–17)', () => {
    // Auckland local 20–06 = UTC 07–17; Zurich local 20–06 = UTC 19–05
    const h = hours((i) => {
      const u = utcHour(i);
      return { temperature: u >= 7 && u <= 17 ? 26 : 10 };
    });
    expect(getNightType(h, 'Pacific/Auckland')).toBe('ecuatorial');
    expect(getNightType(h, 'Europe/Zurich')).toBeNull();
  });

  it('frost: freezing only during Zurich overnight hours (UTC 20–06)', () => {
    // Zurich overnight 20–08 local = UTC 19–07; Auckland overnight = UTC 07–19
    const h = hours((i) => {
      const u = utcHour(i);
      return { temperature: u >= 20 || u <= 6 ? -1 : 10, dewPoint: 5 };
    });
    expect(getFrostType(h, 'Europe/Zurich')).toBe('ice');
    expect(getFrostType(h, 'Pacific/Auckland')).toBeNull();
  });
});

describe('getFrostType', () => {
  it('min ≤ 0 → ice, ≤ 2 → frost, dew point ≤ 0 → frost, else none', () => {
    expect(getFrostType(hours(() => ({ temperature: -1 })))).toBe('ice');
    expect(getFrostType(hours(() => ({ temperature: 2 })))).toBe('frost');
    expect(getFrostType(hours(() => ({ temperature: 5, dewPoint: -1 })))).toBe('frost');
    expect(getFrostType(hours(() => ({ temperature: 5, dewPoint: 3 })))).toBeNull();
  });
});

describe('getPrecipOnset', () => {
  it('no hour with ≥ 0.1 mm → null', () => {
    expect(
      getPrecipOnset(
        hours(() => ({ precipitation: 0.05 })),
        START,
      ),
    ).toBeNull();
  });

  it('finds the first wet hour and its lead time', () => {
    const h = hours((i) => ({ precipitation: i === 3 ? 0.4 : 0 }));
    expect(getPrecipOnset(h, START)).toEqual({ minutesFromNow: 180, type: 'rain' });
  });

  it('lead time never goes negative', () => {
    const h = hours(() => ({ precipitation: 1 }));
    expect(getPrecipOnset(h, START + 30 * 60_000)?.minutesFromNow).toBe(0);
  });

  it('snow from snowfall or snow codes; freezing from freezing codes', () => {
    expect(
      getPrecipOnset(
        hours(() => ({ precipitation: 1, snowfall: 0.2 })),
        START,
      )?.type,
    ).toBe('snow');
    expect(
      getPrecipOnset(
        hours(() => ({ precipitation: 1, weatherCode: 85 })),
        START,
      )?.type,
    ).toBe('snow');
    expect(
      getPrecipOnset(
        hours(() => ({ precipitation: 1, weatherCode: 66 })),
        START,
      )?.type,
    ).toBe('freezing');
  });
});

describe('getWindAlert', () => {
  it('current gusts at a level → reported as "now"', () => {
    expect(getWindAlert(45.4, hours(), START)).toEqual({
      gusts: 45,
      minutesFromNow: 0,
      level: 'strong',
    });
  });

  it('looks ahead up to 12 hours (skipping the current hour entry)', () => {
    const h = hours((i) => ({ windGusts: i === 5 ? 70 : 10 }));
    expect(getWindAlert(10, h, START)).toEqual({
      gusts: 70,
      minutesFromNow: 300,
      level: 'gale',
    });
  });

  it('ignores gusts beyond 12 hours and calm conditions', () => {
    const h = hours((i) => ({ windGusts: i === 13 ? 90 : 10 }));
    expect(getWindAlert(10, h, START)).toBeNull();
  });
});

describe('formatLeadTime', () => {
  it('formats now / minutes / hours in both languages', () => {
    expect(formatLeadTime(0, true)).toBe('now');
    expect(formatLeadTime(0, false)).toBe('ahora');
    expect(formatLeadTime(40, true)).toBe('in 40min');
    expect(formatLeadTime(40, false)).toBe('en 40min');
    expect(formatLeadTime(150, true)).toBe('in 2h');
  });
});
