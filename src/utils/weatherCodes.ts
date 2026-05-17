import {
  Sun,
  Cloud,
  CloudRain,
  CloudLightning,
  CloudSnow,
  CloudFog,
  CloudDrizzle,
} from 'lucide-react';

export function getWeatherInfo(code: number) {
  // WMO Weather interpretation codes
  if (code === 0) return { label: 'Despejado', icon: Sun };
  if (code === 1 || code === 2 || code === 3) return { label: 'Nublado', icon: Cloud };
  if (code === 45 || code === 48) return { label: 'Niebla', icon: CloudFog };
  if (code === 51 || code === 53 || code === 55 || code === 56 || code === 57) return { label: 'Llovizna', icon: CloudDrizzle };
  if (code === 61 || code === 63 || code === 65 || code === 66 || code === 67) return { label: 'Lluvia', icon: CloudRain };
  if (code === 71 || code === 73 || code === 75 || code === 77 || code === 85 || code === 86) return { label: 'Nieve', icon: CloudSnow };
  if (code === 80 || code === 81 || code === 82) return { label: 'Chubascos', icon: CloudRain };
  if (code === 95 || code === 96 || code === 99) return { label: 'Tormenta', icon: CloudLightning };
  
  return { label: 'Desconocido', icon: Sun };
}

export function getPressureDescription(pressure: number) {
  if (pressure > 1022) return 'Alta (Anticiclón)';
  if (pressure < 1000) return 'Baja (Borrasca)';
  return 'Normal';
}

export function getPressureColor(pressure: number) {
  if (pressure <= 985) return 'bg-indigo-600 text-white'; // Borrasca profunda
  if (pressure <= 1000) return 'bg-blue-500 text-white';  // Borrasca
  if (pressure <= 1013) return 'bg-emerald-400 text-gray-900'; // Presión normal
  if (pressure <= 1022) return 'bg-yellow-400 text-gray-900'; // Anticiclón moderado
  return 'bg-orange-500 text-white'; // Anticiclón fuerte
}
