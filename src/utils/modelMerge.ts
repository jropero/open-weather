type DailyRecord = Record<string, unknown[]>;

function fold(a: unknown[], b: unknown[] | undefined): unknown[] {
  return a.map((v, i) => v ?? b?.[i] ?? null);
}

/**
 * Open-Meteo returns every variable once per model (`pressure_msl_mean_meteoswiss_icon_ch2`,
 * `pressure_msl_mean_best_match`, …) when several models are requested. This folds them back into
 * plain keys: value[i] = primary[i] ?? fallback[i] (null never becomes 0). Unsuffixed keys (`time`)
 * pass through; a response without suffixed keys is returned unchanged.
 */
export function mergeModelDaily(
  daily: DailyRecord,
  primary = 'meteoswiss_icon_ch2',
  fallback = 'best_match',
): DailyRecord {
  const pSuffix = `_${primary}`;
  const fSuffix = `_${fallback}`;
  const keys = Object.keys(daily);
  const suffixed = keys.filter((k) => k.endsWith(pSuffix) || k.endsWith(fSuffix));
  if (suffixed.length === 0) return daily;

  const out: DailyRecord = {};
  for (const key of keys) if (!suffixed.includes(key)) out[key] = daily[key];
  const bases = new Set(
    suffixed.map((k) => k.slice(0, -(k.endsWith(pSuffix) ? pSuffix : fSuffix).length)),
  );
  for (const base of bases) {
    out[base] = fold(daily[base + pSuffix] ?? daily[base + fSuffix], daily[base + fSuffix]);
  }
  return out;
}
