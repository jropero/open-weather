import { createContext, useContext, useState, type ReactNode } from 'react';
import type { Location } from '../types/weather';
import { PREDEFINED_LOCATIONS } from '../constants/locations';

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
