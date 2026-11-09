import { describe, it, expect } from 'vite-plus/test';
import {
  wmoToCondition,
  getPressureDeltaAlert,
  getGustLevel,
  getStormPotential,
  getAqiInfo,
  getPollenLevel,
  getUvInfo,
  getWindDirection,
  GUST_THRESHOLDS,
} from '../weatherCodes';

// ---------------------------------------------------------------------------
// wmoToCondition
// ---------------------------------------------------------------------------
describe('wmoToCondition', () => {
  it('code 0 → clear', () => expect(wmoToCondition(0)).toBe('clear'));
  it('code 1 → partly-cloudy', () => expect(wmoToCondition(1)).toBe('partly-cloudy'));
  it('code 2 → partly-cloudy', () => expect(wmoToCondition(2)).toBe('partly-cloudy'));
  it('code 3 → cloudy', () => expect(wmoToCondition(3)).toBe('cloudy'));
  it('code 45 → fog', () => expect(wmoToCondition(45)).toBe('fog'));
  it('code 48 → fog', () => expect(wmoToCondition(48)).toBe('fog'));
  it('code 71 → snow', () => expect(wmoToCondition(71)).toBe('snow'));
  it('code 77 → snow', () => expect(wmoToCondition(77)).toBe('snow'));
  it('code 85 → snow', () => expect(wmoToCondition(85)).toBe('snow'));
  it('code 86 → snow (explicit)', () => expect(wmoToCondition(86)).toBe('snow'));
  it('code 95 → storm', () => expect(wmoToCondition(95)).toBe('storm'));
  it('code 96 → storm', () => expect(wmoToCondition(96)).toBe('storm'));
  it('code 99 → storm', () => expect(wmoToCondition(99)).toBe('storm'));
  it('code 51 → rain (lower drizzle boundary)', () => expect(wmoToCondition(51)).toBe('rain'));
  it('code 61 → rain', () => expect(wmoToCondition(61)).toBe('rain'));

  // Gap / edge cases
  it('code 4 → clear (falls to default; not in any explicit branch after 3)', () =>
    expect(wmoToCondition(4)).toBe('clear'));
  it('code 50 → clear (below ≥51 rain gate, not in any named branch)', () =>
    expect(wmoToCondition(50)).toBe('clear'));
  it('code 69 → rain (between drizzle codes and rain codes but ≥51)', () =>
    expect(wmoToCondition(69)).toBe('rain'));
  it('code 84 → rain (not in snow range 71-77/85/86, but ≥51)', () =>
    expect(wmoToCondition(84)).toBe('rain'));
});

// ---------------------------------------------------------------------------
// getPressureDeltaAlert
// ---------------------------------------------------------------------------
describe('getPressureDeltaAlert', () => {
  describe('label bands (es, default)', () => {
    it('deltaP -5 → RIESGO (at ≤-5 boundary)', () => {
      expect(getPressureDeltaAlert(-5).label).toBe('RIESGO');
    });
    it('deltaP -6 → RIESGO (below -5)', () => {
      expect(getPressureDeltaAlert(-6).label).toBe('RIESGO');
    });
    it('deltaP -4 → BAJA (between -5 and -3)', () => {
      expect(getPressureDeltaAlert(-4).label).toBe('BAJA');
    });
    it('deltaP -3 → BAJA (at ≤-3 boundary)', () => {
      expect(getPressureDeltaAlert(-3).label).toBe('BAJA');
    });
    it('deltaP -2 → ESTABLE', () => {
      expect(getPressureDeltaAlert(-2).label).toBe('ESTABLE');
    });
    it('deltaP 4 → ESTABLE (below ≥5 gate)', () => {
      expect(getPressureDeltaAlert(4).label).toBe('ESTABLE');
    });
    it('deltaP 5 → SUBE (at ≥5 boundary)', () => {
      expect(getPressureDeltaAlert(5).label).toBe('SUBE');
    });
    it('deltaP 6 → SUBE (above 5)', () => {
      expect(getPressureDeltaAlert(6).label).toBe('SUBE');
    });
  });

  describe('detail string format', () => {
    // RIESGO: detail = `${deltaP} hPa` (no explicit sign prefix)
    it('RIESGO detail is plain number + " hPa"', () => {
      expect(getPressureDeltaAlert(-5).detail).toBe('-5 hPa');
    });

    // BAJA: detail = `${deltaP} hPa` (no explicit sign prefix)
    it('BAJA detail is plain number + " hPa"', () => {
      expect(getPressureDeltaAlert(-3).detail).toBe('-3 hPa');
    });

    // SUBE: detail = `+${deltaP} hPa` (hardcoded '+' prefix in template)
    it('SUBE detail has hardcoded "+" prefix', () => {
      expect(getPressureDeltaAlert(5).detail).toBe('+5 hPa');
    });

    // ESTABLE with positive deltaP: sign = '+', detail = `+${deltaP} hPa`
    it('ESTABLE positive deltaP gets "+" prefix', () => {
      expect(getPressureDeltaAlert(4).detail).toBe('+4 hPa');
    });

    // ESTABLE with negative deltaP: sign = '', detail = `${deltaP} hPa` → "-2 hPa"
    it('ESTABLE negative deltaP uses natural minus from number', () => {
      expect(getPressureDeltaAlert(-2).detail).toBe('-2 hPa');
    });

    // ESTABLE with zero: sign = '', detail = `0 hPa`
    it('ESTABLE zero deltaP has no sign prefix', () => {
      expect(getPressureDeltaAlert(0).detail).toBe('0 hPa');
    });
  });

  describe('lang=en label override', () => {
    it('deltaP -5, lang en → RISK', () => {
      expect(getPressureDeltaAlert(-5, 'en').label).toBe('RISK');
    });
    it('deltaP -4, lang en → DROPS', () => {
      expect(getPressureDeltaAlert(-4, 'en').label).toBe('DROPS');
    });
    it('deltaP 5, lang en → RISES', () => {
      expect(getPressureDeltaAlert(5, 'en').label).toBe('RISES');
    });
    it('deltaP 0, lang en → STABLE', () => {
      expect(getPressureDeltaAlert(0, 'en').label).toBe('STABLE');
    });
  });
});

// ---------------------------------------------------------------------------
// getGustLevel — GUST_THRESHOLDS: breezy=28, strong=40, gale=62, storm=89
// ---------------------------------------------------------------------------
describe('GUST_THRESHOLDS', () => {
  it('breezy threshold is 28', () => expect(GUST_THRESHOLDS.breezy).toBe(28));
  it('strong threshold is 40', () => expect(GUST_THRESHOLDS.strong).toBe(40));
  it('gale threshold is 62', () => expect(GUST_THRESHOLDS.gale).toBe(62));
  it('storm threshold is 89', () => expect(GUST_THRESHOLDS.storm).toBe(89));
});

describe('getGustLevel', () => {
  it('27 → null (below breezy)', () => expect(getGustLevel(27)).toBeNull());
  it('27.9 → null (just below breezy boundary)', () => expect(getGustLevel(27.9)).toBeNull());
  it('28.0 → breezy (at breezy boundary)', () => expect(getGustLevel(28.0)).toBe('breezy'));
  it('28 → breezy', () => expect(getGustLevel(28)).toBe('breezy'));
  it('39 → breezy (below strong)', () => expect(getGustLevel(39)).toBe('breezy'));
  it('40 → strong (at strong boundary)', () => expect(getGustLevel(40)).toBe('strong'));
  it('61 → strong (below gale)', () => expect(getGustLevel(61)).toBe('strong'));
  it('62 → gale (at gale boundary)', () => expect(getGustLevel(62)).toBe('gale'));
  it('88 → gale (below storm)', () => expect(getGustLevel(88)).toBe('gale'));
  it('89 → storm (at storm boundary)', () => expect(getGustLevel(89)).toBe('storm'));
  it('100 → storm (above storm)', () => expect(getGustLevel(100)).toBe('storm'));
});

// ---------------------------------------------------------------------------
// getStormPotential — >2500 extreme, >1000 strong, >300 moderate, >50 slight, else none
// ---------------------------------------------------------------------------
describe('getStormPotential', () => {
  describe('level classification', () => {
    it('cape 2501 → extreme', () => expect(getStormPotential(2501).level).toBe('extreme'));
    it('cape 2500 → strong (not >2500)', () =>
      expect(getStormPotential(2500).level).toBe('strong'));
    it('cape 1001 → strong', () => expect(getStormPotential(1001).level).toBe('strong'));
    it('cape 1000 → moderate (not >1000)', () =>
      expect(getStormPotential(1000).level).toBe('moderate'));
    it('cape 301 → moderate', () => expect(getStormPotential(301).level).toBe('moderate'));
    it('cape 300 → slight (not >300)', () =>
      expect(getStormPotential(300).level).toBe('slight'));
    it('cape 51 → slight', () => expect(getStormPotential(51).level).toBe('slight'));
    it('cape 50 → none (not >50)', () => expect(getStormPotential(50).level).toBe('none'));
    it('cape 0 → none', () => expect(getStormPotential(0).level).toBe('none'));
  });

  describe('label (es, default)', () => {
    it('extreme label → EXTREMO', () => expect(getStormPotential(3000).label).toBe('EXTREMO'));
    it('strong label → FUERTE', () => expect(getStormPotential(1500).label).toBe('FUERTE'));
    it('moderate label → MOD', () => expect(getStormPotential(500).label).toBe('MOD'));
    it('slight label → LEVE', () => expect(getStormPotential(100).label).toBe('LEVE'));
    it('none label → NINGUNO', () => expect(getStormPotential(0).label).toBe('NINGUNO'));
  });
});

// ---------------------------------------------------------------------------
// getAqiInfo — ≤20 Bueno, ≤40 Aceptable, ≤60 Moderado, ≤80 Malo, ≤100 Muy Malo, else Extremo
// ---------------------------------------------------------------------------
describe('getAqiInfo', () => {
  it('aqi 0 → Bueno', () => expect(getAqiInfo(0).label).toBe('Bueno'));
  it('aqi 20 → Bueno (at ≤20 boundary)', () => expect(getAqiInfo(20).label).toBe('Bueno'));
  it('aqi 21 → Aceptable', () => expect(getAqiInfo(21).label).toBe('Aceptable'));
  it('aqi 40 → Aceptable (at ≤40 boundary)', () =>
    expect(getAqiInfo(40).label).toBe('Aceptable'));
  it('aqi 41 → Moderado', () => expect(getAqiInfo(41).label).toBe('Moderado'));
  it('aqi 60 → Moderado (at ≤60 boundary)', () =>
    expect(getAqiInfo(60).label).toBe('Moderado'));
  it('aqi 61 → Malo', () => expect(getAqiInfo(61).label).toBe('Malo'));
  it('aqi 80 → Malo (at ≤80 boundary)', () => expect(getAqiInfo(80).label).toBe('Malo'));
  it('aqi 81 → Muy Malo', () => expect(getAqiInfo(81).label).toBe('Muy Malo'));
  it('aqi 100 → Muy Malo (at ≤100 boundary)', () =>
    expect(getAqiInfo(100).label).toBe('Muy Malo'));
  it('aqi 101 → Extremo', () => expect(getAqiInfo(101).label).toBe('Extremo'));
});

// ---------------------------------------------------------------------------
// getPollenLevel — ≤0 null, ≤10 Bajo, ≤50 Mod, ≤200 Alto, >200 M.Alto
// ---------------------------------------------------------------------------
describe('getPollenLevel', () => {
  it('value 0 → null', () => expect(getPollenLevel(0)).toBeNull());
  it('negative value → null', () => expect(getPollenLevel(-1)).toBeNull());
  it('value 10 → Bajo (at ≤10 boundary)', () => expect(getPollenLevel(10)?.label).toBe('Bajo'));
  it('value 1 → Bajo', () => expect(getPollenLevel(1)?.label).toBe('Bajo'));
  it('value 11 → Mod', () => expect(getPollenLevel(11)?.label).toBe('Mod'));
  it('value 50 → Mod (at ≤50 boundary)', () => expect(getPollenLevel(50)?.label).toBe('Mod'));
  it('value 51 → Alto', () => expect(getPollenLevel(51)?.label).toBe('Alto'));
  it('value 200 → Alto (at ≤200 boundary)', () =>
    expect(getPollenLevel(200)?.label).toBe('Alto'));
  it('value 201 → M.Alto', () => expect(getPollenLevel(201)?.label).toBe('M.Alto'));
});

// ---------------------------------------------------------------------------
// getUvInfo — <3 Bajo, <6 Moderado, <8 Alto, <11 Muy Alto, else Extremo
// ---------------------------------------------------------------------------
describe('getUvInfo', () => {
  it('uv 0 → Bajo', () => expect(getUvInfo(0).label).toBe('Bajo'));
  it('uv 2 → Bajo (below <3 boundary)', () => expect(getUvInfo(2).label).toBe('Bajo'));
  it('uv 3 → Moderado (at <3 boundary, fails; hits <6)', () =>
    expect(getUvInfo(3).label).toBe('Moderado'));
  it('uv 5 → Moderado', () => expect(getUvInfo(5).label).toBe('Moderado'));
  it('uv 6 → Alto (at <6 boundary, fails; hits <8)', () =>
    expect(getUvInfo(6).label).toBe('Alto'));
  it('uv 7 → Alto', () => expect(getUvInfo(7).label).toBe('Alto'));
  it('uv 8 → Muy Alto (at <8 boundary, fails; hits <11)', () =>
    expect(getUvInfo(8).label).toBe('Muy Alto'));
  it('uv 10 → Muy Alto', () => expect(getUvInfo(10).label).toBe('Muy Alto'));
  it('uv 11 → Extremo (at <11 boundary, fails; hits else)', () =>
    expect(getUvInfo(11).label).toBe('Extremo'));
  it('uv 12 → Extremo', () => expect(getUvInfo(12).label).toBe('Extremo'));
});

// ---------------------------------------------------------------------------
// getWindDirection — dirs (es): ['N','NE','E','SE','S','SO','O','NO']
// index = Math.round(degrees / 45) % 8
// ---------------------------------------------------------------------------
describe('getWindDirection', () => {
  it('0° → N', () => expect(getWindDirection(0)).toBe('N'));
  it('45° → NE', () => expect(getWindDirection(45)).toBe('NE'));
  it('90° → E', () => expect(getWindDirection(90)).toBe('E'));
  it('135° → SE', () => expect(getWindDirection(135)).toBe('SE'));
  it('180° → S', () => expect(getWindDirection(180)).toBe('S'));
  it('225° → SO', () => expect(getWindDirection(225)).toBe('SO'));
  it('270° → O', () => expect(getWindDirection(270)).toBe('O'));
  it('315° → NO', () => expect(getWindDirection(315)).toBe('NO'));
  it('360° → N (wraps via %8: Math.round(360/45)%8 = 8%8 = 0)', () =>
    expect(getWindDirection(360)).toBe('N'));

  // Rounding boundaries: 22° → Math.round(22/45) = Math.round(0.489) = 0 → N
  it('22° → N (rounds down to index 0)', () => expect(getWindDirection(22)).toBe('N'));
  // 23° → Math.round(23/45) = Math.round(0.511) = 1 → NE
  it('23° → NE (rounds up to index 1)', () => expect(getWindDirection(23)).toBe('NE'));

  describe('lang=en uses SW/W/NW instead of SO/O/NO', () => {
    it('225°, en → SW', () => expect(getWindDirection(225, 'en')).toBe('SW'));
    it('270°, en → W', () => expect(getWindDirection(270, 'en')).toBe('W'));
    it('315°, en → NW', () => expect(getWindDirection(315, 'en')).toBe('NW'));
  });
});
