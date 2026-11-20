import { describe, expect, it } from 'vite-plus/test';
import { formatPrecipMm, precipLabels } from '../chartLabels';

describe('formatPrecipMm', () => {
  it('uses one decimal below 10 mm and integers above', () => {
    expect(formatPrecipMm(0.14)).toBe('0.1');
    expect(formatPrecipMm(7)).toBe('7.0');
    expect(formatPrecipMm(18.6)).toBe('19');
  });
});

describe('precipLabels', () => {
  it('labels every wet bar with radius 0 and skips dry/trace bars', () => {
    expect(precipLabels([0, 0.05, 0.1, 6.8, 19])).toEqual(['', '', '0.1', '6.8', '19']);
  });

  it('labels only the peak within ±radius', () => {
    const v = [0.1, 0.1, 0.4, 0.4, 0.7, 0.5, 0.6, 0.4, 0, 0, 2.5, 2.5, 1.0];
    const labels = precipLabels(v, 2);
    expect(labels.filter(Boolean)).toEqual(['0.7', '2.5']);
    expect(labels[4]).toBe('0.7');
    expect(labels[10]).toBe('2.5'); // tie → earliest
  });

  it('keeps labels at least radius + 1 bars apart', () => {
    const v = [1, 0, 1, 0, 1, 0, 1];
    const idx = precipLabels(v, 2)
      .map((l, i) => (l ? i : -1))
      .filter((i) => i >= 0);
    for (let k = 1; k < idx.length; k++) expect(idx[k] - idx[k - 1]).toBeGreaterThan(2);
  });

  it('treats null/NaN as dry', () => {
    expect(precipLabels([Number.NaN, 0.3])).toEqual(['', '0.3']);
  });
});
