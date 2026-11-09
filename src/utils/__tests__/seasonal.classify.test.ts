import { describe, it, expect } from 'vite-plus/test';
import { classifyAnomaly, formatAbsolute, getAnomalyClass } from '../seasonal';
import type { SeasonalValue, SeasonalVariable } from '../../types/weather';

const val = (mean: number | null, anomaly: number | null): SeasonalValue => ({
  mean,
  anomaly,
  probAbove: null,
});

// ---------------------------------------------------------------------------
// classifyAnomaly
// ---------------------------------------------------------------------------
describe('classifyAnomaly', () => {
  // -------------------------------------------------------------------------
  // Null guard
  // -------------------------------------------------------------------------
  it('anomaly=null → returns null', () => {
    expect(classifyAnomaly('temperature', val(null, null), 30)).toBeNull();
  });

  // -------------------------------------------------------------------------
  // Temperature — absolute scale (°), thresholds [0.5, 1.5]
  // -------------------------------------------------------------------------
  describe('temperature', () => {
    it('anomaly=0.3 → level=0 (< 0.5), value="+0.3", unit="°"', () => {
      const r = classifyAnomaly('temperature', val(null, 0.3), 30);
      expect(r).toEqual({ level: 0, value: '+0.3', unit: '°' });
    });

    it('anomaly=1.0 → level=1 (0.5 ≤ 1.0 < 1.5), value="+1.0", unit="°"', () => {
      const r = classifyAnomaly('temperature', val(null, 1.0), 30);
      expect(r).toEqual({ level: 1, value: '+1.0', unit: '°' });
    });

    it('anomaly=1.5 → level=2 (≥ 1.5), value="+1.5", unit="°"', () => {
      const r = classifyAnomaly('temperature', val(null, 1.5), 30);
      expect(r).toEqual({ level: 2, value: '+1.5', unit: '°' });
    });

    it('anomaly=−1.5 → level=−2, value="−1.5", unit="°"', () => {
      const r = classifyAnomaly('temperature', val(null, -1.5), 30);
      expect(r).toEqual({ level: -2, value: '−1.5', unit: '°' });
    });

    it('anomaly=−0.8 → level=−1 (0.5 ≤ 0.8 < 1.5), value="−0.8", unit="°"', () => {
      const r = classifyAnomaly('temperature', val(null, -0.8), 30);
      expect(r).toEqual({ level: -1, value: '−0.8', unit: '°' });
    });
  });

  // -------------------------------------------------------------------------
  // Pressure — absolute scale (hPa), thresholds [1, 4]
  // -------------------------------------------------------------------------
  describe('pressure', () => {
    it('anomaly=0.5 → level=0 (< 1), value="+0.5", unit="hPa"', () => {
      const r = classifyAnomaly('pressure', val(null, 0.5), 30);
      expect(r).toEqual({ level: 0, value: '+0.5', unit: 'hPa' });
    });

    it('anomaly=2.0 → level=1 (1 ≤ 2 < 4), value="+2.0", unit="hPa"', () => {
      const r = classifyAnomaly('pressure', val(null, 2.0), 30);
      expect(r).toEqual({ level: 1, value: '+2.0', unit: 'hPa' });
    });

    it('anomaly=4.0 → level=2 (≥ 4), value="+4.0", unit="hPa"', () => {
      const r = classifyAnomaly('pressure', val(null, 4.0), 30);
      expect(r).toEqual({ level: 2, value: '+4.0', unit: 'hPa' });
    });

    it('anomaly=−4.1 → level=−2, value="−4.1", unit="hPa"', () => {
      const r = classifyAnomaly('pressure', val(null, -4.1), 30);
      expect(r).toEqual({ level: -2, value: '−4.1', unit: 'hPa' });
    });
  });

  // -------------------------------------------------------------------------
  // Precipitation — relative % scale, floor=0.5mm/day, thresholds [10, 30]
  // mean=null → clim=null → mm display; mean present → % display when clim ≥ floor
  // -------------------------------------------------------------------------
  describe('precipitation', () => {
    it('mean=null, anomaly=5, days=30 → clim=null → mm display, level=2', () => {
      // floor=15mm; score=(5/max(0,15))*100=33.3% ≥ 30 → level=2; display mm
      const r = classifyAnomaly('precipitation', val(null, 5), 30);
      expect(r).toEqual({ level: 2, value: '+5.0', unit: 'mm' });
    });

    it('mean=100, anomaly=20, days=30 → clim=80 ≥ floor=15 → % display, level=1', () => {
      // score=(20/80)*100=25%; 10 ≤ 25 < 30 → level=1
      const r = classifyAnomaly('precipitation', val(100, 20), 30);
      expect(r).toEqual({ level: 1, value: '+25', unit: '%' });
    });

    it('mean=100, anomaly=5, days=30 → clim=95 ≥ floor=15 → % display, level=0', () => {
      // score=(5/95)*100≈5.3%; 5.3 < 10 → level=0; signed(5.3,0)→'+5'
      const r = classifyAnomaly('precipitation', val(100, 5), 30);
      expect(r).toEqual({ level: 0, value: '+5', unit: '%' });
    });
  });

  // -------------------------------------------------------------------------
  // Sunshine — displays hours (anomaly s / 3600), floor=1800s/day, thresholds [10, 25]
  // -------------------------------------------------------------------------
  describe('sunshine', () => {
    it('anomaly=3600s (1h), mean=100000s, days=30 → score≈3.7% < 10 → level=0, value="+1.0h"', () => {
      // floor=54000s; clim=96400; score=(3600/96400)*100≈3.7%
      const r = classifyAnomaly('sunshine', val(100000, 3600), 30);
      expect(r).toEqual({ level: 0, value: '+1.0', unit: 'h' });
    });

    it('anomaly=18000s (5h), mean=180000s, days=30 → score≈11.1% → level=1, value="+5.0h"', () => {
      // floor=54000; clim=162000; score=(18000/162000)*100≈11.1%; 10 ≤ 11.1 < 25
      const r = classifyAnomaly('sunshine', val(180000, 18000), 30);
      expect(r).toEqual({ level: 1, value: '+5.0', unit: 'h' });
    });

    it('anomaly=−90000s (−25h), mean=270000s, days=30 → score=−25% → level=−2, value="−25h"', () => {
      // floor=54000; clim=360000; score=(-90000/360000)*100=-25%; |-25| ≥ 25 → level=-2
      // |h|=25 ≥ 10 → digits=0; signed(-25,0)='−25'
      const r = classifyAnomaly('sunshine', val(270000, -90000), 30);
      expect(r).toEqual({ level: -2, value: '−25', unit: 'h' });
    });
  });

  // -------------------------------------------------------------------------
  // Snowfall — displays cm, floor=0.3cm/day, thresholds [20, 50]
  // -------------------------------------------------------------------------
  describe('snowfall', () => {
    it('anomaly=5cm, mean=20cm, days=30 → clim=15 ≥ floor=9 → score≈33.3% → level=1', () => {
      // score=(5/15)*100=33.3%; 20 ≤ 33.3 < 50 → level=1; value='+5.0', unit='cm'
      const r = classifyAnomaly('snowfall', val(20, 5), 30);
      expect(r).toEqual({ level: 1, value: '+5.0', unit: 'cm' });
    });

    it('anomaly=−1cm, mean=20cm, days=30 → score≈−4.8% < 20 → level=0, value="−1.0cm"', () => {
      // clim=21; score=(-1/21)*100≈-4.8%; mag < 20 → level=0
      const r = classifyAnomaly('snowfall', val(20, -1), 30);
      expect(r).toEqual({ level: 0, value: '−1.0', unit: 'cm' });
    });

    it('anomaly=15cm, mean=20cm, days=30 → clim=5 < floor=9 → score uses floor → level=2', () => {
      // floor=9; clim=5 < floor, so denom=max(5,9)=9; score=(15/9)*100≈166.7% ≥ 50 → level=2
      const r = classifyAnomaly('snowfall', val(20, 15), 30);
      expect(r).toEqual({ level: 2, value: '+15.0', unit: 'cm' });
    });
  });
});

// ---------------------------------------------------------------------------
// formatAbsolute
// ---------------------------------------------------------------------------
describe('formatAbsolute', () => {
  it('null → "—"', () => {
    expect(formatAbsolute('temperature', null)).toBe('—');
  });

  it('temperature 15.567 → "15.6 °C" (1 decimal)', () => {
    expect(formatAbsolute('temperature', 15.567)).toBe('15.6 °C');
  });

  it('precipitation 42.7 → "43 mm" (Math.round)', () => {
    expect(formatAbsolute('precipitation', 42.7)).toBe('43 mm');
  });

  it('pressure 1013.4 → "1013.4 hPa" (1 decimal)', () => {
    expect(formatAbsolute('pressure', 1013.4)).toBe('1013.4 hPa');
  });

  it('sunshine 7200s → "2 h" (seconds / 3600, rounded)', () => {
    expect(formatAbsolute('sunshine', 7200)).toBe('2 h');
  });

  it('snowfall 3.14 → "3.1 cm" (1 decimal)', () => {
    expect(formatAbsolute('snowfall', 3.14)).toBe('3.1 cm');
  });

  it('null with precipitation → "—"', () => {
    const v: SeasonalVariable = 'precipitation';
    expect(formatAbsolute(v, null)).toBe('—');
  });
});

// ---------------------------------------------------------------------------
// getAnomalyClass
// ---------------------------------------------------------------------------
describe('getAnomalyClass', () => {
  // -------------------------------------------------------------------------
  // level=0 — surface-sensitive neutral pill
  // -------------------------------------------------------------------------
  describe('level=0', () => {
    it('surface=dark (default) → semi-transparent white pill', () => {
      expect(getAnomalyClass('temperature', 0)).toBe(
        'bg-white/10 text-white ring-1 ring-inset ring-white/20',
      );
    });

    it('surface=dark explicit → same as default', () => {
      expect(getAnomalyClass('precipitation', 0, 'dark')).toBe(
        'bg-white/10 text-white ring-1 ring-inset ring-white/20',
      );
    });

    it('surface=light → slate pill', () => {
      expect(getAnomalyClass('temperature', 0, 'light')).toBe('bg-slate-100 text-slate-700');
    });

    it('surface=light, different variable → same slate pill', () => {
      expect(getAnomalyClass('pressure', 0, 'light')).toBe('bg-slate-100 text-slate-700');
    });
  });

  // -------------------------------------------------------------------------
  // Temperature palette: [-2]=blue-600, [-1]=sky-300, [1]=orange-300, [2]=red-600
  // -------------------------------------------------------------------------
  describe('temperature palette', () => {
    it('level=−2 → strong cold: "bg-blue-600 text-white"', () => {
      expect(getAnomalyClass('temperature', -2)).toBe('bg-blue-600 text-white');
    });

    it('level=−1 → mild cold: "bg-sky-300 text-slate-900"', () => {
      expect(getAnomalyClass('temperature', -1)).toBe('bg-sky-300 text-slate-900');
    });

    it('level=1 → mild warm: "bg-orange-300 text-slate-900"', () => {
      expect(getAnomalyClass('temperature', 1)).toBe('bg-orange-300 text-slate-900');
    });

    it('level=2 → strong warm: "bg-red-600 text-white"', () => {
      expect(getAnomalyClass('temperature', 2)).toBe('bg-red-600 text-white');
    });

    it('level=2, surface=light → same palette as dark (non-zero ignores surface)', () => {
      expect(getAnomalyClass('temperature', 2, 'light')).toBe('bg-red-600 text-white');
    });

    it('level=−2, surface=light → same palette as dark', () => {
      expect(getAnomalyClass('temperature', -2, 'light')).toBe('bg-blue-600 text-white');
    });
  });

  // -------------------------------------------------------------------------
  // Precipitation palette: [-2]=amber-700, [-1]=amber-200, [1]=emerald-300, [2]=emerald-700
  // -------------------------------------------------------------------------
  describe('precipitation palette', () => {
    it('level=−2 → "bg-amber-700 text-white"', () => {
      expect(getAnomalyClass('precipitation', -2)).toBe('bg-amber-700 text-white');
    });

    it('level=−1 → "bg-amber-200 text-slate-900"', () => {
      expect(getAnomalyClass('precipitation', -1)).toBe('bg-amber-200 text-slate-900');
    });

    it('level=1 → "bg-emerald-300 text-slate-900"', () => {
      expect(getAnomalyClass('precipitation', 1)).toBe('bg-emerald-300 text-slate-900');
    });

    it('level=2 → "bg-emerald-700 text-white"', () => {
      expect(getAnomalyClass('precipitation', 2)).toBe('bg-emerald-700 text-white');
    });
  });

  // -------------------------------------------------------------------------
  // Pressure palette: [-2]=pink-700, [-1]=pink-300, [1]=indigo-300, [2]=indigo-600
  // -------------------------------------------------------------------------
  describe('pressure palette', () => {
    it('level=1 → "bg-indigo-300 text-slate-900"', () => {
      expect(getAnomalyClass('pressure', 1)).toBe('bg-indigo-300 text-slate-900');
    });

    it('level=−2 → "bg-pink-700 text-white"', () => {
      expect(getAnomalyClass('pressure', -2)).toBe('bg-pink-700 text-white');
    });
  });

  // -------------------------------------------------------------------------
  // Sunshine palette: [-2]=slate-500, [1]=yellow-200, [2]=yellow-400
  // -------------------------------------------------------------------------
  describe('sunshine palette', () => {
    it('level=2 → "bg-yellow-400 text-slate-900"', () => {
      expect(getAnomalyClass('sunshine', 2)).toBe('bg-yellow-400 text-slate-900');
    });

    it('level=−2 → "bg-slate-500 text-white"', () => {
      expect(getAnomalyClass('sunshine', -2)).toBe('bg-slate-500 text-white');
    });
  });

  // -------------------------------------------------------------------------
  // Snowfall palette: [1]=cyan-200, [2]=cyan-400
  // -------------------------------------------------------------------------
  describe('snowfall palette', () => {
    it('level=1 → "bg-cyan-200 text-slate-900"', () => {
      expect(getAnomalyClass('snowfall', 1)).toBe('bg-cyan-200 text-slate-900');
    });

    it('level=2 → "bg-cyan-400 text-slate-900"', () => {
      expect(getAnomalyClass('snowfall', 2)).toBe('bg-cyan-400 text-slate-900');
    });
  });
});
