import { GUST_THRESHOLDS } from './weatherCodes';

/** 8-point compass index (0 = N … 7 = NW) for a wind direction in degrees. */
export function compassIndex(degrees: number): number {
  return Math.round((((degrees % 360) + 360) % 360) / 45) % 8;
}

/** UV line is shown only when the rounded index is at least 1 (hidden at night). */
export function uvShown(uv: number | null | undefined): uv is number {
  return uv != null && Number.isFinite(uv) && Math.round(uv) > 0;
}

/** Colour of the UV item on the dark hero (same bands as getUvInfo). */
export function uvHeroColor(uv: number): string {
  if (uv < 3) return 'text-emerald-300';
  if (uv < 6) return 'text-yellow-300';
  if (uv < 8) return 'text-orange-300';
  if (uv < 11) return 'text-red-300';
  return 'text-purple-300';
}

/** 0–4 level index of the migraine score (minimal, low, moderate, high, extreme) for `migr.level.N`. */
export function migraineLevelIndex(score: number): number {
  if (score >= 6) return 4;
  if (score >= 4) return 3;
  if (score >= 3) return 2;
  return score >= 2 ? 1 : 0;
}

/** Gusts are appended to the wind item from the breezy threshold up. */
export function showGusts(gusts: number | null | undefined): gusts is number {
  return gusts != null && Number.isFinite(gusts) && gusts >= GUST_THRESHOLDS.breezy;
}

/** Rounded today's high/low, or null when either is missing/non-finite. */
export function roundHighLow(
  max: number | null | undefined,
  min: number | null | undefined,
): { max: number; min: number } | null {
  if (max == null || min == null || !Number.isFinite(max) || !Number.isFinite(min)) return null;
  return { max: Math.round(max) + 0, min: Math.round(min) + 0 };
}
