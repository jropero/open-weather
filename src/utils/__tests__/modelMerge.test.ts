import { describe, it, expect } from 'vite-plus/test';
import { mergeModelDaily } from '../modelMerge';

describe('mergeModelDaily', () => {
  const daily = {
    time: ['a', 'b', 'c'],
    pressure_msl_mean_meteoswiss_icon_ch2: [1010, 1012, null],
    pressure_msl_mean_best_match: [1011, 1013, 1019],
    sunrise_meteoswiss_icon_ch2: ['s1', 's2', 's3'],
    sunrise_best_match: ['x1', 'x2', 'x3'],
  };

  it('fills nulls from the fallback model and keeps primary values', () => {
    const m = mergeModelDaily(daily);
    expect(m.pressure_msl_mean).toEqual([1010, 1012, 1019]);
    expect(m.sunrise).toEqual(['s1', 's2', 's3']);
  });

  it('never coerces null to 0', () => {
    const m = mergeModelDaily({
      x_meteoswiss_icon_ch2: [0, null],
      x_best_match: [5, null],
    });
    expect(m.x).toEqual([0, null]);
  });

  it('passes unsuffixed keys through and drops suffixed ones', () => {
    const m = mergeModelDaily(daily);
    expect(m.time).toEqual(['a', 'b', 'c']);
    expect('pressure_msl_mean_best_match' in m).toBe(false);
  });

  it('returns a non-suffixed response unchanged', () => {
    const plain = { time: ['a'], pressure_msl_mean: [1000] };
    expect(mergeModelDaily(plain)).toBe(plain);
  });
});
