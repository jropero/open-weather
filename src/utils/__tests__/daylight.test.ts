import { describe, it, expect } from 'vite-plus/test';
import {
  BRIGHT_LUX,
  buildLightOutlook,
  currentLight,
  estimateLux,
  formatLux,
  luxLevel,
} from '../daylight';
import type { SummaryHour } from '../../types/weather';

const hourStr = (ms: number) => new Date(ms).toISOString().slice(0, 13) + ':00';

// lux → radiation pair (all direct)
function mk(
  ms: number,
  lux: number | null,
  isDay: boolean | null = lux ? lux > 0 : false,
): SummaryHour {
  return {
    time: hourStr(ms),
    temperature: 10,
    apparentTemperature: 10,
    precipitation: 0,
    precipProbability: 0,
    snowfall: 0,
    weatherCode: 0,
    windGusts: 0,
    cloudCover: 0,
    isDay,
    sunshine: 0,
    directRadiation: lux === null ? null : lux / 100,
    diffuseRadiation: lux === null ? null : 0,
  };
}

const H = 3600_000;
const T0 = Date.UTC(2024, 5, 15, 0); // 2024-06-15 00:00 UTC
// lux per UTC hour 0..47 (day 1 and 2 identical): daylight 6..18
const DAY = [
  0, 0, 0, 0, 0, 0, 20, 800, 3000, 8000, 12000, 25000, 30000, 26000, 15000, 7000, 2500, 400, 30,
  0, 0, 0, 0, 0,
];
const series = (f: (i: number) => SummaryHour = (i) => mk(T0 + i * H, DAY[i % 24])) =>
  Array.from({ length: 48 }, (_, i) => f(i));

describe('estimateLux', () => {
  it('converts and keeps nulls', () => {
    expect(estimateLux(100, 50)).toBe(16000);
    expect(estimateLux(null, 50)).toBeNull();
    expect(estimateLux(10, null)).toBeNull();
  });
});

describe('raw irradiance', () => {
  it('keeps direct + diffuse W/m² per hour, null when either is missing', () => {
    const h = { ...mk(T0 + 12 * H, null, true), directRadiation: 30, diffuseRadiation: 85 };
    const o = buildLightOutlook([h], T0 + 12 * H + 60_000, 'UTC');
    expect(o?.hours[0].wm2).toBe(115);
    expect(o?.peakHour.wm2).toBe(115);
    const missing = { ...h, diffuseRadiation: null };
    expect(
      buildLightOutlook([missing, h], T0 + 12 * H + 60_000, 'UTC')?.hours[0].wm2,
    ).toBeNull();
  });
});

describe('luxLevel / formatLux', () => {
  it('levels', () => {
    expect(luxLevel(1999)).toBe('dark');
    expect(luxLevel(2000)).toBe('dim');
    expect(luxLevel(BRIGHT_LUX)).toBe('bright');
    expect(luxLevel(50000)).toBe('very_bright');
  });
  it('formats with 2 significant digits', () => {
    expect(formatLux(24600, 'en')).toBe('25k');
    expect(formatLux(24600, 'es')).toBe('25 mil');
    expect(formatLux(1540, 'es')).toBe('1,5 mil');
    expect(formatLux(1540, 'en', false)).toBe('1.5k');
    expect(formatLux(830, 'en')).toBe('830');
  });
});

describe('buildLightOutlook', () => {
  it('daytime now: block starts now, trimmed, bright ranges', () => {
    const o = buildLightOutlook(series(), T0 + 9.5 * H, 'UTC')!;
    expect(o.day).toBe('today');
    expect(o.hours[0].hour).toBe(9);
    expect(o.hours.at(-1)?.hour).toBe(17); // 18h (30 lux) trimmed
    expect(o.peakLux).toBe(30000);
    expect(o.verdict).toBe('bright');
    expect(o.brightRanges).toEqual([{ from: 10, to: 15 }]);
    expect(o.startsNow).toBe(false);
  });
  it('bright spell including now', () => {
    const o = buildLightOutlook(series(), T0 + 11 * H, 'UTC')!;
    expect(o.startsNow).toBe(true);
  });
  it('night now → tomorrow', () => {
    const o = buildLightOutlook(series(), T0 + 21 * H, 'UTC')!;
    expect(o.day).toBe('tomorrow');
    expect(o.hours[0].hour).toBe(7); // 6h (20 lux) trimmed
  });
  it('pre-sunrise → today', () => {
    const o = buildLightOutlook(series(), T0 + 3 * H, 'UTC')!;
    expect(o.day).toBe('today');
    expect(o.hours[0].hour).toBe(7);
  });
  it('hour after sunset with lux > 0 is daylight', () => {
    const hs = series((i) => mk(T0 + i * H, DAY[i % 24], DAY[i % 24] > 100));
    const o = buildLightOutlook(hs, T0 + 9 * H, 'UTC')!;
    expect(o.hours.at(-1)?.hour).toBe(17);
  });
  it('keeps nulls, never 0', () => {
    const hs = series((i) =>
      i === 10 ? mk(T0 + i * H, null, true) : mk(T0 + i * H, DAY[i % 24]),
    );
    const o = buildLightOutlook(hs, T0 + 9 * H, 'UTC')!;
    const h10 = o.hours.find((h) => h.hour === 10)!;
    expect(h10.lux).toBeNull();
    expect(h10.level).toBeNull();
  });
  it('dim and dark verdicts', () => {
    const dim = series((i) =>
      mk(T0 + i * H, DAY[i % 24] > 0 ? Math.min(DAY[i % 24], 5000) : 0),
    );
    expect(buildLightOutlook(dim, T0 + 9 * H, 'UTC')!.verdict).toBe('dim');
    const dark = series((i) => mk(T0 + i * H, DAY[i % 24] > 0 ? 1000 : 0));
    expect(buildLightOutlook(dark, T0 + 9 * H, 'UTC')!.verdict).toBe('dark');
  });
  it('old entries without radiation → null', () => {
    const hs = series((i) => {
      const h = mk(T0 + i * H, 5000) as Partial<SummaryHour>;
      delete h.directRadiation;
      delete h.diffuseRadiation;
      return h as SummaryHour;
    });
    expect(buildLightOutlook(hs, T0 + 9 * H, 'UTC')).toBeNull();
  });
  it('uses the location timezone (Auckland)', () => {
    // 2024-06-15 21:00 UTC = 09:00 NZST on the 16th; daylight hours there = UTC 19..05
    const shifted = series((i) => mk(T0 + i * H, DAY[(i + 5) % 24]));
    const o = buildLightOutlook(shifted, T0 + 21 * H, 'Pacific/Auckland')!;
    expect(o.day).toBe('today');
    const night = buildLightOutlook(shifted, T0 + 12 * H, 'Pacific/Auckland')!; // 00:00 NZ on 16th, dark
    expect(night.day).toBe('today');
  });
  it('null when no block or window not in data', () => {
    expect(
      buildLightOutlook(
        series(() => mk(0, 0)),
        T0,
        'UTC',
      ),
    ).toBeNull();
    expect(buildLightOutlook(series(), T0 - 5 * 24 * H, 'UTC')).toBeNull();
  });
});

describe('currentLight', () => {
  it('null without data', () => {
    expect(currentLight(null, 5, true)).toBeNull();
    expect(currentLight(undefined, undefined, true)).toBeNull();
  });
  it('night when zero or dark with is_day = 0', () => {
    expect(currentLight(0, 0, null)).toEqual({ kind: 'night' });
    expect(currentLight(0.2, 0.1, false)).toEqual({ kind: 'night' });
  });
  it('day with level and W/m²', () => {
    expect(currentLight(4, 44, true)).toEqual({
      kind: 'day',
      lux: 5680,
      level: 'dim',
      wm2: 48,
    });
    expect(currentLight(600, 100, true)).toMatchObject({ level: 'very_bright' });
    expect(currentLight(1, 2, false)).toMatchObject({ kind: 'day', level: 'dark' });
  });
});
