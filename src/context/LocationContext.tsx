import { createContext, useContext, useState, type ReactNode } from 'react';
import type { Location } from '../types/weather';

export const PREDEFINED_LOCATIONS: Location[] = [
  { id: 'gps', name: 'Actual (GPS)', latitude: 0, longitude: 0, isGPS: true },
  { id: 'basel', name: 'Basilea', latitude: 47.5546368, longitude: 7.5532081 },
  { id: 'parla', name: 'Parla', latitude: 40.2348316, longitude: -3.7876793 },
  { id: 'barcelona', name: 'Barcelona', latitude: 41.385063, longitude: 2.173404 },
  { id: 'lagartera', name: 'Lagartera', latitude: 39.9071497, longitude: -5.2106728 },
  { id: 'corral', name: 'Corral de Almaguer', latitude: 39.7608446, longitude: -3.1667764 },
  { id: 'reykjavik', name: 'Reikiavik', latitude: 64.1261865, longitude: -21.9350214 },
  { id: 'santo_domingo', name: 'Santo Domingo', latitude: 18.4801874, longitude: -70.0292817 },
  { id: 'auckland', name: 'Auckland', latitude: -36.8318297, longitude: 174.3969279 },
  { id: 'taipei', name: 'Taipéi', latitude: 25.0174467, longitude: 121.3415663 },
  { id: 'torrevieja', name: 'Torrevieja', latitude: 37.9787, longitude: -0.6822 },
  { id: 'santiago', name: 'Santiago de Compostela', latitude: 42.8805, longitude: -8.5457 },
];

interface LocationContextType {
  currentLocation: Location;
  setCurrentLocation: (location: Location) => void;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export function LocationProvider({ children }: { children: ReactNode }) {
  const [currentLocation, setCurrentLocationState] = useState<Location>(() => {
    try {
      const stored = localStorage.getItem('last_location');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error('Failed to parse stored location:', e);
    }
    return PREDEFINED_LOCATIONS[1]; // Default to Basel
  });

  const setCurrentLocation = (location: Location) => {
    setCurrentLocationState(location);
    try {
      localStorage.setItem('last_location', JSON.stringify(location));
    } catch (e) {
      console.error('Failed to save location to localStorage:', e);
    }
  };

  return (
    <LocationContext.Provider value={{ currentLocation, setCurrentLocation }}>
      {children}
    </LocationContext.Provider>
  );
}

export function useLocationContext() {
  const context = useContext(LocationContext);
  if (context === undefined) {
    throw new Error('useLocationContext must be used within a LocationProvider');
  }
  return context;
}
