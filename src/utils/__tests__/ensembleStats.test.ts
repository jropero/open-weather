import { describe, it, expect } from 'vitest';
import { computeStats, classifySpread } from '../ensembleStats';
import type { EnsemblePoint } from '../ensembleStats';

function makePoint(members: number[]): EnsemblePoint {
  const stats = computeStats(members);
  return { time: 0, members, ...stats };
}

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

    it('respects per-variable threshold: uniform spread < precipitation threshold → agree', () => {
      // Same members but variable = precipitation (threshold = 3 mm)
      // However spread=9.6 > 3, so this would still be disagree/bimodal.
      // Instead test a spread between 3 and 4 to confirm variable routing.
      // members [0, 1, 2, 3, 3.5, 4] (n=6)
      // sorted: [0,1,2,3,3.5,4]
      // p10: idx=0.5 → 0 + 0.5*1 = 0.5
      // p90: idx=4.5 → 3.5 + 0.5*0.5 = 3.75
      // spread = 3.25 > precipitation threshold (3) → disagree for precipitation
      // isBimodal: lo=1, hi=5, loop i=1,2,3 → gaps 1,1,0.5; totalRange=4; maxGap=1; 1 > 1.2? No
      const point = makePoint([0, 1, 2, 3, 3.5, 4]);
      expect(classifySpread([point], 'precipitation')).toEqual({ label: 'disagree' });
      // but < temperature_2m threshold (4) → agree
      expect(classifySpread([point], 'temperature_2m')).toEqual({ label: 'agree' });
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
