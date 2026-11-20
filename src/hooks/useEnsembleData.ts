import { useState, useEffect } from 'react';
import {
  ENSEMBLE_DAYS,
  parseEnsembleResponse,
  toWeekPoints,
  type EnsemblePoint,
  type EnsembleVar,
  type RawEnsemble,
} from '../utils/ensembleStats';
import { isAbortError } from '../utils/fetchUtils';

const ENSEMBLE_URL = 'https://ensemble-api.open-meteo.com/v1/ensemble';
const CACHE_TTL = 24 * 60 * 60 * 1000;

// Session-level cache (all 15 days per variable)
const sessionCache = new Map<string, RawEnsemble>();

function storageKey(lat: number, lon: number, variable: EnsembleVar): string {
  return `ensemble_cache_v2_${lat}_${lon}_${variable}`;
}

async function fetchAll(
  lat: number,
  lon: number,
  variable: EnsembleVar,
  signal: AbortSignal,
): Promise<RawEnsemble> {
  // ecmwf_ifs025: 50 perturbed members + control at 0.25° — closest to the EC46 seasonal ensemble
  const url = `${ENSEMBLE_URL}?latitude=${lat}&longitude=${lon}&hourly=${variable}&models=ecmwf_ifs025&forecast_days=${ENSEMBLE_DAYS}&timezone=UTC`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Ensemble API ${res.status}`);
  return parseEnsembleResponse(await res.json(), variable);
}

function readStorage(key: string): RawEnsemble | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const cached = JSON.parse(raw) as { timestamp: number } & RawEnsemble;
    if (Date.now() - cached.timestamp >= CACHE_TTL) return null;
    if (!Array.isArray(cached.times) || !Array.isArray(cached.members)) return null;
    return { times: cached.times, members: cached.members };
  } catch {
    return null; // corrupt
  }
}

export function useEnsembleData(
  lat: number,
  lon: number,
  weekStart: string,
  variable: EnsembleVar,
  timeZone?: string,
) {
  const [data, setData] = useState<EnsemblePoint[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Switching variable (or closing the dialog) cancels the request still in flight
    const controller = new AbortController();
    // oxlint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError(null);

    const key = storageKey(lat, lon, variable);
    const done = (raw: RawEnsemble) => {
      if (controller.signal.aborted) return;
      setData(toWeekPoints(raw, weekStart, variable, timeZone));
      setLoading(false);
    };

    // eslint-disable-next-line sonarjs/cognitive-complexity
    async function load() {
      const cached = sessionCache.get(key) ?? readStorage(key);
      if (cached) {
        sessionCache.set(key, cached);
        done(cached);
        return;
      }
      try {
        const all = await fetchAll(lat, lon, variable, controller.signal);
        sessionCache.set(key, all);
        try {
          localStorage.setItem(key, JSON.stringify({ timestamp: Date.now(), ...all }));
        } catch {
          /* storage full */
        }
        done(all);
      } catch (err) {
        if (isAbortError(err) || controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      }
    }

    void load();
    return () => controller.abort();
  }, [lat, lon, weekStart, variable, timeZone]);

  return { data, loading, error };
}
