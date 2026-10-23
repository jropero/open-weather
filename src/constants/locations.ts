import type { Location } from '../types/weather';

export const PREDEFINED_LOCATIONS: Location[] = [
  { id: 'gps', name: 'Actual (GPS)', latitude: 0, longitude: 0, isGPS: true },
  { id: 'basel', name: 'Basilea', latitude: 47.5546368, longitude: 7.5532081, timezone: 'Europe/Zurich' },
  { id: 'parla', name: 'Parla', latitude: 40.2348316, longitude: -3.7876793, timezone: 'Europe/Madrid' },
  { id: 'madrid', name: 'Madrid', latitude: 40.4168, longitude: -3.7038, timezone: 'Europe/Madrid' },
  { id: 'barcelona', name: 'Barcelona', latitude: 41.385063, longitude: 2.173404, timezone: 'Europe/Madrid' },
  { id: 'lagartera', name: 'Lagartera', latitude: 39.9071497, longitude: -5.2106728, timezone: 'Europe/Madrid' },
  { id: 'corral', name: 'Corral de Almaguer', latitude: 39.7608446, longitude: -3.1667764, timezone: 'Europe/Madrid' },
  { id: 'reykjavik', name: 'Reikiavik', latitude: 64.1261865, longitude: -21.9350214, timezone: 'Atlantic/Reykjavik' },
  { id: 'santo_domingo', name: 'Santo Domingo', latitude: 18.4801874, longitude: -70.0292817, timezone: 'America/Santo_Domingo' },
  { id: 'auckland', name: 'Auckland', latitude: -36.8318297, longitude: 174.3969279, timezone: 'Pacific/Auckland' },
  { id: 'taipei', name: 'Taipéi', latitude: 25.0174467, longitude: 121.3415663, timezone: 'Asia/Taipei' },
  { id: 'torrevieja', name: 'Torrevieja', latitude: 37.9787, longitude: -0.6822, timezone: 'Europe/Madrid' },
  { id: 'santiago', name: 'Santiago de Compostela', latitude: 42.8805, longitude: -8.5457, timezone: 'Europe/Madrid' },
];
