import { useState } from 'react';
import type { Location } from '../types/weather';

export function useGeolocation() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getCurrentPosition = (): Promise<Location> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        setError('Geolocalización no soportada');
        reject(new Error('Geolocalización no soportada'));
        return;
      }

      setLoading(true);
      setError(null);

      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLoading(false);
          resolve({
            id: 'gps-current',
            name: 'Ubicación Actual',
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            isGPS: true
          });
        },
        (err) => {
          setLoading(false);
          setError(err.message);
          reject(err);
        }
      );
    });
  };

  return { getCurrentPosition, loading, error };
}
