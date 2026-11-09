import { describe, it, expect } from 'vite-plus/test';
import { buildDaySummary, getTomorrowMigraine, getHighlights } from '../daySummary';
import type {
  DaySummary,
  HealthSignals,
  UmbrellaVerdict,
  DayPart,
  FeltRange,
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
 *   - tomorrow = '2024-06-16', waking = hours 07–22
 */
const TODAY = '2024-06-15';
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
  todayMigraine: null,
  tomorrowMigraine: null,
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

  it("returns 'maybe' when precipitation probability is enough but mm is too low", () => {
    // precipProbability=35 >= possibleProb(30) but precipitation=0 → not hasPrecip
    // So isPossible via probability alone → 'maybe'
    const hours = makeHours(TODAY, 8, 10, {
      precipitation: 0,
      precipProbability: 35,
      weatherCode: 1,
    });
    const result = buildDaySummary({
      hours,
      daily: [],
      timezone: 'UTC',
      now: NOW,
      wakingWindow: WAKING,
    });
    expect(result.today?.umbrella?.level).toBe('maybe');
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
    const tomorrowHours = makeHours('2024-06-16', 7, 22, { apparentTemperature: 25 });
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
    const tomorrowHours = makeHours('2024-06-16', 7, 22, { apparentTemperature: 25 });
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
// getTomorrowMigraine
// ---------------------------------------------------------------------------

describe('getTomorrowMigraine', () => {
  it('returns null when both daily entries are null', () => {
    expect(getTomorrowMigraine(null, null, 'es')).toBeNull();
  });

  it('returns null when only today is null', () => {
    expect(getTomorrowMigraine(null, makeDaily('2024-06-16'), 'es')).toBeNull();
  });

  it('returns null when tomorrowDaily.meanPressure is NaN', () => {
    const today = makeDaily(TODAY, { meanPressure: 1013 });
    const tomorrow = makeDaily('2024-06-16', { meanPressure: NaN });
    expect(getTomorrowMigraine(today, tomorrow, 'es')).toBeNull();
  });

  it('computes score >= 3 for a severe pressure drop of -5 hPa', () => {
    // deltaP = 1008 - 1013 = -5 → +3 (severe drop); pressure 1008 < 1010 → +1 → score=4
    const today = makeDaily(TODAY, { meanPressure: 1013, humidity: 50 });
    const tomorrow = makeDaily('2024-06-16', {
      meanPressure: 1008,
      humidity: 50,
      precipitation: 0,
    });
    const result = getTomorrowMigraine(today, tomorrow, 'es');
    expect(result).not.toBeNull();
    expect(result!.score).toBeGreaterThanOrEqual(3);
  });

  it('accumulates points from humidity and precipitation', () => {
    // deltaP=-3 → +1; pressure=1008<1010 → +1; humidity=80>70 → +1; precip=2>0 → +1 → score=4
    const today = makeDaily(TODAY, { meanPressure: 1013, humidity: 50 });
    const tomorrow = makeDaily('2024-06-16', {
      meanPressure: 1010,
      humidity: 80,
      precipitation: 2,
    });
    const result = getTomorrowMigraine(today, tomorrow, 'es');
    expect(result).not.toBeNull();
    // deltaP=1010-1013=-3 → +1; pressure=1010 (not < 1010) → +0; humidity=80 → +1; precip=2 → +1 → score=3
    expect(result!.score).toBeGreaterThanOrEqual(3);
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

  it('highlights migraine score 6 with weight 85', () => {
    const summary = makeEmptySummary({
      today: makeDayPart(),
    });
    const health: HealthSignals = { ...ZERO_HEALTH, todayMigraine: 6 };
    const highlights = getHighlights(summary, health);
    expect(highlights[0]).toMatchObject({ topic: 'migraine', day: 'today', score: 6 });
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
    // Thunder umbrella (w=100) + migraine score 6 (w=85, different topic) → 2 highlights
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
    const health: HealthSignals = { ...ZERO_HEALTH, todayMigraine: 6 };
    const highlights = getHighlights(summary, health);
    expect(highlights).toHaveLength(2);
    const topics = highlights.map((h) => h.topic);
    expect(topics).toContain('umbrella');
    expect(topics).toContain('migraine');
  });

  it('returns only 1 highlight when second candidate weight < 30', () => {
    // 'maybe' umbrella today → w=35; migraine score 2 → w=18 (< SECONDARY_MIN_WEIGHT=30)
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
    const health: HealthSignals = { ...ZERO_HEALTH, todayMigraine: 2 };
    const highlights = getHighlights(summary, health);
    expect(highlights).toHaveLength(1);
    expect(highlights[0]).toMatchObject({ topic: 'umbrella', day: 'today' });
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
      tomorrow: makeDayPart({ date: '2024-06-16', umbrella: takeUmbrella }),
    });
    const highlights = getHighlights(summary, ZERO_HEALTH);
    // Both are 'umbrella' topic → second is filtered out → only 1 returned
    expect(highlights).toHaveLength(1);
    expect(highlights[0]).toMatchObject({ topic: 'umbrella', day: 'today' });
  });
});
