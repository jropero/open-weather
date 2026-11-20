import { describe, it, expect } from 'vite-plus/test';
import {
  buildRainOutlook,
  RAIN_STRIP_HOURS,
  SUN_FULL_S,
  SUN_SOME_S,
  NIGHT_CLEAR_MAX,
  NIGHT_PARTLY_MAX,
} from '../daySummary';
import type { SummaryHour } from '../../types/weather';

// Hours 2024-06-15 00:00 … 2024-06-16 23:00 UTC; now = 2024-06-15 08:20 UTC
const NOW = Date.parse('2024-06-15T08:20:00Z');
const BASE = Date.parse('2024-06-15T00:00:00Z');
const H = 3600_000;

function hours(override: (i: number) => Partial<SummaryHour> = () => ({})): SummaryHour[] {
  return Array.from({ length: 48 }, (_, i) => ({
    time: new Date(BASE + i * H).toISOString().slice(0, 16),
    temperature: 10,
    apparentTemperature: 9,
    precipitation: 0,
    precipProbability: 0,
    snowfall: 0,
    weatherCode: 3,
    windGusts: 10,
    sunshine: null,
    isDay: null,
    cloudCover: null,
    ...override(i),
  }));
}

describe('buildRainOutlook', () => {
  it('covers the current hour plus the next 11 hours', () => {
    const o = buildRainOutlook({ hours: hours(), now: NOW, timezone: 'UTC' })!;
    expect(o.hours).toHaveLength(RAIN_STRIP_HOURS);
    expect(o.hours[0].hour).toBe(8);
    expect(o.hours.at(-1)!.hour).toBe(19);
    expect(o.umbrella!.level).toBe('none');
    expect(o.mm).toBe(0);
  });

  it('uses the location timezone for hour labels', () => {
    const o = buildRainOutlook({ hours: hours(), now: NOW, timezone: 'Europe/Zurich' })!;
    expect(o.hours[0].hour).toBe(10); // CEST = UTC+2
  });

  it('ignores rain outside the 12 h window', () => {
    const o = buildRainOutlook({
      hours: hours((i) => (i === 21 ? { precipitation: 5, precipProbability: 90 } : {})),
      now: NOW,
      timezone: 'UTC',
    })!;
    expect(o.umbrella!.level).toBe('none');
    expect(o.mm).toBe(0);
  });

  it('flags rain that is already falling and sums the window total', () => {
    const o = buildRainOutlook({
      hours: hours((i) =>
        i >= 8 && i <= 9 ? { precipitation: 0.6, precipProbability: 80, weatherCode: 61 } : {},
      ),
      now: NOW,
      timezone: 'UTC',
    })!;
    expect(o.umbrella!.level).toBe('take');
    expect(o.startsNow).toBe(true);
    expect(o.umbrella!.ranges).toEqual([{ from: 8, to: 10 }]);
    expect(o.mm).toBe(1.2);
    expect(o.hours[0].kind).toBe('rain');
    expect(o.hours[2].kind).toBeNull();
  });

  it('marks snow and freezing rain per hour', () => {
    const o = buildRainOutlook({
      hours: hours((i) => {
        if (i === 10) return { precipitation: 0.5, snowfall: 0.4, weatherCode: 73 };
        if (i === 11) return { precipitation: 0.5, weatherCode: 66 };
        return {};
      }),
      now: NOW,
      timezone: 'UTC',
    })!;
    expect(o.hours[2].kind).toBe('snow');
    expect(o.hours[3].kind).toBe('freezing');
    expect(o.startsNow).toBe(false);
  });

  it('keeps missing values as null instead of dry', () => {
    const o = buildRainOutlook({
      hours: hours((i) => (i === 12 ? { precipitation: null, precipProbability: null } : {})),
      now: NOW,
      timezone: 'UTC',
    })!;
    expect(o.hours[4].mm).toBeNull();
  });

  it('returns null when the current hour is not in the data', () => {
    expect(
      buildRainOutlook({ hours: hours(), now: BASE + 72 * H, timezone: 'UTC' }),
    ).toBeNull();
  });
});

describe('buildRainOutlook sky / sun', () => {
  const run = (f: (i: number) => Partial<SummaryHour>) =>
    buildRainOutlook({ hours: hours(f), now: NOW, timezone: 'UTC' })!;
  const day = { isDay: true };

  it('classifies dry daytime hours as sun / partly / cloud', () => {
    const sun = [SUN_FULL_S, SUN_FULL_S - 1, SUN_SOME_S, SUN_SOME_S - 1, 0];
    const o = run((i) => ({ ...day, sunshine: i >= 8 && i < 13 ? sun[i - 8] : null }));
    expect(o.hours.slice(0, 5).map((h) => h.sky)).toEqual([
      'sun',
      'partly',
      'partly',
      'cloud',
      'cloud',
    ]);
  });

  it('gives no icon for wet hours, night hours without cloud cover or missing data', () => {
    const o = run((i) => {
      if (i === 8) return { ...day, sunshine: 3600, precipitation: 1, precipProbability: 90 };
      if (i === 9) return { isDay: false, sunshine: 0, cloudCover: null };
      if (i === 10) return { ...day, sunshine: null };
      if (i === 11) return { isDay: null, sunshine: 0 };
      return { isDay: null, sunshine: 3600 };
    });
    expect(o.hours.slice(0, 4).map((h) => h.sky)).toEqual([null, null, null, null]);
    expect(o.hours[4].sky).toBe('sun'); // sunshine implies day even without is_day
  });

  it('builds clearRanges and sunHours for a dry sunny window', () => {
    const o = run((i) => ({ ...day, sunshine: i >= 10 && i <= 14 ? 3600 : 0 }));
    expect(o.clearRanges).toEqual([{ from: 10, to: 15 }]);
    expect(o.sunHours).toBe(5);
    expect(o.clearStartsNow).toBe(false);
    expect(o.clearIntermittent).toBe(false);
  });

  it('merges spells split by one hour and flags more than two spells', () => {
    const merged = run((i) => ({ ...day, sunshine: i === 9 || i === 11 ? 3600 : 0 }));
    expect(merged.clearRanges).toEqual([{ from: 9, to: 12 }]);
    const many = run((i) => ({ ...day, sunshine: [8, 11, 14].includes(i) ? 3600 : 0 }));
    expect(many.clearIntermittent).toBe(true);
    expect(many.clearRanges).toEqual([{ from: 8, to: 15 }]);
    expect(many.clearStartsNow).toBe(true);
  });

  it('handles mixed windows: wet hours are not sunny spells, nulls add no hours', () => {
    const o = run((i) =>
      i === 10
        ? { ...day, sunshine: 3600, precipitation: 2, precipProbability: 90 }
        : { ...day, sunshine: i === 12 ? 1800 : null },
    );
    expect(o.clearRanges).toEqual([{ from: 12, to: 13 }]);
    expect(o.sunHours).toBe(1.5); // raw sunshine seconds are summed
  });

  it('is empty without sun or data', () => {
    const o = run(() => day);
    expect(o.clearRanges).toEqual([]);
    expect(o.sunHours).toBe(0);
    expect(o.hours.every((h) => h.sky === null)).toBe(true);
  });
});

describe('buildRainOutlook night sky', () => {
  it('maps cloud cover at night to moon / moon_partly / cloud / none', () => {
    const cover = [
      0,
      NIGHT_CLEAR_MAX,
      NIGHT_CLEAR_MAX + 1,
      NIGHT_PARTLY_MAX,
      NIGHT_PARTLY_MAX + 1,
      null,
    ];
    const o = buildRainOutlook({
      hours: hours((i) => ({
        isDay: false,
        sunshine: 0,
        cloudCover: i >= 8 && i < 14 ? cover[i - 8] : null,
      })),
      now: NOW,
      timezone: 'UTC',
    })!;
    expect(o.hours.slice(0, 6).map((h) => h.sky)).toEqual([
      'moon',
      'moon',
      'moon_partly',
      'moon_partly',
      'cloud',
      null,
    ]);
    expect(o.clearRanges).toEqual([{ from: 8, to: 12 }]);
  });

  it('keeps wet night hours iconless and day hours sunshine-based', () => {
    const o = buildRainOutlook({
      hours: hours((i) =>
        i === 8
          ? { isDay: false, cloudCover: 0, precipitation: 1, precipProbability: 90 }
          : { isDay: true, cloudCover: 0, sunshine: 0 },
      ),
      now: NOW,
      timezone: 'UTC',
    })!;
    expect(o.hours[0].sky).toBeNull();
    expect(o.hours[1].sky).toBe('cloud'); // cloud cover is ignored by day
  });
});

describe('buildRainOutlook clear spells (day and night)', () => {
  const run = (f: (i: number) => Partial<SummaryHour>) =>
    buildRainOutlook({ hours: hours(f), now: NOW, timezone: 'UTC' })!;

  it('night-only clear window has clear ranges but no sun hours', () => {
    const o = run(() => ({ isDay: false, sunshine: 0, cloudCover: 10 }));
    expect(o.clearRanges).toEqual([{ from: 8, to: 20 }]);
    expect(o.sunHours).toBe(0);
  });

  it('mixed day/night window lists sun and moon spells, skipping partly hours', () => {
    const o = run((i) =>
      i < 11
        ? { isDay: true, sunshine: 3600, cloudCover: 0 }
        : { isDay: false, sunshine: 0, cloudCover: i < 14 ? 50 : 10 },
    );
    expect(o.clearLevel).toBe('clear');
    expect(o.clearRanges).toEqual([
      { from: 8, to: 11 },
      { from: 14, to: 20 },
    ]); // moon_partly hours are not clear spells at level 'clear'
    expect(o.sunHours).toBe(3);
  });

  it('fully cloudy windows have no clear spells', () => {
    const day = run(() => ({ isDay: true, sunshine: 0, cloudCover: 100 }));
    const night = run(() => ({ isDay: false, sunshine: 0, cloudCover: 100 }));
    expect(day.clearRanges).toEqual([]);
    expect(night.clearRanges).toEqual([]);
  });

  it('no data gives no clear spells', () => {
    expect(run(() => ({})).clearRanges).toEqual([]);
  });
});

describe('buildRainOutlook clear level and header', () => {
  const run = (f: (i: number) => Partial<SummaryHour>) =>
    buildRainOutlook({ hours: hours(f), now: NOW, timezone: 'UTC' })!;
  const cloud = { isDay: true, sunshine: 0, cloudCover: 100 };
  const sun = { isDay: true, sunshine: 3600, cloudCover: 0 };
  const partly = { isDay: true, sunshine: SUN_SOME_S, cloudCover: 50 };
  const moon = { isDay: false, sunshine: 0, cloudCover: 0 };
  const moonPartly = { isDay: false, sunshine: 0, cloudCover: 50 };
  // window index 0 = hour 8
  const seq = (list: Partial<SummaryHour>[]) => (i: number) =>
    list[i - 8] ?? { cloudCover: null };

  it("is 'clear' at exactly half of the known hours, 'mixed' below", () => {
    const half = run(seq([sun, sun, cloud, cloud]));
    expect(half.clearLevel).toBe('clear');
    const below = run(seq([sun, cloud, cloud, cloud]));
    expect(below.clearLevel).toBe('mixed');
    // unknown hours (missing data) are not counted
    const unknown = run(
      seq([sun, cloud, { isDay: true, sunshine: null }, { isDay: true, sunshine: null }]),
    );
    expect(unknown.clearLevel).toBe('clear');
  });

  it("picks clear hours only for 'clear' and clear + partly for 'mixed'", () => {
    const clearLvl = run(seq([sun, partly, sun, sun, cloud]));
    expect(clearLvl.clearLevel).toBe('clear');
    expect(clearLvl.clearRanges).toEqual([{ from: 8, to: 12 }]); // partly bridged by 1-hour merge
    const only = run(seq([sun, cloud, cloud, cloud, partly, cloud, cloud, cloud]));
    expect(only.clearLevel).toBe('mixed');
    expect(only.clearRanges).toEqual([
      { from: 8, to: 9 },
      { from: 12, to: 13 },
    ]);
    const noPartly = run(seq([sun, cloud, cloud, cloud, cloud, cloud, partly, sun]));
    expect(noPartly.clearRanges.length).toBe(2);
  });

  it('headerSky follows the first clear hour, else the first partly hour', () => {
    expect(run(seq([cloud, moon, sun])).headerSky).toBe('moon');
    expect(run(seq([cloud, sun, moon])).headerSky).toBe('sun');
    expect(run(seq([cloud, partly, cloud, cloud, cloud])).headerSky).toBe('partly');
    expect(run(seq([cloud, moonPartly, cloud, cloud, cloud])).headerSky).toBe('moon_partly');
    expect(run(() => cloud).headerSky).toBeNull();
  });

  it("Taipéi-like window (mostly cloud, partly sun, partly moons, one moon) is 'mixed'", () => {
    const o = run(
      seq([
        cloud,
        partly,
        cloud,
        cloud,
        cloud,
        cloud,
        cloud,
        cloud,
        moonPartly,
        moonPartly,
        moonPartly,
        moon,
      ]),
    );
    expect(o.clearLevel).toBe('mixed');
    expect(o.headerSky).toBe('moon');
    expect(o.clearRanges.length).toBeGreaterThan(0);
  });

  it("Auckland-like window (moons then suns) is 'clear' with a moon header", () => {
    const o = run(seq([moon, moon, moon, moon, sun, sun, sun, sun, sun, sun, sun, sun]));
    expect(o.clearLevel).toBe('clear');
    expect(o.headerSky).toBe('moon');
    expect(o.clearRanges).toEqual([{ from: 8, to: 20 }]);
  });
});
