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

export function getThomsDiscomfortIndex(temp: number, humidity: number) {
  const di = temp - 0.55 * (1 - humidity / 100) * (temp - 14.5);
  
  if (di < 21) return { value: di, shortLabel: 'BIEN', label: 'Bienestar (Sin estrés)', bgClass: 'bg-emerald-500' };
  if (di < 24) return { value: di, shortLabel: 'LEVE', label: 'Fatiga Leve', bgClass: 'bg-yellow-400' };
  if (di < 27) return { value: di, shortLabel: 'MOD', label: 'Fatiga Moderada', bgClass: 'bg-orange-500' };
  return { value: di, shortLabel: 'ALTO', label: 'Estrés Severo (Riesgo alto)', bgClass: 'bg-red-600 text-white' };
}

export function getPressureDeltaAlert(deltaP: number) {
  if (deltaP <= -5) return { label: 'RIESGO', detail: `${deltaP} hPa`, bgClass: 'bg-red-600 text-white' };
  if (deltaP <= -3) return { label: 'BAJA', detail: `${deltaP} hPa`, bgClass: 'bg-orange-400 text-slate-900' };
  if (deltaP >= 5) return { label: 'SUBE', detail: `+${deltaP} hPa`, bgClass: 'bg-sky-500 text-white' };
  const sign = deltaP > 0 ? '+' : '';
  return { label: 'ESTABLE', detail: `${sign}${deltaP} hPa`, bgClass: 'bg-slate-700 text-slate-300' };
}

export function getMigraineRisk(deltaP: number, pressure: number, humidity: number, precip: number) {
  let riskScore = 0;
  const reasons: string[] = [];
  
  // 1. Barometric pressure changes (significant decrease)
  if (deltaP <= -5) {
    riskScore += 3;
    reasons.push(`Caída de presión severa (${deltaP} hPa) [+3 pts]`);
  } else if (deltaP <= -3) {
    riskScore += 1;
    reasons.push(`Caída de presión moderada (${deltaP} hPa) [+1 pt]`);
  }

  // 2. Lower absolute barometric pressure
  if (pressure < 1010) {
    riskScore += 1;
    reasons.push(`Baja presión absoluta (${Math.round(pressure)} hPa) [+1 pt]`);
  }

  // 3. Higher humidity
  if (humidity > 70) {
    riskScore += 1;
    reasons.push(`Alta humedad relativa (${Math.round(humidity)}%) [+1 pt]`);
  }

  // 4. Increased rainfall
  if (precip > 0) {
    riskScore += 1;
    reasons.push(`Precipitaciones activas (${precip} mm) [+1 pt]`);
  }

  if (reasons.length === 0) {
    reasons.push(`Estabilidad atmosférica total [0 pts]`);
  }

  if (riskScore >= 5) return { label: 'EXTREMO', detail: 'Patrón clínico de alto riesgo', bgClass: 'bg-purple-600 text-white', reasons, score: riskScore };
  if (riskScore >= 3) return { label: 'ALTO', detail: 'Condiciones atmosféricas propicias', bgClass: 'bg-red-600 text-white', reasons, score: riskScore };
  if (riskScore >= 2) return { label: 'MOD', detail: 'Riesgo moderado', bgClass: 'bg-orange-500 text-white', reasons, score: riskScore };
  if (riskScore === 1) return { label: 'BAJO', detail: 'Riesgo leve', bgClass: 'bg-yellow-400 text-slate-900', reasons, score: riskScore };
  return { label: 'MÍNIMO', detail: 'Clima estable (Sin riesgo)', bgClass: 'bg-emerald-500 text-slate-900', reasons, score: riskScore };
}
