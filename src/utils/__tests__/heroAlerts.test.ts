import { describe, it, expect } from 'vite-plus/test';
import { TEMP_TREND_MIN_DELTA, isWindTileLevel, tempTrend } from '../heroAlerts';
import {
  migraineLevelIndex,
  compassIndex,
  roundHighLow,
  showGusts,
  uvShown,
} from '../heroMetrics';
import { URGENT_MAX_BANNERS, formatClock, nextSunEvent, splitUrgent } from '../heroAlerts';
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

describe('hero tile thresholds', () => {
  it('tempTrend drops swings below the threshold', () => {
    expect(TEMP_TREND_MIN_DELTA).toBe(1.5);
    expect(tempTrend(0.2, 0.2)).toBeNull();
    expect(tempTrend(null, -1.4)).toBeNull();
    expect(tempTrend(null, null)).toBeNull();
  });
  it('tempTrend uses 6h, falling back to 3h', () => {
    expect(tempTrend(1, 1.5)).toEqual({ delta: 1.5, span: 6 });
    expect(tempTrend(-2, null)).toEqual({ delta: -2, span: 3 });
  });
  it('wind tile excludes breezy', () => {
    expect(isWindTileLevel('breezy')).toBe(false);
    expect(isWindTileLevel('strong')).toBe(true);
  });
});

describe('heroMetrics', () => {
  it('uvShown hides rounded 0', () => {
    expect(uvShown(0.4)).toBe(false);
    expect(uvShown(0.5)).toBe(true);
    expect(uvShown(null)).toBe(false);
  });
  it('showGusts from breezy', () => {
    expect(showGusts(27)).toBe(false);
    expect(showGusts(28)).toBe(true);
  });
  it('roundHighLow', () => {
    expect(roundHighLow(9.4, 4.6)).toEqual({ max: 9, min: 5 });
    expect(roundHighLow(NaN, 1)).toBeNull();
    expect(roundHighLow(undefined, 1)).toBeNull();
  });
  it('compassIndex wraps', () => {
    expect(compassIndex(360)).toBe(0);
    expect(compassIndex(225)).toBe(5);
    expect(compassIndex(-45)).toBe(7);
  });
});

describe('splitUrgent', () => {
  const c = (key: string, severity: number) => ({ key, severity });
  it('moves severity >= 70 to banners, highest first, max 2', () => {
    const { urgent, rest } = splitUrgent([
      c('a', 58),
      c('b', 80),
      c('c', 95),
      c('d', 72),
      c('e', 10),
    ]);
    expect(urgent.map((x) => x.key)).toEqual(['c', 'b']);
    expect(rest.map((x) => x.key)).toEqual(['d', 'a', 'e']);
    expect(urgent.length).toBeLessThanOrEqual(URGENT_MAX_BANNERS);
  });
  it('never duplicates or drops an alert', () => {
    const all = [c('a', 100), c('b', 70), c('c', 69), c('d', 90)];
    const { urgent, rest } = splitUrgent(all);
    expect([...urgent, ...rest].map((x) => x.key).sort()).toEqual(['a', 'b', 'c', 'd']);
  });
  it('no severe alert → no banner', () => {
    expect(splitUrgent([c('a', 69)]).urgent).toEqual([]);
  });
});

describe('nextSunEvent', () => {
  const daily = [
    { sunrise: '2026-11-20T06:48', sunset: '2026-11-20T15:52' },
    { sunrise: '2026-11-21T06:50', sunset: '2026-11-21T15:50' },
  ];
  const at = (s: string) => new Date(s + 'Z').getTime();
  it('daytime → today sunset', () => {
    expect(nextSunEvent(daily, at('2026-11-20T10:00'))?.kind).toBe('sunset');
  });
  it('before sunrise → today sunrise', () => {
    expect(nextSunEvent(daily, at('2026-11-20T03:00'))?.kind).toBe('sunrise');
  });
  it('after sunset → tomorrow sunrise', () => {
    expect(nextSunEvent(daily, at('2026-11-20T20:00'))).toEqual({
      kind: 'sunrise',
      at: at('2026-11-21T06:50'),
    });
  });
  it('no data → null', () => {
    expect(nextSunEvent([{ sunrise: '', sunset: '' }], 0)).toBeNull();
    expect(nextSunEvent(daily, at('2026-12-01T00:00'))).toBeNull();
  });
  it('formatClock uses the given timezone', () => {
    expect(formatClock(at('2026-11-20T15:52'), 'Europe/Zurich')).toBe('16:52');
    expect(formatClock(at('2026-11-20T15:52'), 'Pacific/Auckland')).toBe('04:52');
  });
});

describe('migraineLevelIndex', () => {
  it('maps scores to the five levels', () => {
    expect([0, 1, 2, 3, 4, 5, 6].map(migraineLevelIndex)).toEqual([0, 0, 1, 2, 3, 3, 4]);
  });
});
