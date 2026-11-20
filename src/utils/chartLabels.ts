// Rain amount labels above the forecast chart's bars.

/** Amounts below this are not labelled (dry or trace). */
export const PRECIP_LABEL_MIN_MM = 0.1;

export function formatPrecipMm(mm: number): string {
  return mm < 10 ? mm.toFixed(1) : String(Math.round(mm));
}

/**
 * One label string per bar ('' = no label). With `radius` 0 every wet bar is labelled; with
 * `radius` r a bar is labelled only if it is the largest within ±r bars (ties go to the earliest),
 * so labels are at least r + 1 bars apart and never overlap on narrow hourly bars.
 */
export function precipLabels(values: readonly number[], radius = 0): string[] {
  return values.map((mm, i) =>
    mm >= PRECIP_LABEL_MIN_MM && isPeak(values, i, radius) ? formatPrecipMm(mm) : '',
  );
}

// Largest within ±radius; an equal value earlier in the window wins the tie
function isPeak(values: readonly number[], i: number, radius: number): boolean {
  const lo = Math.max(0, i - radius);
  const window = values.slice(lo, i + radius + 1);
  return window.every((other, k) => (lo + k < i ? other < values[i] : other <= values[i]));
}
