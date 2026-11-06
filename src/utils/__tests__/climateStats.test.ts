import { describe, it, expect } from 'vitest';
import {
  aggregateMonthly,
  aggregateSeasonal,
  computeClimatology,
  findAnalogues,
  getAboveCount,
  getHolisticSummary,
} from '../climateStats';
import type { ERA5DailyData, MonthlyClimate, HistoricalPeriod } from '../climateStats';

// ---------------------------------------------------------------------------
// aggregateMonthly
// ---------------------------------------------------------------------------

describe('aggregateMonthly', () => {
  it('averages temperature and pressure, sums precipitation/sunshine/snowfall per month', () => {
    const daily: ERA5DailyData = {
      time: ['2024-01-01', '2024-01-02', '2024-01-03', '2024-02-01'],
      temp: [10, 20, 30, 15],
      precip: [1, 2, 3, 4],
      pressure: [1010, 1020, 1030, 1015],
      sunshine: [3600, 7200, 3600, 1800],
      snowfall: [0, 0, 0, 1],
    };

    const result = aggregateMonthly(daily);

    expect(result).toHaveLength(2);

    // Result is sorted by yearMonth, so January is first
    const jan = result[0];
    expect(jan.yearMonth).toBe('2024-01');
    expect(jan.year).toBe(2024);
    expect(jan.month).toBe(1);
    // temperature: mean([10, 20, 30]) = 60/3 = 20
    expect(jan.temperature).toBeCloseTo(20);
    // precipitation: sum([1, 2, 3]) = 6
    expect(jan.precipitation).toBeCloseTo(6);
    // pressure: mean([1010, 1020, 1030]) = 3060/3 = 1020
    expect(jan.pressure).toBeCloseTo(1020);
    // sunshine: sum([3600, 7200, 3600]) = 14400
    expect(jan.sunshine).toBeCloseTo(14400);
    // snowfall: sum([0, 0, 0]) = 0
    expect(jan.snowfall).toBeCloseTo(0);

    const feb = result[1];
    expect(feb.yearMonth).toBe('2024-02');
    expect(feb.year).toBe(2024);
    expect(feb.month).toBe(2);
    // temperature: mean([15]) = 15
    expect(feb.temperature).toBeCloseTo(15);
    // precipitation: sum([4]) = 4
    expect(feb.precipitation).toBeCloseTo(4);
  });

  it('sorts result chronologically by yearMonth', () => {
    const daily: ERA5DailyData = {
      time: ['2024-02-01', '2024-01-01'],
      temp: [5, 10],
      precip: [1, 1],
      pressure: [1010, 1010],
      sunshine: [100, 100],
      snowfall: [0, 0],
    };

    const result = aggregateMonthly(daily);

    expect(result[0].yearMonth).toBe('2024-01');
    expect(result[1].yearMonth).toBe('2024-02');
  });

  it('excludes null temperature values from the monthly average', () => {
    // 2-day January: one temp is null → average uses only the non-null value
    const daily: ERA5DailyData = {
      time: ['2024-01-01', '2024-01-02'],
      temp: [10, null],
      precip: [1, 1],
      pressure: [1010, 1010],
      sunshine: [100, 100],
      snowfall: [0, 0],
    };

    const result = aggregateMonthly(daily);

    expect(result).toHaveLength(1);
    // Only temp[0]=10 counted; temp[1]=null excluded
    expect(result[0].temperature).toBeCloseTo(10);
  });
});

// ---------------------------------------------------------------------------
// aggregateSeasonal
// ---------------------------------------------------------------------------

describe('aggregateSeasonal', () => {
  // Helper to build a minimal MonthlyClimate record
  function makeMonth(
    year: number,
    month: number,
    temperature: number,
    precipitation: number,
    pressure = 1013,
    sunshine = 0,
    snowfall = 0,
  ): MonthlyClimate {
    const ym = `${year}-${String(month).padStart(2, '0')}`;
    return {
      yearMonth: ym,
      year,
      month,
      temperature,
      precipitation,
      pressure,
      sunshine,
      snowfall,
    };
  }

  it('groups Dec 2023 + Jan 2024 + Feb 2024 into DJF_2024', () => {
    const monthly: MonthlyClimate[] = [
      makeMonth(2023, 12, 0, 100, 1010, 1000, 5),
      makeMonth(2024, 1, 2, 80, 1015, 800, 3),
      makeMonth(2024, 2, 4, 60, 1020, 600, 1),
    ];

    const result = aggregateSeasonal(monthly);

    expect(result).toHaveLength(1);

    const season = result[0];
    expect(season.key).toBe('DJF_2024');
    expect(season.seasonKey).toBe('DJF');
    expect(season.year).toBe(2024);
    // temperature: mean([0, 2, 4]) = 6/3 = 2
    expect(season.temperature).toBeCloseTo(2);
    // precipitation: sum([100, 80, 60]) = 240
    expect(season.precipitation).toBeCloseTo(240);
    // pressure: mean([1010, 1015, 1020]) = 3045/3 = 1015
    expect(season.pressure).toBeCloseTo(1015);
    // sunshine: sum([1000, 800, 600]) = 2400
    expect(season.sunshine).toBeCloseTo(2400);
    // snowfall: sum([5, 3, 1]) = 9
    expect(season.snowfall).toBeCloseTo(9);
  });

  it('skips incomplete seasons (fewer than 3 months)', () => {
    // Only Jan + Feb 2024 — DJF_2024 has 2 months → skipped
    const monthly: MonthlyClimate[] = [makeMonth(2024, 1, 2, 80), makeMonth(2024, 2, 4, 60)];

    const result = aggregateSeasonal(monthly);

    expect(result).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// computeClimatology
// ---------------------------------------------------------------------------

describe('computeClimatology', () => {
  it('returns null means and stds for a single-period input (< 2 values)', () => {
    const periods: HistoricalPeriod[] = [
      { label: '2023', year: 2023, values: { temperature: 10 } },
    ];

    const { means, stds } = computeClimatology(periods);

    // Only 1 temperature value → not enough for std, so both stay null
    expect(means.temperature).toBeNull();
    expect(stds.temperature).toBeNull();
  });

  it('computes population mean and std for two periods', () => {
    // temperatures [10, 20]: mean=15, population std=5
    const periods: HistoricalPeriod[] = [
      { label: '2022', year: 2022, values: { temperature: 10 } },
      { label: '2023', year: 2023, values: { temperature: 20 } },
    ];

    const { means, stds } = computeClimatology(periods);

    expect(means.temperature).toBeCloseTo(15);
    // variance = ((10-15)^2 + (20-15)^2) / 2 = (25 + 25) / 2 = 25; std = sqrt(25) = 5
    expect(stds.temperature).toBeCloseTo(5);
    // Other variables have no values → remain null
    expect(means.precipitation).toBeNull();
    expect(stds.precipitation).toBeNull();
  });

  it('leaves all means and stds null when no variable values are provided', () => {
    const periods: HistoricalPeriod[] = [{ label: '2023', year: 2023, values: {} }];

    const { means, stds } = computeClimatology(periods);

    expect(means.temperature).toBeNull();
    expect(means.precipitation).toBeNull();
    expect(means.pressure).toBeNull();
    expect(means.sunshine).toBeNull();
    expect(means.snowfall).toBeNull();
    expect(stds.temperature).toBeNull();
    expect(stds.precipitation).toBeNull();
    expect(stds.pressure).toBeNull();
    expect(stds.sunshine).toBeNull();
    expect(stds.snowfall).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// findAnalogues
// ---------------------------------------------------------------------------

describe('findAnalogues', () => {
  // Build the helper inputs: only temperature dimension active
  const climMean = {
    temperature: 15,
    precipitation: null,
    pressure: null,
    sunshine: null,
    snowfall: null,
  };
  const climStd = {
    temperature: 5,
    precipitation: null,
    pressure: null,
    sunshine: null,
    snowfall: null,
  };
  const forecastMeans = {
    temperature: 20, // z-score = (20-15)/5 = 1.0
    precipitation: null,
    pressure: null,
    sunshine: null,
    snowfall: null,
  };

  // Historical temperatures [15, 10, 20, 25, 30] and their z-score distances to z=1.0:
  //   temp=15 → hz=0.0, dist=|0.0-1.0|=1.0
  //   temp=10 → hz=-1.0, dist=2.0
  //   temp=20 → hz=1.0,  dist=0.0  ← closest
  //   temp=25 → hz=2.0,  dist=1.0
  //   temp=30 → hz=3.0,  dist=2.0
  // maxDist across all 5 = 2.0
  const historicalPeriods: HistoricalPeriod[] = [
    { label: 'Period A', year: 2019, values: { temperature: 15 } },
    { label: 'Period B', year: 2020, values: { temperature: 10 } },
    { label: 'Period C', year: 2021, values: { temperature: 20 } },
    { label: 'Period D', year: 2022, values: { temperature: 25 } },
    { label: 'Period E', year: 2023, values: { temperature: 30 } },
  ];

  it('returns exactly 3 analogues', () => {
    const result = findAnalogues(forecastMeans, historicalPeriods, climMean, climStd);
    expect(result).toHaveLength(3);
  });

  it('sorts analogues by distance ascending (closest first)', () => {
    const result = findAnalogues(forecastMeans, historicalPeriods, climMean, climStd);
    for (let i = 0; i < result.length - 1; i++) {
      expect(result[i].distance).toBeLessThanOrEqual(result[i + 1].distance);
    }
  });

  it('places the period with temperature=20 (distance=0) as the best analogue', () => {
    const result = findAnalogues(forecastMeans, historicalPeriods, climMean, climStd);
    expect(result[0].label).toBe('Period C');
    expect(result[0].distance).toBeCloseTo(0);
  });

  it('assigns similarity=1 to the closest analogue', () => {
    const result = findAnalogues(forecastMeans, historicalPeriods, climMean, climStd);
    // maxDist=2 (from periods B/E), so Period C: 1 - 0/2 = 1.0
    expect(result[0].similarity).toBeCloseTo(1.0);
  });

  it('assigns lower similarity to analogues farther from the forecast', () => {
    const result = findAnalogues(forecastMeans, historicalPeriods, climMean, climStd);
    // Periods at distance=1.0 have similarity = 1 - 1/2 = 0.5
    expect(result[1].similarity).toBeCloseTo(0.5);
    expect(result[2].similarity).toBeCloseTo(0.5);
    expect(result[2].similarity).toBeLessThan(result[0].similarity);
  });
});

// ---------------------------------------------------------------------------
// getAboveCount
// ---------------------------------------------------------------------------

describe('getAboveCount', () => {
  it('counts historical values strictly below the forecast', () => {
    // 10 < 25 ✓, 20 < 25 ✓, 30 < 25 ✗ → 2
    expect(getAboveCount(25, [10, 20, 30])).toBe(2);
  });

  it('does not count a value equal to the forecast (strict less-than)', () => {
    // 10 < 20 ✓, 20 < 20 ✗ (equal, not counted), 30 < 20 ✗ → 1
    expect(getAboveCount(20, [10, 20, 30])).toBe(1);
  });

  it('returns full array length when all historical values are below the forecast', () => {
    expect(getAboveCount(100, [10, 20, 30])).toBe(3);
  });

  it('returns 0 for an empty historical array', () => {
    expect(getAboveCount(15, [])).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// getHolisticSummary
// ---------------------------------------------------------------------------

describe('getHolisticSummary', () => {
  const nullAnomalies = {
    temperature: null,
    precipitation: null,
    pressure: null,
    sunshine: null,
    snowfall: null,
  };

  it('returns warm+wet combined sentence when temp≥1 and precip≥10', () => {
    const anomalies = { ...nullAnomalies, temperature: 2, precipitation: 15 };
    expect(getHolisticSummary(anomalies, 'es')).toBe(
      'Un periodo más cálido y húmedo de lo normal.',
    );
  });

  it('returns cold+dry combined sentence when temp≤−1 and precip≤−10', () => {
    const anomalies = { ...nullAnomalies, temperature: -2, precipitation: -15 };
    expect(getHolisticSummary(anomalies, 'es')).toBe('Más frío y seco de lo habitual.');
  });

  it('returns near-normal sentence when all anomalies are within thresholds', () => {
    const anomalies = { ...nullAnomalies, temperature: 0, precipitation: 0 };
    expect(getHolisticSummary(anomalies, 'es')).toBe(
      'Condiciones cercanas a lo normal en temperatura y precipitación.',
    );
  });

  it('falls back to ranked single-variable sentence when only temperature is anomalous', () => {
    // temp=2 (warm) but precip=0 (no precip signal) → ranked fallback, top variable = temperature
    const anomalies = { ...nullAnomalies, temperature: 2, precipitation: 0 };
    expect(getHolisticSummary(anomalies, 'es')).toBe('Un periodo más cálido de lo normal.');
  });
});
