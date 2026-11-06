import { describe, it, expect } from 'vitest';
import { getMigraineRisk, getWindChillIndex, getThomsDiscomfortIndex } from '../weatherCodes';

// ---------------------------------------------------------------------------
// getMigraineRisk
//
// Scoring rules (from source):
//   deltaP <= -5         → +3 pts
//   deltaP <= -3         → +1 pt  (else-if, so not cumulative with the -5 branch)
//   pressure < 1010      → +1 pt
//   humidity > 70        → +1 pt
//   precip > 0           → +1 pt
//   cape !== undefined && cape > 1000 → +1 pt
//   Score capped at 6.
//
// Label mapping:
//   score >= 6 → 'EXTREMO'
//   score >= 4 → 'ALTO'
//   score >= 3 → 'MOD'
//   score >= 2 → 'BAJO'
//   else       → 'MÍNIMO'   (covers score 0 and 1)
//
// Neutral baseline that contributes 0 pts: deltaP=0, pressure=1013, humidity=50, precip=0
// ---------------------------------------------------------------------------

describe('getMigraineRisk', () => {
  // --- individual trigger isolation ---

  it('deltaP=-5 → +3 pts → score 3 → MOD', () => {
    const result = getMigraineRisk(-5, 1013, 50, 0, 'es');
    expect(result.score).toBe(3);
    expect(result.label).toBe('MOD');
  });

  it('deltaP=-3 → +1 pt → score 1 → MÍNIMO', () => {
    const result = getMigraineRisk(-3, 1013, 50, 0, 'es');
    expect(result.score).toBe(1);
    expect(result.label).toBe('MÍNIMO');
  });

  it('deltaP=-2 (above -3 boundary) → 0 pts', () => {
    const result = getMigraineRisk(-2, 1013, 50, 0, 'es');
    expect(result.score).toBe(0);
    expect(result.label).toBe('MÍNIMO');
  });

  it.each([
    ['pressure=1009 (below 1010) triggers +1 pt', 0, 1009, 50, 0, 1],
    ['pressure=1010 (requires < 1010, boundary) → 0 pts', 0, 1010, 50, 0, 0],
    ['humidity=71 (above 70) triggers +1 pt', 0, 1013, 71, 0, 1],
    ['humidity=70 (requires > 70, boundary) → 0 pts', 0, 1013, 70, 0, 0],
    ['precip=0.1 (above 0) triggers +1 pt', 0, 1013, 50, 0.1, 1],
    ['precip=0 → 0 pts', 0, 1013, 50, 0, 0],
  ] as const)('%s', (_desc, deltaP, pressure, humidity, precip, expectedScore) => {
    const result = getMigraineRisk(deltaP, pressure, humidity, precip, 'es');
    expect(result.score).toBe(expectedScore);
  });

  // --- CAPE ---

  it('cape absent (undefined) → no CAPE contribution', () => {
    const result = getMigraineRisk(0, 1013, 50, 0, 'es');
    expect(result.score).toBe(0);
  });

  it('cape=1001 (above 1000) → +1 pt', () => {
    const result = getMigraineRisk(0, 1013, 50, 0, 'es', 1001);
    expect(result.score).toBe(1);
  });

  it('cape=1000 (boundary: requires > 1000) → 0 pts', () => {
    const result = getMigraineRisk(0, 1013, 50, 0, 'es', 1000);
    expect(result.score).toBe(0);
  });

  // --- label bands ---

  it('score 0 → label MÍNIMO', () => {
    const result = getMigraineRisk(0, 1013, 50, 0, 'es');
    expect(result.label).toBe('MÍNIMO');
    expect(result.score).toBe(0);
  });

  it('score 2 → label BAJO (deltaP=-3 +1, pressure=1009 +1)', () => {
    // deltaP=-3 → +1, pressure=1009 → +1 = 2
    const result = getMigraineRisk(-3, 1009, 50, 0, 'es');
    expect(result.score).toBe(2);
    expect(result.label).toBe('BAJO');
  });

  it('score 4 → label ALTO (deltaP=-3 +1, pressure=1009 +1, humidity=71 +1, precip=0.1 +1)', () => {
    // deltaP=-3 → +1, pressure=1009 → +1, humidity=71 → +1, precip=0.1 → +1 = 4
    const result = getMigraineRisk(-3, 1009, 71, 0.1, 'es');
    expect(result.score).toBe(4);
    expect(result.label).toBe('ALTO');
  });

  // --- score cap ---

  it('uncapped sum of 7 pts (deltaP=-5 +3, pressure=1009 +1, humidity=71 +1, precip=0.1 +1, cape=1001 +1) caps to 6 → EXTREMO', () => {
    // 3 + 1 + 1 + 1 + 1 = 7, Math.min(6, 7) = 6
    const result = getMigraineRisk(-5, 1009, 71, 0.1, 'es', 1001);
    expect(result.score).toBe(6);
    expect(result.label).toBe('EXTREMO');
  });
});

// ---------------------------------------------------------------------------
// getWindChillIndex
//
// Formula (JAG/TI Canadian standard):
//   wci = 13.12 + 0.6215·T − 11.37·V^0.16 + 0.3965·T·V^0.16
//   Applied ONLY when temp <= 10 AND windSpeed > 4.8.
//   Otherwise wci = temp (Math.round to 1 decimal).
//
// shortLabel bands:
//   wci > 0   → 'FRESC'
//   wci > -10  → 'FRÍO'
//   wci > -25  → 'MUY'
//   wci > -40  → 'SEV'
//   else       → 'EXT'
//
// Pre-computed values for specific test inputs (20^0.16 ≈ 1.6150):
//   temp=5,   wind=20  → wci ≈ 1.1  (formula applies; wci < 5)
//   temp=0,   wind=20  → wci ≈ -5.2 → FRÍO
//   temp=-5,  wind=20  → wci ≈ -11.5 → MUY
//   temp=-15, wind=40  → wci ≈ -27.5 → SEV
//   temp=-25, wind=60  → wci ≈ -43.4 → EXT
// ---------------------------------------------------------------------------

describe('getWindChillIndex', () => {
  // --- formula applicability ---

  it('temp=5 wind=20: formula applies, wci < temp (wind chill effect), shortLabel FRESC', () => {
    const result = getWindChillIndex(5, 20, 'es');
    // Formula applies: temp (5) <= 10 and windSpeed (20) > 4.8
    // wci = 13.12 + 0.6215*5 - 11.37*20^0.16 + 0.3965*5*20^0.16 ≈ 1.1
    expect(result.value).toBeLessThan(5);
    expect(result.value).toBeGreaterThan(0);
    expect(result.shortLabel).toBe('FRESC');
  });

  it('temp=10 wind=4.8: boundary — windSpeed must be > 4.8, so formula does NOT apply, wci = temp', () => {
    const result = getWindChillIndex(10, 4.8, 'es');
    expect(result.value).toBe(10);
    expect(result.shortLabel).toBe('FRESC');
  });

  it('temp=5 wind=4.8: boundary — windSpeed exactly 4.8 is not > 4.8, formula does NOT apply, wci = 5', () => {
    const result = getWindChillIndex(5, 4.8, 'es');
    expect(result.value).toBe(5);
  });

  it('temp=11 wind=20: temp > 10 so formula does NOT apply, wci = temp', () => {
    const result = getWindChillIndex(11, 20, 'es');
    expect(result.value).toBe(11);
    expect(result.shortLabel).toBe('FRESC');
  });

  // --- output band coverage ---

  it("'FRÍO' band: temp=0 wind=20 → wci ≈ -5.2 (formula applies, wci in (-10, 0])", () => {
    // 13.12 + 0 - 11.37*20^0.16 + 0 ≈ 13.12 - 18.36 ≈ -5.2
    const result = getWindChillIndex(0, 20, 'es');
    expect(result.value).toBeLessThan(0);
    expect(result.value).toBeGreaterThan(-10);
    expect(result.shortLabel).toBe('FRÍO');
  });

  it("'MUY' band: temp=-5 wind=20 → wci ≈ -11.5 (formula applies, wci in (-25, -10])", () => {
    // 13.12 - 3.1075 - 18.36 - 3.20 ≈ -11.5
    const result = getWindChillIndex(-5, 20, 'es');
    expect(result.value).toBeLessThanOrEqual(-10);
    expect(result.value).toBeGreaterThan(-25);
    expect(result.shortLabel).toBe('MUY');
  });

  it("'SEV' band: temp=-15 wind=40 → wci ≈ -27.5 (formula applies, wci in (-40, -25])", () => {
    // 13.12 - 9.3225 - 20.53 - 10.74 ≈ -27.5
    const result = getWindChillIndex(-15, 40, 'es');
    expect(result.value).toBeLessThanOrEqual(-25);
    expect(result.value).toBeGreaterThan(-40);
    expect(result.shortLabel).toBe('SEV');
  });

  it("'EXT' band: temp=-25 wind=60 → wci ≈ -43.4 (formula applies, wci <= -40)", () => {
    // 13.12 - 15.5375 - 21.89 - 19.09 ≈ -43.4
    const result = getWindChillIndex(-25, 60, 'es');
    expect(result.value).toBeLessThanOrEqual(-40);
    expect(result.shortLabel).toBe('EXT');
  });
});

// ---------------------------------------------------------------------------
// getThomsDiscomfortIndex
//
// Formula: DI = temp − 0.55 × (1 − humidity/100) × (temp − 14.5)
//
// shortLabel bands:
//   DI < 21  → 'BIEN'
//   DI < 24  → 'LEVE'
//   DI < 27  → 'MOD'
//   else     → 'ALTO'
//
// Pre-computed DI values:
//   temp=20, humidity=50:   DI = 20 - 0.55*0.5*5.5  = 20 - 1.5125 = 18.4875  → BIEN
//   temp=25, humidity=30:   DI = 25 - 0.55*0.70*10.5 = 25 - 4.0425 = 20.9575  → BIEN  (just below 21)
//   temp=25, humidity=31:   DI = 25 - 0.55*0.69*10.5 = 25 - 3.9848 = 21.0153  → LEVE  (just above 21)
//   temp=30, humidity=29:   DI = 30 - 0.55*0.71*15.5 = 30 - 6.0528 = 23.9473  → LEVE  (just below 24)
//   temp=30, humidity=30:   DI = 30 - 0.55*0.70*15.5 = 30 - 5.9675 = 24.0325  → MOD   (just above 24)
//   temp=35, humidity=29:   DI = 35 - 0.55*0.71*20.5 = 35 - 8.0053 = 26.9948  → MOD   (just below 27)
//   temp=35, humidity=30:   DI = 35 - 0.55*0.70*20.5 = 35 - 7.8925 = 27.1075  → ALTO  (just above 27)
// ---------------------------------------------------------------------------

describe('getThomsDiscomfortIndex', () => {
  it('temp=20 humidity=50 → DI≈18.49 → BIEN, .value holds the numeric DI', () => {
    // DI = 20 - 0.55 * 0.5 * 5.5 = 18.4875
    const result = getThomsDiscomfortIndex(20, 50, 'es');
    expect(result.shortLabel).toBe('BIEN');
    expect(result.value).toBeCloseTo(18.4875, 5);
  });

  // --- BIEN / LEVE boundary (DI = 21) ---

  it('temp=25 humidity=30 → DI≈20.96 (just below 21) → BIEN', () => {
    // DI = 25 - 0.55 * 0.70 * 10.5 = 25 - 4.0425 = 20.9575
    const result = getThomsDiscomfortIndex(25, 30, 'es');
    expect(result.shortLabel).toBe('BIEN');
    expect(result.value).toBeCloseTo(20.9575, 4);
  });

  it('temp=25 humidity=31 → DI≈21.02 (just above 21) → LEVE', () => {
    // DI = 25 - 0.55 * 0.69 * 10.5 = 25 - 3.98475 = 21.01525
    const result = getThomsDiscomfortIndex(25, 31, 'es');
    expect(result.shortLabel).toBe('LEVE');
    expect(result.value).toBeCloseTo(21.01525, 4);
  });

  // --- LEVE / MOD boundary (DI = 24) ---

  it('temp=30 humidity=29 → DI≈23.95 (just below 24) → LEVE', () => {
    // DI = 30 - 0.55 * 0.71 * 15.5 = 30 - 6.05275 = 23.94725
    const result = getThomsDiscomfortIndex(30, 29, 'es');
    expect(result.shortLabel).toBe('LEVE');
    expect(result.value).toBeCloseTo(23.947, 2);
  });

  it('temp=30 humidity=30 → DI≈24.03 (just above 24) → MOD', () => {
    // DI = 30 - 0.55 * 0.70 * 15.5 = 30 - 5.9675 = 24.0325
    const result = getThomsDiscomfortIndex(30, 30, 'es');
    expect(result.shortLabel).toBe('MOD');
    expect(result.value).toBeCloseTo(24.0325, 4);
  });

  // --- MOD / ALTO boundary (DI = 27) ---

  it('temp=35 humidity=29 → DI≈26.99 (just below 27) → MOD', () => {
    // DI = 35 - 0.55 * 0.71 * 20.5 = 35 - 8.00525 = 26.99475
    const result = getThomsDiscomfortIndex(35, 29, 'es');
    expect(result.shortLabel).toBe('MOD');
    expect(result.value).toBeCloseTo(26.9948, 3);
  });

  it('temp=35 humidity=30 → DI≈27.11 (just above 27) → ALTO', () => {
    // DI = 35 - 0.55 * 0.70 * 20.5 = 35 - 7.8925 = 27.1075
    const result = getThomsDiscomfortIndex(35, 30, 'es');
    expect(result.shortLabel).toBe('ALTO');
    expect(result.value).toBeCloseTo(27.1075, 4);
  });
});
