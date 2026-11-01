export type EnsembleVar = 'temperature_2m' | 'precipitation' | 'pressure_msl' | 'wind_speed_10m';

export interface EnsemblePoint {
  time: number; // ms UTC
  mean: number;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  members: number[];
}

export type SpreadLabel = 'agree' | 'disagree' | 'bimodal';

export interface SpreadClassification {
  label: SpreadLabel;
}

function sortedPercentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

export function computeStats(members: number[]) {
  if (!members.length) return { mean: 0, p10: 0, p25: 0, p50: 0, p75: 0, p90: 0 };
  const sorted = [...members].sort((a, b) => a - b);
  const mean = members.reduce((a, b) => a + b, 0) / members.length;
  return {
    mean,
    p10: sortedPercentile(sorted, 10),
    p25: sortedPercentile(sorted, 25),
    p50: sortedPercentile(sorted, 50),
    p75: sortedPercentile(sorted, 75),
    p90: sortedPercentile(sorted, 90),
  };
}

// Detect bimodality: significant gap in the central portion of the sorted distribution
function isBimodal(members: number[]): boolean {
  const sorted = [...members].sort((a, b) => a - b);
  const n = sorted.length;
  if (n < 4) return false;
  const totalRange = sorted[n - 1] - sorted[0];
  if (totalRange < 0.01) return false;
  const lo = Math.floor(n * 0.30);
  const hi = Math.ceil(n * 0.70);
  let maxGap = 0;
  for (let i = lo; i < hi - 1; i++) {
    maxGap = Math.max(maxGap, sorted[i + 1] - sorted[i]);
  }
  return maxGap > totalRange * 0.30;
}

// p90-p10 spread threshold to classify as "wide"
const WIDE_THRESHOLD: Record<EnsembleVar, number> = {
  temperature_2m: 4,   // °C
  precipitation: 3,    // mm
  pressure_msl: 5,     // hPa
  wind_speed_10m: 20,  // km/h
};

export function classifySpread(points: EnsemblePoint[], variable: EnsembleVar): SpreadClassification {
  if (!points.length) return { label: 'agree' };
  let peakIdx = 0;
  let maxSpread = -Infinity;
  for (let i = 0; i < points.length; i++) {
    const spread = points[i].p90 - points[i].p10;
    if (spread > maxSpread) { maxSpread = spread; peakIdx = i; }
  }
  if (isBimodal(points[peakIdx].members)) return { label: 'bimodal' };
  if (maxSpread > WIDE_THRESHOLD[variable]) return { label: 'disagree' };
  return { label: 'agree' };
}
