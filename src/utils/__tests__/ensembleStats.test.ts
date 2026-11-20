import { describe, it, expect } from 'vite-plus/test';
import {
  computeStats,
  classifySpread,
  makePoint as buildPoint,
  toDailyTotals,
  localMidnightIndices,
  ensembleDaysInWeek,
  parseEnsembleResponse,
  toWeekPoints,
  MIN_ENSEMBLE_DAYS_IN_WEEK,
} from '../ensembleStats';
import type { EnsemblePoint } from '../ensembleStats';

function makePoint(members: (number | null)[], time = 0): EnsemblePoint {
  return buildPoint(time, members);
}

// ---------------------------------------------------------------------------
// makePoint
// ---------------------------------------------------------------------------

describe('makePoint', () => {
  it('returns null stats when every member is missing (never a fake 0)', () => {
    expect(makePoint([null, null]).stats).toBeNull();
  });

  it('ignores missing members in the stats but keeps member indices aligned', () => {
    const p = makePoint([1, null, 3]);
    expect(p.stats?.mean).toBe(2);
    expect(p.members).toEqual([1, null, 3]);
  });
});

// ---------------------------------------------------------------------------
// toDailyTotals
// ---------------------------------------------------------------------------

describe('toDailyTotals', () => {
  const H = 3_600_000;
  const t0 = Date.parse('2026-11-16T00:00:00Z');
  /** `hours` hourly points starting at `start`, member values from `f(hourIndex)`. */
  const series = (start: number, hours: number, f: (i: number) => (number | null)[]) =>
    Array.from({ length: hours }, (_, i) => makePoint(f(i), start + i * H));

  it('sums each member per UTC day and holds the total across the day', () => {
    const pts = series(t0, 48, (i) => (i < 24 ? [0.5, 0.25] : [1, 0]));
    const out = toDailyTotals(pts, 'UTC');
    expect(out).toHaveLength(48);
    expect(out[0].members).toEqual([12, 6]);
    expect(out[23].members).toEqual([12, 6]);
    expect(out[24].members).toEqual([24, 0]);
    expect(out[30].stats?.mean).toBe(12);
  });

  it('uses the location timezone for day boundaries and drops partial edge days', () => {
    // 2026-11-16T00Z … 72 h in Pacific/Auckland (UTC+13): local days start at 11:00Z
    const pts = series(t0, 72, () => [1]);
    const out = toDailyTotals(pts, 'Pacific/Auckland');
    // 00–10Z = local 13:00–23:00 of Nov 16 (11 h) → partial → null
    expect(out[0].members).toEqual([null]);
    expect(out[0].stats).toBeNull();
    // 11Z Nov 16 … 10Z Nov 17 = full local day Nov 17 (24 h)
    expect(out[11].members).toEqual([24]);
    expect(out[34].members).toEqual([24]);
    // 11Z Nov 17 … 10Z Nov 18 = Nov 18, full
    expect(out[35].members).toEqual([24]);
    // last hours = Nov 19 local, only 13 h in slice → partial
    expect(out[71].members).toEqual([null]);
  });

  it('a member missing > 2 hours of a day is null; ≤ 2 missing hours are tolerated (not read as 0)', () => {
    const pts = series(t0, 24, (i) => [i < 2 ? null : 1, i < 3 ? null : 1, 1]);
    const out = toDailyTotals(pts, 'UTC');
    expect(out[0].members).toEqual([22, null, 24]);
    expect(out[0].stats?.mean).toBe(23);
  });

  it('empty input → empty output', () => {
    expect(toDailyTotals([], 'UTC')).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// localMidnightIndices
// ---------------------------------------------------------------------------

describe('localMidnightIndices', () => {
  const H = 3_600_000;
  const start = Date.parse('2026-11-16T00:00:00Z');
  const pts = Array.from({ length: 48 }, (_, i) => makePoint([0], start + i * H));

  it('UTC: midnight at hour 0 and 24', () => {
    expect(localMidnightIndices(pts, 'UTC')).toEqual([0, 24]);
  });

  it('Europe/Zurich (UTC+1 in November): local midnight is 23:00 UTC', () => {
    expect(localMidnightIndices(pts, 'Europe/Zurich')).toEqual([23, 47]);
  });

  it('Pacific/Auckland (UTC+13 in November): local midnight is 11:00 UTC', () => {
    expect(localMidnightIndices(pts, 'Pacific/Auckland')).toEqual([11, 35]);
  });

  it('hour parameter: local noon in Europe/Zurich is 11:00 UTC', () => {
    expect(localMidnightIndices(pts, 'Europe/Zurich', 12)).toEqual([11, 35]);
  });
});

// ---------------------------------------------------------------------------
// computeStats
// ---------------------------------------------------------------------------

describe('computeStats', () => {
  it('empty array returns all zeros', () => {
    expect(computeStats([])).toEqual({
      mean: 0,
      p10: 0,
      p25: 0,
      p50: 0,
      p75: 0,
      p90: 0,
    });
  });

  it('single value: all stats equal that value', () => {
    expect(computeStats([42])).toEqual({
      mean: 42,
      p10: 42,
      p25: 42,
      p50: 42,
      p75: 42,
      p90: 42,
    });
  });

  describe('[1, 2, 3, 4, 5]', () => {
    // sortedPercentile formula: idx = (p/100) * (n-1); interpolate between floor/ceil
    // n=5, so (n-1)=4
    // p10: idx=0.4  → sorted[0] + 0.4*(sorted[1]-sorted[0]) = 1 + 0.4 = 1.4
    // p25: idx=1.0  → sorted[1] = 2  (lo===hi)
    // p50: idx=2.0  → sorted[2] = 3  (lo===hi)
    // p75: idx=3.0  → sorted[3] = 4  (lo===hi)
    // p90: idx=3.6  → sorted[3] + 0.6*(sorted[4]-sorted[3]) = 4 + 0.6 = 4.6
    const result = computeStats([1, 2, 3, 4, 5]);

    it('mean is 3', () => {
      expect(result.mean).toBe(3);
    });

    it('p10 = 1.4 (interpolated)', () => {
      expect(result.p10).toBeCloseTo(1.4, 10);
    });

    it('p25 = 2 (exact index hit)', () => {
      expect(result.p25).toBe(2);
    });

    it('p50 = 3 (median)', () => {
      expect(result.p50).toBe(3);
    });

    it('p75 = 4 (exact index hit)', () => {
      expect(result.p75).toBe(4);
    });

    it('p90 = 4.6 (interpolated)', () => {
      expect(result.p90).toBeCloseTo(4.6, 10);
    });
  });

  it('unsorted input [5,1,3,2,4] produces same result as sorted', () => {
    const unsorted = computeStats([5, 1, 3, 2, 4]);
    expect(unsorted.mean).toBe(3);
    expect(unsorted.p50).toBe(3);
    expect(unsorted.p10).toBeCloseTo(1.4, 10);
    expect(unsorted.p90).toBeCloseTo(4.6, 10);
  });
});

// ---------------------------------------------------------------------------
// classifySpread
// ---------------------------------------------------------------------------

describe('classifySpread', () => {
  describe("'agree'", () => {
    it('empty points array → agree', () => {
      expect(classifySpread([], 'temperature_2m')).toEqual({ label: 'agree' });
    });

    it('tightly-clustered members (spread < threshold) → agree', () => {
      // members [10, 11, 12, 13, 14], sorted same
      // p10: idx=0.4 → 10 + 0.4*1 = 10.4; p90: idx=3.6 → 13 + 0.6*1 = 13.6
      // spread = 3.2 < WIDE_THRESHOLD.temperature_2m (4) → not 'disagree'
      // isBimodal: lo=1, hi=4, gaps i=1→1, i=2→1; totalRange=4; maxGap=1 > 4*0.3=1.2? No → not bimodal
      const point = makePoint([10, 11, 12, 13, 14]);
      expect(classifySpread([point], 'temperature_2m')).toEqual({ label: 'agree' });
    });
  });

  describe("'disagree'", () => {
    it('wide spread, no bimodal gap → disagree for temperature_2m', () => {
      // members [0, 2, 4, 6, 8, 10, 12] (n=7, uniform spacing)
      // p10: idx = 0.1*6 = 0.6 → 0 + 0.6*2 = 1.2
      // p90: idx = 0.9*6 = 5.4 → 10 + 0.4*2 = 10.8
      // spread = 9.6 > 4 (threshold for temperature_2m)
      // isBimodal: lo=2, hi=5, loop i=2,3 → gaps 2,2; totalRange=12; 2 > 3.6? No → not bimodal
      const point = makePoint([0, 2, 4, 6, 8, 10, 12]);
      expect(classifySpread([point], 'temperature_2m')).toEqual({ label: 'disagree' });
    });

    it('respects per-variable threshold: spread between temp (4) and pressure (5) thresholds', () => {
      // members [0, 1, 2, 3, 4, 5.5] (n=6)
      // p10: idx=0.5 → 0.5; p90: idx=4.5 → 4 + 0.5*1.5 = 4.75; spread = 4.25
      // isBimodal: lo=1, hi=5, gaps 1,1,1; totalRange=5.5; 1 > 1.65? No
      const point = makePoint([0, 1, 2, 3, 4, 5.5]);
      expect(classifySpread([point], 'temperature_2m')).toEqual({ label: 'disagree' });
      expect(classifySpread([point], 'pressure_msl')).toEqual({ label: 'agree' });
    });

    it('hourly precipitation (3 mm) vs. daily sunshine (3 h per day) thresholds', () => {
      // members [0, 2, …, 12]: spread 9.6 → disagree for both
      const point = makePoint([0, 2, 4, 6, 8, 10, 12]);
      expect(classifySpread([point], 'precipitation')).toEqual({ label: 'disagree' });
      expect(classifySpread([point], 'sunshine_duration')).toEqual({ label: 'disagree' });
      // members [4 … 6.4] step 0.4: spread 2.4 → agree for sunshine, below 3 h
      const narrow = makePoint([4, 4.4, 4.8, 5.2, 5.6, 6, 6.4]);
      expect(classifySpread([narrow], 'sunshine_duration')).toEqual({ label: 'agree' });
    });

    it('hourly snowfall uses an hourly threshold (2 cm)', () => {
      // members [0, 0.5, 1, 1.5, 2, 2.5, 3]: p10=0.3, p90=2.7 → spread 2.4 > 2
      const point = makePoint([0, 0.5, 1, 1.5, 2, 2.5, 3]);
      expect(classifySpread([point], 'snowfall')).toEqual({ label: 'disagree' });
    });

    it('skips points without stats', () => {
      const empty = makePoint([null, null]);
      expect(classifySpread([empty], 'temperature_2m')).toEqual({ label: 'agree' });
    });

    it('picks the point with the max spread when multiple points are given', () => {
      // narrow point: spread < 4; wide point: spread > 4 and not bimodal
      const narrow = makePoint([10, 10.5, 11]);
      const wide = makePoint([0, 2, 4, 6, 8, 10, 12]);
      expect(classifySpread([narrow, wide], 'temperature_2m')).toEqual({ label: 'disagree' });
    });
  });

  describe("'bimodal'", () => {
    it('two tight clusters with large central gap → bimodal', () => {
      // members: [1, 2, 3, 4, 5, 15, 16, 17, 18, 19] (n=10)
      // sorted:   [1, 2, 3, 4, 5, 15, 16, 17, 18, 19]
      // lo = floor(10*0.3) = 3; hi = ceil(10*0.7) = 7
      // loop i=3,4,5 (< hi-1=6):
      //   i=3: sorted[4]-sorted[3] = 5-4 = 1
      //   i=4: sorted[5]-sorted[4] = 15-5 = 10  ← big gap
      //   i=5: sorted[6]-sorted[5] = 16-15 = 1
      // maxGap=10; totalRange=18; 10 > 18*0.3=5.4 → bimodal
      const point = makePoint([1, 2, 3, 4, 5, 15, 16, 17, 18, 19]);
      expect(classifySpread([point], 'temperature_2m')).toEqual({ label: 'bimodal' });
    });

    it('bimodal takes priority over disagree even when spread exceeds threshold', () => {
      // The spread for [1..5, 15..19] is also wide:
      // p10: idx=0.9 → 1 + 0.9*(2-1) = 1.9
      // p90: idx=8.1 → 18 + 0.1*(19-18) = 18.1
      // spread=16.2 > 4; still returns bimodal, not disagree
      const point = makePoint([1, 2, 3, 4, 5, 15, 16, 17, 18, 19]);
      const result = classifySpread([point], 'temperature_2m');
      expect(result.label).toBe('bimodal');
      expect(result.label).not.toBe('disagree');
    });
  });
});

// ---------------------------------------------------------------------------
// ensembleDaysInWeek — which weekly cells can open the hourly ensemble chart
// ---------------------------------------------------------------------------

describe('ensembleDaysInWeek', () => {
  // 2026-11-16 is a Monday; the window is today 00:00 UTC … +15 days (2026-12-01 00:00)
  const monday = Date.parse('2026-11-16T10:00:00Z');

  it('on a Monday: weeks 1–2 fully covered, week 3 only 1 day, week 4 none', () => {
    expect(ensembleDaysInWeek('2026-11-16', monday)).toBe(7);
    expect(ensembleDaysInWeek('2026-11-23', monday)).toBe(7);
    expect(ensembleDaysInWeek('2026-11-30', monday)).toBe(1);
    expect(ensembleDaysInWeek('2026-12-07', monday)).toBe(0);
  });

  it('on a Monday, week 3 is below the drill-down minimum', () => {
    expect(ensembleDaysInWeek('2026-11-30', monday)).toBeLessThan(MIN_ENSEMBLE_DAYS_IN_WEEK);
  });

  it('mid-week: the in-progress week only counts its remaining days', () => {
    const thursday = Date.parse('2026-11-19T08:00:00Z');
    expect(ensembleDaysInWeek('2026-11-16', thursday)).toBe(4);
    expect(ensembleDaysInWeek('2026-11-30', thursday)).toBe(4); // window ends 2026-12-04
  });

  it('on a Sunday the current week has 1 day left', () => {
    const sunday = Date.parse('2026-11-22T23:00:00Z');
    expect(ensembleDaysInWeek('2026-11-16', sunday)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// parseEnsembleResponse
// ---------------------------------------------------------------------------

describe('parseEnsembleResponse', () => {
  const json = {
    hourly: {
      time: ['2026-11-16T00:00', '2026-11-16T01:00'],
      temperature_2m: [1.234, null], // control run
      temperature_2m_member01: [2, 'x'],
      pressure_msl_member01: [1000, 1001], // other variable — ignored
    },
  };

  it('parses times as UTC and keeps control + members index-aligned', () => {
    const raw = parseEnsembleResponse(json, 'temperature_2m');
    expect(raw.times).toEqual([
      Date.parse('2026-11-16T00:00:00Z'),
      Date.parse('2026-11-16T01:00:00Z'),
    ]);
    expect(raw.members).toEqual([
      [1.23, null],
      [2, null],
    ]);
  });

  it('an empty / malformed response gives no data instead of throwing', () => {
    expect(parseEnsembleResponse({}, 'temperature_2m')).toEqual({ times: [], members: [] });
    expect(parseEnsembleResponse(null, 'precipitation')).toEqual({ times: [], members: [] });
  });
});

// ---------------------------------------------------------------------------
// toWeekPoints
// ---------------------------------------------------------------------------

describe('toWeekPoints', () => {
  const H = 3_600_000;
  const weekStart = '2026-11-16';
  const ws = Date.parse('2026-11-16T00:00:00Z');
  // 3 hours: one before the week, two inside
  const raw = {
    times: [ws - H, ws, ws + H],
    members: [
      [3600, 3600, 1800],
      [0, 7200, null],
    ],
  };

  it('keeps only hours inside the UTC week', () => {
    const pts = toWeekPoints(raw, weekStart, 'precipitation');
    expect(pts.map((p) => p.time)).toEqual([ws, ws + H]);
  });

  it('precipitation stays hourly (not cumulative)', () => {
    const pts = toWeekPoints(raw, weekStart, 'precipitation');
    expect(pts[1].members).toEqual([1800, null]);
  });

  it('sunshine is converted to hours; a partial day yields null (daily totals)', () => {
    const pts = toWeekPoints(raw, weekStart, 'sunshine_duration', 'UTC');
    expect(pts.map((p) => p.members)).toEqual([
      [null, null],
      [null, null],
    ]);
  });

  it('sunshine over a full day gives the daily total in hours', () => {
    const full = {
      times: Array.from({ length: 24 }, (_, i) => ws + i * H),
      members: [Array.from({ length: 24 }, () => 1800)],
    };
    const pts = toWeekPoints(full, weekStart, 'sunshine_duration', 'UTC');
    expect(pts[5].members).toEqual([12]);
  });
});
