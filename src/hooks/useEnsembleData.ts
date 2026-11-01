import { useState, useEffect } from 'react';
import { computeStats, type EnsemblePoint, type EnsembleVar } from '../utils/ensembleStats';

const ENSEMBLE_URL = 'https://ensemble-api.open-meteo.com/v1/ensemble';
const CACHE_TTL = 24 * 60 * 60 * 1000;

// Session-level cache (covers all 14 days per variable)
const sessionCache = new Map<string, EnsemblePoint[]>();

function storageKey(lat: number, lon: number, variable: EnsembleVar): string {
  return `ensemble_cache_${lat}_${lon}_${variable}`;
}

async function fetchAll(lat: number, lon: number, variable: EnsembleVar): Promise<EnsemblePoint[]> {
  // ecmwf_ifs025: 50 ECMWF IFS members at 0.25° — closest to the EC46 seasonal ensemble
  const url = `${ENSEMBLE_URL}?latitude=${lat}&longitude=${lon}&hourly=${variable}&models=ecmwf_ifs025&forecast_days=14&timezone=UTC`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Ensemble API ${res.status}`);
  const json = await res.json();

  const times: string[] = json.hourly?.time ?? [];
  // Auto-detect member keys from response (avoids hardcoded count)
  const memberKeys: string[] = Object.keys(json.hourly ?? {}).filter(k => k.startsWith(`${variable}_member`));

  return times.map((timeStr, i) => {
    const members = memberKeys
      .map(k => json.hourly[k]?.[i])
      .filter((v): v is number => typeof v === 'number' && isFinite(v));
    const stats = computeStats(members.length ? members : [0]);
    return { time: Date.parse(`${timeStr}Z`), ...stats, members };
  });
}

function filterToWeek(points: EnsemblePoint[], weekStart: string): EnsemblePoint[] {
  const startMs = Date.parse(`${weekStart}T00:00:00Z`);
  const endMs = startMs + 7 * 24 * 60 * 60 * 1000;
  return points.filter(p => p.time >= startMs && p.time < endMs);
}

export function useEnsembleData(lat: number, lon: number, weekStart: string, variable: EnsembleVar) {
  const [data, setData] = useState<EnsemblePoint[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const key = storageKey(lat, lon, variable);

    async function load() {
      // Check localStorage first (24 h TTL)
      try {
        const raw = localStorage.getItem(key);
        if (raw) {
          const cached = JSON.parse(raw) as { timestamp: number; data: EnsemblePoint[] };
          if (Date.now() - cached.timestamp < CACHE_TTL) {
            if (!cancelled) {
              setData(filterToWeek(cached.data, weekStart));
              setLoading(false);
            }
            return;
          }
        }
      } catch { /* corrupt, fall through */ }

      // Check session cache
      const session = sessionCache.get(key);
      if (session) {
        if (!cancelled) {
          setData(filterToWeek(session, weekStart));
          setLoading(false);
        }
        return;
      }

      // Fetch all 14 days
      try {
        const all = await fetchAll(lat, lon, variable);
        sessionCache.set(key, all);
        try {
          localStorage.setItem(key, JSON.stringify({ timestamp: Date.now(), data: all }));
        } catch { /* storage full */ }
        if (!cancelled) {
          setData(filterToWeek(all, weekStart));
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          setLoading(false);
        }
      }
    }

    load();
    return () => { cancelled = true; };
  }, [lat, lon, weekStart, variable]);

  return { data, loading, error };
}
