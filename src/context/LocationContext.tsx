import { createContext, useContext, useState, type ReactNode } from 'react';
import type { Location } from '../types/weather';
import { PREDEFINED_LOCATIONS } from '../constants/locations';

interface LocationContextType {
  currentLocation: Location;
  setCurrentLocation: (location: Location) => void;
  customLocations: Location[];
  addCustomLocation: (location: Location) => void;
  deleteCustomLocation: (id: string) => void;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

function loadCustomLocations(): Location[] {
  try {
    const stored = localStorage.getItem('custom_locations');
    if (stored) return JSON.parse(stored);
  } catch {
    // ignore
  }
  return [];
}

function saveCustomLocations(locations: Location[]) {
  try {
    localStorage.setItem('custom_locations', JSON.stringify(locations));
  } catch {
    // ignore
  }
}

export function LocationProvider({ children }: { children: ReactNode }) {
  const [currentLocation, setCurrentLocationState] = useState<Location>(() => {
    try {
      const stored = localStorage.getItem('last_location');
      if (stored) return JSON.parse(stored);
    } catch {
      // ignore
    }
    return PREDEFINED_LOCATIONS[1];
  });

  const [customLocations, setCustomLocations] = useState<Location[]>(loadCustomLocations);

  const setCurrentLocation = (location: Location) => {
    setCurrentLocationState(location);
    try {
      localStorage.setItem('last_location', JSON.stringify(location));
    } catch {
      // ignore
    }
  };

  const addCustomLocation = (location: Location) => {
    setCustomLocations(prev => {
      if (prev.some(l => l.id === location.id)) return prev;
      const next = [...prev, location];
      saveCustomLocations(next);
      return next;
    });
  };

  const deleteCustomLocation = (id: string) => {
    setCustomLocations(prev => {
      const next = prev.filter(l => l.id !== id);
      saveCustomLocations(next);
      return next;
    });
    // If deleting the active location, fall back to default
    if (currentLocation.id === id) {
      setCurrentLocation(PREDEFINED_LOCATIONS[1]);
    }
  };

  return (
    <LocationContext.Provider value={{ currentLocation, setCurrentLocation, customLocations, addCustomLocation, deleteCustomLocation }}>
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
