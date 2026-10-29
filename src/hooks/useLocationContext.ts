import { createContext, useContext } from 'react';
import type { Location } from '../types/weather';

export interface LocationContextType {
  currentLocation: Location;
  setCurrentLocation: (location: Location) => void;
  customLocations: Location[];
  addCustomLocation: (location: Location) => void;
  deleteCustomLocation: (id: string) => void;
}

// Kept apart from LocationProvider so the provider file only exports components (React Fast Refresh)
export const LocationContext = createContext<LocationContextType | undefined>(undefined);

export function useLocationContext() {
  const context = useContext(LocationContext);
  if (context === undefined) {
    throw new Error('useLocationContext must be used within a LocationProvider');
  }
  return context;
}
