import { describe, it, expect } from 'vitest';
import {
  getLocalToday,
  getExpectedRun,
  getClimateZone,
  getSeasonName,
  hasMeaningfulRow,
} from '../seasonal';
import type { SeasonalPeriod, SeasonalValue } from '../../types/weather';
import type { SeasonalVariable, ConfidenceLevel } from '../../types/weather';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const NULL_VAL: SeasonalValue = { mean: null, anomaly: null, probAbove: null };

/** Build a full Record<SeasonalVariable, SeasonalValue> with all nulls, then override specific vars. */
function makeValues(
  overrides: Partial<Record<SeasonalVariable, SeasonalValue>> = {},
): Record<SeasonalVariable, SeasonalValue> {
  return {
    temperature: NULL_VAL,
    precipitation: NULL_VAL,
    pressure: NULL_VAL,
    sunshine: NULL_VAL,
    snowfall: NULL_VAL,
    ...overrides,
  };
}

/** Build a minimal SeasonalPeriod covering all required fields. */
function makePeriod(
  days: number,
  values: Record<SeasonalVariable, SeasonalValue>,
  confidence: ConfidenceLevel = 'medium',
): SeasonalPeriod {
  return {
    start: '2024-06-01',
    end: '2024-06-30',
    days,
    inProgress: false,
    values,
    confidence,
    agreement: null,
  };
}

// ---------------------------------------------------------------------------
// getLocalToday
// ---------------------------------------------------------------------------

describe('getLocalToday', () => {
  it('returns the UTC date when timezone is UTC', () => {
    const ms = Date.parse('2024-06-15T10:00:00Z');
    expect(getLocalToday('UTC', ms)).toBe('2024-06-15');
  });

  it('advances one day for Auckland (UTC+12 in June) when UTC time passes midnight NZST', () => {
    // 2024-06-14T13:00:00Z → Auckland NZST = 2024-06-15T01:00:00+12:00 → '2024-06-15'
    const ms = Date.parse('2024-06-14T13:00:00Z');
    expect(getLocalToday('Pacific/Auckland', ms)).toBe('2024-06-15');
  });

  it('stays on the previous calendar day for Auckland when UTC time is early morning', () => {
    // 2024-06-14T06:00:00Z → Auckland NZST = 2024-06-14T18:00:00+12:00 → '2024-06-14'
    const ms = Date.parse('2024-06-14T06:00:00Z');
    expect(getLocalToday('Pacific/Auckland', ms)).toBe('2024-06-14');
  });

  it('advances one day for Europe/Berlin (UTC+2 in summer) at 22:30 UTC', () => {
    // 2024-06-15T22:30:00Z → Berlin CEST = 2024-06-16T00:30:00+02:00 → '2024-06-16'
    const ms = Date.parse('2024-06-15T22:30:00Z');
    expect(getLocalToday('Europe/Berlin', ms)).toBe('2024-06-16');
  });

  it('stays on the same day for Europe/Berlin at 21:30 UTC', () => {
    // 2024-06-15T21:30:00Z → Berlin CEST = 2024-06-15T23:30:00+02:00 → '2024-06-15'
    const ms = Date.parse('2024-06-15T21:30:00Z');
    expect(getLocalToday('Europe/Berlin', ms)).toBe('2024-06-15');
  });

  it('does not throw on an invalid timezone string', () => {
    expect(() => getLocalToday('Invalid/Zone', Date.now())).not.toThrow();
  });

  it('returns a YYYY-MM-DD shaped string on invalid timezone (falls back to device tz)', () => {
    const result = getLocalToday('Invalid/Zone', Date.parse('2024-06-15T10:00:00Z'));
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

// ---------------------------------------------------------------------------
// getExpectedRun
// ---------------------------------------------------------------------------

describe('getExpectedRun', () => {
  // Formula: new Date(now - 22 * 3600 * 1000).toISOString().slice(0, 10)

  it('returns the previous day when now is at 21:59 UTC (run not out yet)', () => {
    // 2024-06-15T21:59:00Z − 22 h = 2024-06-14T23:59:00Z → '2024-06-14'
    const ms = Date.parse('2024-06-15T21:59:00Z');
    expect(getExpectedRun(ms)).toBe('2024-06-14');
  });

  it('returns the same day when now is exactly 22:00 UTC (run just out)', () => {
    // 2024-06-15T22:00:00Z − 22 h = 2024-06-15T00:00:00Z → '2024-06-15'
    const ms = Date.parse('2024-06-15T22:00:00Z');
    expect(getExpectedRun(ms)).toBe('2024-06-15');
  });

  it('returns the same day when now is at 22:01 UTC', () => {
    // 2024-06-15T22:01:00Z − 22 h = 2024-06-15T00:01:00Z → '2024-06-15'
    const ms = Date.parse('2024-06-15T22:01:00Z');
    expect(getExpectedRun(ms)).toBe('2024-06-15');
  });

  it('returns the previous day one second before the 22:00 boundary', () => {
    // 2024-06-15T21:59:59Z − 22 h = 2024-06-14T23:59:59Z → '2024-06-14'
    const ms = Date.parse('2024-06-15T21:59:59Z');
    expect(getExpectedRun(ms)).toBe('2024-06-14');
  });

  it('always returns a YYYY-MM-DD shaped string', () => {
    expect(getExpectedRun(Date.parse('2024-01-01T00:00:00Z'))).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

// ---------------------------------------------------------------------------
// getClimateZone
// ---------------------------------------------------------------------------

describe('getClimateZone', () => {
  it('returns tropical at 0°', () => {
    expect(getClimateZone(0)).toBe('tropical');
  });

  it('returns tropical at 23.43° (just inside the tropical boundary)', () => {
    expect(getClimateZone(23.43)).toBe('tropical');
  });

  it('returns tropical at -23.43° (just inside the tropical boundary, southern)', () => {
    expect(getClimateZone(-23.43)).toBe('tropical');
  });

  it('returns north at exactly 23.44° (boundary is strictly < 23.44)', () => {
    expect(getClimateZone(23.44)).toBe('north');
  });

  it('returns south at exactly -23.44° (boundary is strictly < 23.44 on abs)', () => {
    expect(getClimateZone(-23.44)).toBe('south');
  });

  it('returns north at 47° (mid-latitude north)', () => {
    expect(getClimateZone(47)).toBe('north');
  });

  it('returns south at -30° (mid-latitude south)', () => {
    expect(getClimateZone(-30)).toBe('south');
  });

  it('returns north at 90° (north pole)', () => {
    expect(getClimateZone(90)).toBe('north');
  });

  it('returns south at -90° (south pole)', () => {
    expect(getClimateZone(-90)).toBe('south');
  });
});

// ---------------------------------------------------------------------------
// getSeasonName
// ---------------------------------------------------------------------------

describe('getSeasonName', () => {
  describe('northern hemisphere', () => {
    it('DJF → winter', () => expect(getSeasonName('DJF', 'north')).toBe('winter'));
    it('MAM → spring', () => expect(getSeasonName('MAM', 'north')).toBe('spring'));
    it('JJA → summer', () => expect(getSeasonName('JJA', 'north')).toBe('summer'));
    it('SON → autumn', () => expect(getSeasonName('SON', 'north')).toBe('autumn'));
  });

  describe('southern hemisphere (opposite seasons)', () => {
    it('DJF → summer', () => expect(getSeasonName('DJF', 'south')).toBe('summer'));
    it('MAM → autumn', () => expect(getSeasonName('MAM', 'south')).toBe('autumn'));
    it('JJA → winter', () => expect(getSeasonName('JJA', 'south')).toBe('winter'));
    it('SON → spring', () => expect(getSeasonName('SON', 'south')).toBe('spring'));
  });

  describe('tropical zone', () => {
    it('DJF + tropical → null', () => expect(getSeasonName('DJF', 'tropical')).toBeNull());
    it('MAM + tropical → null', () => expect(getSeasonName('MAM', 'tropical')).toBeNull());
    it('JJA + tropical → null', () => expect(getSeasonName('JJA', 'tropical')).toBeNull());
    it('SON + tropical → null', () => expect(getSeasonName('SON', 'tropical')).toBeNull());
  });
});

// ---------------------------------------------------------------------------
// hasMeaningfulRow
// ---------------------------------------------------------------------------

describe('hasMeaningfulRow', () => {
  it('returns false for an empty periods array', () => {
    expect(hasMeaningfulRow('temperature', [])).toBe(false);
  });

  it('returns false when all variable anomalies are null (no data)', () => {
    const period = makePeriod(30, makeValues()); // all null
    expect(hasMeaningfulRow('temperature', [period])).toBe(false);
  });

  it('returns true for a non-snowfall variable when at least one period has a non-null anomaly', () => {
    const tempVal: SeasonalValue = { mean: 15, anomaly: 1.5, probAbove: null };
    const period = makePeriod(30, makeValues({ temperature: tempVal }));
    expect(hasMeaningfulRow('temperature', [period])).toBe(true);
  });

  it('returns true for precipitation with any non-null anomaly', () => {
    const precipVal: SeasonalValue = { mean: 80, anomaly: -10, probAbove: null };
    const period = makePeriod(30, makeValues({ precipitation: precipVal }));
    expect(hasMeaningfulRow('precipitation', [period])).toBe(true);
  });

  it('returns false for snowfall when normal + forecast are both below 0.05 cm/day', () => {
    // mean (period total) = 0.9 cm, anomaly = 0, days = 30
    // Math.max(0.9, 0.9) / 30 = 0.03 < 0.05 → false
    const snowVal: SeasonalValue = { mean: 0.9, anomaly: 0, probAbove: null };
    const period = makePeriod(30, makeValues({ snowfall: snowVal }));
    expect(hasMeaningfulRow('snowfall', [period])).toBe(false);
  });

  it('returns true for snowfall when mean/days >= 0.05 cm/day', () => {
    // mean = 3 cm total, anomaly = 0, days = 30 → Math.max(3, 3) / 30 = 0.1 ≥ 0.05 → true
    const snowVal: SeasonalValue = { mean: 3, anomaly: 0, probAbove: null };
    const period = makePeriod(30, makeValues({ snowfall: snowVal }));
    expect(hasMeaningfulRow('snowfall', [period])).toBe(true);
  });

  it('returns true for snowfall when forecast (mean - anomaly) pushes above threshold even if mean is below', () => {
    // mean = 1 cm (1/30 ≈ 0.033/day), anomaly = -1 → clim = mean - anomaly = 2 cm
    // Math.max(1, 2) / 30 = 2/30 ≈ 0.067 ≥ 0.05 → true
    const snowVal: SeasonalValue = { mean: 1, anomaly: -1, probAbove: null };
    const period = makePeriod(30, makeValues({ snowfall: snowVal }));
    expect(hasMeaningfulRow('snowfall', [period])).toBe(true);
  });

  it('returns false for snowfall when anomaly is null (period has no data)', () => {
    const snowVal: SeasonalValue = { mean: 5, anomaly: null, probAbove: null };
    const period = makePeriod(30, makeValues({ snowfall: snowVal }));
    expect(hasMeaningfulRow('snowfall', [period])).toBe(false);
  });

  it('returns false for snowfall when mean is null (cannot compute per-day rate)', () => {
    const snowVal: SeasonalValue = { mean: null, anomaly: 2, probAbove: null };
    const period = makePeriod(30, makeValues({ snowfall: snowVal }));
    expect(hasMeaningfulRow('snowfall', [period])).toBe(false);
  });

  it('returns true if at least one of multiple periods clears the snowfall threshold', () => {
    // First period: below threshold; second: above threshold
    const lowSnow: SeasonalValue = { mean: 0.3, anomaly: 0, probAbove: null };
    const highSnow: SeasonalValue = { mean: 6, anomaly: 0, probAbove: null };
    const p1 = makePeriod(30, makeValues({ snowfall: lowSnow }));
    const p2 = makePeriod(30, makeValues({ snowfall: highSnow }));
    expect(hasMeaningfulRow('snowfall', [p1, p2])).toBe(true);
  });

  it('returns false when only the non-queried variable has data', () => {
    // pressure has anomaly, but we query snowfall — snowfall is null → false
    const pressureVal: SeasonalValue = { mean: 1012, anomaly: 2, probAbove: null };
    const period = makePeriod(30, makeValues({ pressure: pressureVal }));
    expect(hasMeaningfulRow('snowfall', [period])).toBe(false);
  });
});
