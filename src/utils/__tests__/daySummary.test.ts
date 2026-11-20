import { describe, it, expect } from 'vite-plus/test';
import {
  buildDaySummary,
  buildNightChips,
  buildOverview,
  overviewSky,
  compareFelt,
  feltAdjective,
  getHighlights,
  isCalmDay,
} from '../daySummary';
import type {
  DaySummary,
  HealthSignals,
  UmbrellaVerdict,
  DayPart,
  FeltRange,
  NightNote,
} from '../daySummary';
import type { SummaryHour, DailyWeather, WakingWindow } from '../../types/weather';

// ---------------------------------------------------------------------------
// Test constants
// ---------------------------------------------------------------------------

/** now = 2024-06-15 08:00 UTC.
 *
 * With timezone='UTC' and wakingWindow { start: 7, end: 23 }:
 *   - today  = TODAY
 *   - remaining waking today = hours 08–22 (hour 07 ended exactly at now → not remaining)
 *   - tomorrow = TOMORROW, waking = hours 07–22
 */
const TODAY = '2024-06-15';
const TOMORROW = '2024-06-16';
const NOW = Date.parse('2024-06-15T08:00:00Z');
const WAKING: WakingWindow = { start: 7, end: 23 };

// ---------------------------------------------------------------------------
// Builder helpers
// ---------------------------------------------------------------------------

function makeHour(time: string, overrides: Partial<SummaryHour> = {}): SummaryHour {
  return {
    time,
    temperature: null,
    apparentTemperature: null,
    precipitation: null,
    precipProbability: null,
    snowfall: null,
    weatherCode: null,
    windGusts: null,
    sunshine: null,
    isDay: null,
    cloudCover: null,
    ...overrides,
  };
}

function makeHours(
  date: string,
  fromHour: number,
  toHour: number, // inclusive
  overrides: Partial<SummaryHour> = {},
): SummaryHour[] {
  return Array.from({ length: toHour - fromHour + 1 }, (_, i) => {
    const h = fromHour + i;
    return makeHour(`${date}T${String(h).padStart(2, '0')}:00`, overrides);
  });
}

function makeDaily(date: string, overrides: Partial<DailyWeather> = {}): DailyWeather {
  return {
    date,
    weatherCode: 0,
    maxTemp: 20,
    minTemp: 10,
    meanPressure: 1013,
    humidity: 50,
    precipitation: 0,
    precipitationProbability: 0,
    windSpeed: 10,
    sunshineDuration: 3600,
    precipitationHours: 0,
    sunrise: `${date}T05:00`,
    sunset: `${date}T21:00`,
    ...overrides,
  };
}

function makeDayPart(overrides: Partial<DayPart> = {}): DayPart {
  return {
    date: TODAY,
    from: 8,
    to: 23,
    felt: null,
    umbrella: null,
    wind: null,
    ...overrides,
  };
}

function makeEmptySummary(overrides: Partial<DaySummary> = {}): DaySummary {
  return {
    today: null,
    tomorrow: null,
    dayAfterTomorrow: null,
    earlyNight: null,
    night: null,
    nightAfterTomorrow: null,
    todayFelt: null,
    tomorrowFelt: null,
    feltDelta: null,
    feltDeltaDayAfter: null,
    todayDaily: null,
    tomorrowDaily: null,
    dayAfterTomorrowDaily: null,
    ...overrides,
  };
}

const ZERO_HEALTH: HealthSignals = {
  pressureDrop6h: null,
  aqi: null,
  maxPollen: null,
};

// ---------------------------------------------------------------------------
// buildDaySummary — umbrella verdicts
// ---------------------------------------------------------------------------

describe('buildDaySummary — umbrella', () => {
  it("returns 'take' when wet precipitation total >= 0.5 mm", () => {
    // 3 wet hours during today's remaining waking window (08, 09, 10)
    const hours = makeHours(TODAY, 8, 10, {
      precipitation: 0.5,
      precipProbability: 70,
      weatherCode: 61,
    });
    const result = buildDaySummary({
      hours,
      daily: [],
      timezone: 'UTC',
      now: NOW,
      wakingWindow: WAKING,
    });
    expect(result.today?.umbrella?.level).toBe('take');
  });

  it.each([
    [49, 'none'],
    [50, 'maybe'],
  ])("probability %i%% alone (no amount) → '%s'", (prob, level) => {
    const hours = makeHours(TODAY, 8, 10, {
      precipitation: 0,
      precipProbability: prob,
      weatherCode: 1,
    });
    const result = buildDaySummary({
      hours,
      daily: [],
      timezone: 'UTC',
      now: NOW,
      wakingWindow: WAKING,
    });
    expect(result.today?.umbrella?.level).toBe(level);
  });

  it('a modelled 0.1 mm at 49 % is not possible, at 50 % it is', () => {
    const level = (prob: number) =>
      buildDaySummary({
        hours: makeHours(TODAY, 8, 10, { precipitation: 0.1, precipProbability: prob }),
        daily: [],
        timezone: 'UTC',
        now: NOW,
        wakingWindow: WAKING,
      }).today?.umbrella?.level;
    expect(level(49)).toBe('none');
    expect(level(50)).toBe('maybe');
  });

  it('returns null umbrella when all hours have no precipitation data', () => {
    // Both precipitation and precipProbability are null → assessUmbrella returns null
    const hours = makeHours(TODAY, 8, 10, {
      precipitation: null,
      precipProbability: null,
    });
    const result = buildDaySummary({
      hours,
      daily: [],
      timezone: 'UTC',
      now: NOW,
      wakingWindow: WAKING,
    });
    expect(result.today?.umbrella).toBeNull();
  });

  it("thunder in a wet hour forces 'take' even when total mm < 0.5", () => {
    // precipitation=0.3 (< takeMm=0.5), precipProbability=null → isWet=true (prob missing)
    // weatherCode=95 → isThunder → wet.hours.some(isThunder) → 'take'
    const hours = [
      makeHour('2024-06-15T08:00', {
        precipitation: 0.3,
        precipProbability: null,
        weatherCode: 95,
      }),
    ];
    const result = buildDaySummary({
      hours,
      daily: [],
      timezone: 'UTC',
      now: NOW,
      wakingWindow: WAKING,
    });
    expect(result.today?.umbrella?.level).toBe('take');
    expect(result.today?.umbrella?.thunder).toBe(true);
  });

  it('merges a 1-hour dry gap into a single spell range', () => {
    // Pattern: wet 08, wet 09, DRY 10, wet 11
    // spells gap rule: index gap of 2 is still merged → one range from 08 to 12
    const hours: SummaryHour[] = [
      makeHour('2024-06-15T08:00', {
        precipitation: 0.5,
        precipProbability: 70,
        weatherCode: 61,
      }),
      makeHour('2024-06-15T09:00', {
        precipitation: 0.5,
        precipProbability: 70,
        weatherCode: 61,
      }),
      makeHour('2024-06-15T10:00', { precipitation: 0, precipProbability: 0, weatherCode: 1 }),
      makeHour('2024-06-15T11:00', {
        precipitation: 0.5,
        precipProbability: 70,
        weatherCode: 61,
      }),
    ];
    const result = buildDaySummary({
      hours,
      daily: [],
      timezone: 'UTC',
      now: NOW,
      wakingWindow: WAKING,
    });
    expect(result.today?.umbrella?.ranges).toHaveLength(1);
  });

  it("sets kind='snow' when snowfall hours dominate", () => {
    // snowfall=1, weatherCode=73 (heavy snow), precipitation=0.5 → isWet=true (prob null)
    // isSnow: snowfall>0 → true; all wet hours are snow → kind='snow'
    const hours = makeHours(TODAY, 8, 10, {
      precipitation: 0.5,
      precipProbability: null,
      snowfall: 1,
      weatherCode: 73,
    });
    const result = buildDaySummary({
      hours,
      daily: [],
      timezone: 'UTC',
      now: NOW,
      wakingWindow: WAKING,
    });
    expect(result.today?.umbrella?.kind).toBe('snow');
  });
});

// ---------------------------------------------------------------------------
// buildDaySummary — wind verdict
// ---------------------------------------------------------------------------

describe('buildDaySummary — wind', () => {
  it("reports 'strong' when gusts >= 40 km/h but < 62 km/h", () => {
    // GUST_THRESHOLDS: breezy=28, strong=40, gale=62, storm=89
    const hours = makeHours(TODAY, 8, 10, { windGusts: 50 });
    const result = buildDaySummary({
      hours,
      daily: [],
      timezone: 'UTC',
      now: NOW,
      wakingWindow: WAKING,
    });
    expect(result.today?.wind?.level).toBe('strong');
  });

  it('returns null wind when gusts are below breezy threshold', () => {
    const hours = makeHours(TODAY, 8, 10, { windGusts: 15 });
    const result = buildDaySummary({
      hours,
      daily: [],
      timezone: 'UTC',
      now: NOW,
      wakingWindow: WAKING,
    });
    // getGustLevel(15) = null → wind.level = null (WindVerdict is returned, but level is null)
    expect(result.today?.wind?.level).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// buildDaySummary — feltDelta
// ---------------------------------------------------------------------------

describe('buildDaySummary — feltDelta', () => {
  it('computes felt delta as tomorrow max apparent temp minus today max apparent temp', () => {
    // Need full waking windows for both days with all apparentTemperature non-null
    // Today waking window: hours 07–22 of 2024-06-15 (todayFull — includes hour 07 even though not remaining)
    // Tomorrow waking window: hours 07–22 of 2024-06-16
    const todayHours = makeHours(TODAY, 7, 22, { apparentTemperature: 20 });
    const tomorrowHours = makeHours(TOMORROW, 7, 22, { apparentTemperature: 25 });
    const result = buildDaySummary({
      hours: [...todayHours, ...tomorrowHours],
      daily: [],
      timezone: 'UTC',
      now: NOW,
      wakingWindow: WAKING,
    });
    // feltDelta = max(tomorrow) - max(today) = 25 - 20 = 5
    expect(result.feltDelta).toBe(5);
  });

  it('returns null feltDelta when apparentTemperature is missing for some hours', () => {
    // todayFull has one hour with null apparentTemperature → complete() = false → feltDelta = null
    const todayHours = makeHours(TODAY, 7, 22, { apparentTemperature: 20 });
    // Replace hour 07 with null apparentTemperature
    todayHours[0] = makeHour('2024-06-15T07:00', { apparentTemperature: null });
    const tomorrowHours = makeHours(TOMORROW, 7, 22, { apparentTemperature: 25 });
    const result = buildDaySummary({
      hours: [...todayHours, ...tomorrowHours],
      daily: [],
      timezone: 'UTC',
      now: NOW,
      wakingWindow: WAKING,
    });
    expect(result.feltDelta).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getHighlights
// ---------------------------------------------------------------------------

describe('getHighlights', () => {
  it('places thunder umbrella first (highest weight = 100)', () => {
    const thunderUmbrella: UmbrellaVerdict = {
      level: 'take',
      kind: 'rain',
      ranges: [{ from: 8, to: 11 }],
      intermittent: false,
      mm: 0.3,
      cm: 0,
      maxProb: 50,
      thunder: true,
    };
    const summary = makeEmptySummary({
      today: makeDayPart({ umbrella: thunderUmbrella }),
    });
    const highlights = getHighlights(summary, ZERO_HEALTH);
    expect(highlights[0]).toMatchObject({ topic: 'umbrella', day: 'today' });
    // Narrow the type before accessing .umbrella
    const first = highlights[0];
    expect(first.topic === 'umbrella' && first.umbrella.thunder).toBe(true);
  });

  it('highlights a 6 h pressure drop with weight 46', () => {
    const summary = makeEmptySummary({ today: makeDayPart() });
    const health: HealthSignals = { ...ZERO_HEALTH, pressureDrop6h: -4 };
    expect(getHighlights(summary, health)[0]).toMatchObject({
      topic: 'pressure',
      day: 'today',
      delta: -4,
    });
  });

  it('returns a calm highlight when there are no candidates', () => {
    const felt: FeltRange = { min: 18, max: 22 };
    const summary = makeEmptySummary({
      today: makeDayPart({ felt }),
    });
    const highlights = getHighlights(summary, ZERO_HEALTH);
    expect(highlights).toHaveLength(1);
    expect(highlights[0]).toMatchObject({ topic: 'calm', day: 'today' });
  });

  it('returns empty array when no day parts exist at all', () => {
    const highlights = getHighlights(makeEmptySummary(), ZERO_HEALTH);
    expect(highlights).toHaveLength(0);
  });

  it('returns 2 highlights when second candidate has weight >= 30', () => {
    // Thunder umbrella (w=100) + pressure drop (w=46, different topic) → 2 highlights
    const thunderUmbrella: UmbrellaVerdict = {
      level: 'take',
      kind: 'rain',
      ranges: [],
      intermittent: false,
      mm: 0.3,
      cm: 0,
      maxProb: 50,
      thunder: true,
    };
    const summary = makeEmptySummary({
      today: makeDayPart({ umbrella: thunderUmbrella }),
    });
    const health: HealthSignals = { ...ZERO_HEALTH, pressureDrop6h: -4 };
    const highlights = getHighlights(summary, health);
    expect(highlights).toHaveLength(2);
    const topics = highlights.map((h) => h.topic);
    expect(topics).toContain('umbrella');
    expect(topics).toContain('pressure');
  });

  it('returns only 1 highlight when second candidate weight < 30', () => {
    // 'maybe' umbrella today → w=35; moderate air quality → w=22 (< SECONDARY_MIN_WEIGHT=30)
    const maybeUmbrella: UmbrellaVerdict = {
      level: 'maybe',
      kind: 'rain',
      ranges: [{ from: 8, to: 9 }],
      intermittent: false,
      mm: 0.1,
      cm: 0,
      maxProb: 35,
      thunder: false,
    };
    const summary = makeEmptySummary({
      today: makeDayPart({ umbrella: maybeUmbrella }),
    });
    const health: HealthSignals = { ...ZERO_HEALTH, aqi: 45 };
    const highlights = getHighlights(summary, health);
    expect(highlights).toHaveLength(1);
    expect(highlights[0]).toMatchObject({ topic: 'umbrella', day: 'today' });
  });

  const verdict = (level: 'take' | 'maybe'): UmbrellaVerdict => ({
    level,
    kind: 'rain',
    ranges: [{ from: 8, to: 12 }],
    intermittent: false,
    mm: level === 'take' ? 2 : 0.1,
    cm: 0,
    maxProb: level === 'take' ? 90 : 55,
    thunder: false,
  });

  it("ranks the earlier day first: tomorrow's maybe beats the day after's take", () => {
    const s = makeEmptySummary({
      tomorrow: makeDayPart({ date: TOMORROW, umbrella: verdict('maybe') }),
      dayAfterTomorrow: makeDayPart({ date: '2024-06-17', umbrella: verdict('take') }),
    });
    expect(getHighlights(s, ZERO_HEALTH)[0]).toMatchObject({
      topic: 'umbrella',
      day: 'tomorrow',
    });
  });

  it("puts today's strong wind before tomorrow's umbrella, then orders same-day by weight", () => {
    const wind = { level: 'strong' as const, gusts: 60, ranges: [{ from: 13, to: 15 }] };
    const s = makeEmptySummary({
      today: makeDayPart({ umbrella: verdict('take'), wind }),
      tomorrow: makeDayPart({ date: TOMORROW, umbrella: verdict('maybe') }),
    });
    // Teaser (today's umbrella omitted): wind today, then tomorrow's umbrella
    expect(
      getHighlights(s, ZERO_HEALTH, { omitTodayUmbrella: true }).map((h) => [h.topic, h.day]),
    ).toEqual([
      ['wind', 'today'],
      ['umbrella', 'tomorrow'],
    ]);
    // Dialog: same day → higher weight first (umbrella 80 > wind 60)
    expect(getHighlights(s, ZERO_HEALTH).map((h) => [h.topic, h.day])).toEqual([
      ['umbrella', 'today'],
      ['wind', 'today'],
    ]);
  });

  it('falls back to the highest weight when nothing reaches 30', () => {
    const s = makeEmptySummary({
      today: makeDayPart(),
      tomorrow: makeDayPart({ date: TOMORROW }),
    });
    const health: HealthSignals = { ...ZERO_HEALTH, aqi: 45 };
    // Air quality weighs 22 (< 30): it is the highest, so it wins instead of the calm phrase
    expect(getHighlights(s, health)).toEqual([{ topic: 'air', day: 'today', aqi: 45 }]);
  });

  it('two candidates with the same topic are not both returned', () => {
    // 'take' umbrella today (w=80) + 'take' umbrella tomorrow (w=75)
    // second = rest.find(c => c.h.topic !== first.h.topic && ...) → skips same topic
    const takeUmbrella: UmbrellaVerdict = {
      level: 'take',
      kind: 'rain',
      ranges: [{ from: 8, to: 10 }],
      intermittent: false,
      mm: 0.6,
      cm: 0,
      maxProb: 70,
      thunder: false,
    };
    const summary = makeEmptySummary({
      today: makeDayPart({ umbrella: takeUmbrella }),
      tomorrow: makeDayPart({ date: TOMORROW, umbrella: takeUmbrella }),
    });
    const highlights = getHighlights(summary, ZERO_HEALTH);
    // Both are 'umbrella' topic → second is filtered out → only 1 returned
    expect(highlights).toHaveLength(1);
    expect(highlights[0]).toMatchObject({ topic: 'umbrella', day: 'today' });
  });
});

// ---------------------------------------------------------------------------
// Day-after comparison basis, overview and presentation helpers
// ---------------------------------------------------------------------------

describe('buildDaySummary — feltDeltaDayAfter', () => {
  it('compares the day after tomorrow with TOMORROW, not with today', () => {
    const hours = [
      ...makeHours(TODAY, 7, 22, { apparentTemperature: 30 }),
      ...makeHours(TOMORROW, 7, 22, { apparentTemperature: 20 }),
      ...makeHours('2024-06-17', 7, 22, { apparentTemperature: 15 }),
    ];
    const r = buildDaySummary({
      hours,
      daily: [],
      timezone: 'UTC',
      now: NOW,
      wakingWindow: WAKING,
    });
    expect(r.feltDelta).toBe(-10); // tomorrow vs today
    expect(r.feltDeltaDayAfter).toBe(-5); // day after vs tomorrow
    expect(r.tomorrowFelt).toEqual({ min: 20, max: 20 });
  });
});

describe('compareFelt', () => {
  const base: FeltRange = { min: 5, max: 9 };
  it('returns the base range it was compared with and a signed tone', () => {
    const c = compareFelt(-5, { min: 1, max: 4 }, base);
    expect(c).toMatchObject({ similar: false, tone: 'colder', adjective: 'colder', delta: -5 });
    expect(c?.base).toEqual(base);
  });
  it('is similar below the threshold', () => {
    expect(compareFelt(1, { min: 5, max: 10 }, base)).toMatchObject({
      similar: true,
      tone: 'similar',
    });
  });
  it('is null without delta or base', () => {
    expect(compareFelt(null, base, base)).toBeNull();
    expect(compareFelt(3, base, null)).toBeNull();
  });
  it('picks the adjective from how warm the day feels', () => {
    expect(feltAdjective(-3, 18)).toBe('cooler');
    expect(feltAdjective(3, 26)).toBe('hotter');
    expect(feltAdjective(3, 5)).toBe('milder');
    expect(feltAdjective(3, 15)).toBe('warmer');
  });
});

describe('buildOverview / isCalmDay', () => {
  const dry = {
    level: 'none',
    kind: 'rain',
    ranges: [],
    intermittent: false,
    mm: 0,
    cm: 0,
    maxProb: null,
    thunder: false,
  } satisfies UmbrellaVerdict;

  it('skips missing days and carries weather code and strong wind', () => {
    const summary = makeEmptySummary({
      tomorrow: makeDayPart({
        date: TOMORROW,
        felt: { min: 5, max: 7 },
        umbrella: dry,
        wind: { level: 'strong', gusts: 46, ranges: [] },
      }),
      tomorrowDaily: makeDaily(TOMORROW, { weatherCode: 61 }),
    });
    const items = buildOverview(summary);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      day: 'tomorrow',
      weatherCode: 3, // daily code 61 but a dry verdict → overcast
      strongWind: 'strong',
    });
  });

  it('does not flag a breezy day as strong wind', () => {
    const summary = makeEmptySummary({
      today: makeDayPart({ wind: { level: 'breezy', gusts: 30, ranges: [] } }),
    });
    const [today] = buildOverview(summary);
    expect(today.strongWind).toBeNull();
  });

  it('is calm only when dry and no wind level', () => {
    expect(isCalmDay(makeDayPart({ umbrella: dry, wind: null }))).toBe(true);
    expect(
      isCalmDay(makeDayPart({ umbrella: dry, wind: { level: null, gusts: 5, ranges: [] } })),
    ).toBe(true);
    expect(
      isCalmDay(
        makeDayPart({ umbrella: dry, wind: { level: 'breezy', gusts: 30, ranges: [] } }),
      ),
    ).toBe(false);
    expect(isCalmDay(makeDayPart({ umbrella: null }))).toBe(false);
  });
});

describe('buildNightChips', () => {
  const base: NightNote = {
    from: 23,
    to: 7,
    precip: null,
    wetMorning: false,
    thunder: false,
    wind: null,
    frost: null,
    warmNight: null,
    minTemp: null,
  };
  it('is empty for a quiet night', () => {
    expect(buildNightChips(base)).toEqual([]);
  });
  it('makes one chip per note, in a fixed order', () => {
    const chips = buildNightChips({
      ...base,
      precip: { kind: 'rain', mm: 6.3, cm: 0, ranges: [{ from: 23, to: 7 }] },
      wetMorning: true,
      wind: { level: 'strong', gusts: 46 },
      frost: 'frost',
      minTemp: 1,
    });
    expect(chips.map((c) => c.id)).toEqual(['precip', 'wet', 'wind', 'frost']);
    expect(chips[0].vars).toEqual({ mm: 6.3, cm: 0 });
    expect(chips[2].varKeys.level).toBe('summary.wind.strong');
  });
});

describe('getHighlights — dialog vs teaser', () => {
  it("lets today's umbrella lead unless omitTodayUmbrella is set", () => {
    const umbrella: UmbrellaVerdict = {
      level: 'take',
      kind: 'rain',
      ranges: [{ from: 11, to: 23 }],
      intermittent: false,
      mm: 4,
      cm: 0,
      maxProb: 100,
      thunder: false,
    };
    const s = makeEmptySummary({ today: makeDayPart({ umbrella }) });
    expect(getHighlights(s, ZERO_HEALTH)[0]).toMatchObject({ topic: 'umbrella', day: 'today' });
    expect(
      getHighlights(s, ZERO_HEALTH, { omitTodayUmbrella: true }).some(
        (h) => h.topic === 'umbrella',
      ),
    ).toBe(false);
  });
});

describe('overviewSky', () => {
  it('shows overcast when a dry day has a precipitation code', () => {
    for (const code of [51, 61, 80, 71, 95]) expect(overviewSky(code, 'none')).toBe(3);
  });
  it('keeps the code when it rains, for non-precip codes, and without a verdict', () => {
    expect(overviewSky(61, 'maybe')).toBe(61);
    expect(overviewSky(61, 'take')).toBe(61);
    expect(overviewSky(61, null)).toBe(61);
    expect(overviewSky(45, 'none')).toBe(45);
    expect(overviewSky(0, 'none')).toBe(0);
    expect(overviewSky(null, 'none')).toBeNull();
  });
});
