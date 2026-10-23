import { useState, useEffect } from 'react';
import type { Location } from '../types/weather';

interface GeoResult {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  timezone: string;
  country: string;
  admin1?: string;
}

interface UseGeoSearchResult {
  results: Location[];
  loading: boolean;
  error: string | null;
}

export function useGeoSearch(query: string): UseGeoSearchResult {
  const [results, setResults] = useState<Location[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults([]);
      setLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=es&format=json`;
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) throw new Error('Error en la búsqueda');
        const data = await res.json();
        const locations: Location[] = (data.results ?? []).map((r: GeoResult) => ({
          id: `custom_${r.latitude}_${r.longitude}`,
          name: r.admin1 ? `${r.name}, ${r.admin1}` : `${r.name}, ${r.country}`,
          latitude: r.latitude,
          longitude: r.longitude,
          timezone: r.timezone,
        }));
        setResults(locations);
      } catch (e) {
        if ((e as Error).name !== 'AbortError') {
          setError('No se pudo buscar la ubicación.');
        }
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  return { results, loading, error };
}
