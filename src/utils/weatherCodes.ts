import {
  Sun,
  Cloud,
  CloudRain,
  CloudLightning,
  CloudSnow,
  CloudFog,
  CloudDrizzle,
} from 'lucide-react';
import type { Language } from '../context/LanguageContext';

export function getWeatherInfo(code: number, lang: Language = 'es') {
  const isEn = lang === 'en';
  
  // WMO Weather interpretation codes
  if (code === 0) return { label: isEn ? 'Clear' : 'Despejado', icon: Sun, color: 'text-amber-300 fill-amber-300', colorDark: 'text-amber-500 fill-amber-500', animation: 'animate-sun', bgClass: 'from-sky-500 via-sky-400 to-blue-300' };
  if (code === 1 || code === 2 || code === 3) return { label: isEn ? 'Cloudy' : 'Nublado', icon: Cloud, color: 'text-slate-300 fill-slate-300 opacity-90', colorDark: 'text-slate-400 fill-slate-400', animation: 'animate-cloud', bgClass: 'from-slate-500 via-slate-400 to-zinc-400' };
  if (code === 45 || code === 48) return { label: isEn ? 'Fog' : 'Niebla', icon: CloudFog, color: 'text-zinc-300 fill-zinc-300 opacity-80', colorDark: 'text-zinc-400 fill-zinc-400', animation: 'animate-cloud', bgClass: 'from-zinc-500 via-slate-400 to-slate-300' };
  if (code === 51 || code === 53 || code === 55 || code === 56 || code === 57) return { label: isEn ? 'Drizzle' : 'Llovizna', icon: CloudDrizzle, color: 'text-sky-300 fill-sky-300', colorDark: 'text-sky-500 fill-sky-500', animation: 'animate-rain', bgClass: 'from-blue-600 via-sky-500 to-sky-300' };
  if (code === 61 || code === 63 || code === 65 || code === 66 || code === 67) return { label: isEn ? 'Rain' : 'Lluvia', icon: CloudRain, color: 'text-blue-300 fill-blue-300', colorDark: 'text-blue-500 fill-blue-500', animation: 'animate-rain', bgClass: 'from-indigo-950 via-blue-900 to-slate-700' };
  if (code === 71 || code === 73 || code === 75 || code === 77 || code === 85 || code === 86) return { label: isEn ? 'Snow' : 'Nieve', icon: CloudSnow, color: 'text-cyan-100 fill-cyan-100', colorDark: 'text-cyan-600 fill-cyan-600', animation: 'animate-cloud', bgClass: 'from-cyan-950 via-slate-800 to-slate-600' };
  if (code === 80 || code === 81 || code === 82) return { label: isEn ? 'Rain Showers' : 'Chubascos', icon: CloudRain, color: 'text-blue-400 fill-blue-400', colorDark: 'text-blue-600 fill-blue-600', animation: 'animate-rain', bgClass: 'from-slate-900 via-slate-800 to-blue-900' };
  if (code === 95 || code === 96 || code === 99) return { label: isEn ? 'Thunderstorm' : 'Tormenta', icon: CloudLightning, color: 'text-purple-300 fill-purple-300', colorDark: 'text-purple-500 fill-purple-500', animation: 'animate-storm', bgClass: 'from-slate-950 via-purple-950 to-slate-900' };
  
  return { label: isEn ? 'Unknown' : 'Desconocido', icon: Sun, color: 'text-amber-300 fill-amber-300', colorDark: 'text-amber-500 fill-amber-500', animation: 'animate-sun', bgClass: 'from-sky-500 via-sky-400 to-blue-300' };
}

export function getPressureDescription(pressure: number, lang: Language = 'es') {
  const isEn = lang === 'en';
  if (pressure > 1022) return isEn ? 'High (Anticyclone)' : 'Alta (Anticiclón)';
  if (pressure < 1000) return isEn ? 'Low (Storm)' : 'Baja (Borrasca)';
  return isEn ? 'Normal' : 'Normal';
}

export function getPressureColor(pressure: number) {
  if (pressure <= 985) return 'bg-indigo-600 text-white'; // Borrasca profunda
  if (pressure <= 1000) return 'bg-blue-500 text-white';  // Borrasca
  if (pressure <= 1013) return 'bg-emerald-400 text-gray-900'; // Presión normal
  if (pressure <= 1022) return 'bg-yellow-400 text-gray-900'; // Anticiclón moderado
  return 'bg-orange-500 text-white'; // Anticiclón fuerte
}

export function getThomsDiscomfortIndex(temp: number, humidity: number, lang: Language = 'es') {
  const di = temp - 0.55 * (1 - humidity / 100) * (temp - 14.5);
  const isEn = lang === 'en';
  
  const reasons = isEn ? [
    `Formula: T - 0.55 * (1 - RH/100) * (T - 14.5)`,
    `Values: T = ${Math.round(temp)}°C, RH = ${Math.round(humidity)}%`,
    `Result: ${di.toFixed(1)} (Discomfort Index)`
  ] : [
    `Fórmula: T - 0.55 * (1 - HR/100) * (T - 14.5)`,
    `Valores: T = ${Math.round(temp)}°C, HR = ${Math.round(humidity)}%`,
    `Resultado: ${di.toFixed(1)} (Índice de Incomodidad)`
  ];
  
  if (di < 21) return { value: di, shortLabel: isEn ? 'GOOD' : 'BIEN', label: isEn ? 'Well-being (No stress)' : 'Bienestar (Sin estrés)', bgClass: 'bg-emerald-500', reasons };
  if (di < 24) return { value: di, shortLabel: isEn ? 'MILD' : 'LEVE', label: isEn ? 'Mild Fatigue' : 'Fatiga Leve', bgClass: 'bg-yellow-400', reasons };
  if (di < 27) return { value: di, shortLabel: 'MOD', label: isEn ? 'Moderate Fatigue' : 'Fatiga Moderada', bgClass: 'bg-orange-500', reasons };
  return { value: di, shortLabel: isEn ? 'HIGH' : 'ALTO', label: isEn ? 'Severe Stress (High risk)' : 'Estrés Severo (Riesgo alto)', bgClass: 'bg-red-600 text-white', reasons };
}

export function getPressureDeltaAlert(deltaP: number, lang: Language = 'es') {
  const isEn = lang === 'en';
  if (deltaP <= -5) return { label: isEn ? 'RISK' : 'RIESGO', detail: `${deltaP} hPa`, bgClass: 'bg-red-600 text-white' };
  if (deltaP <= -3) return { label: isEn ? 'DROPS' : 'BAJA', detail: `${deltaP} hPa`, bgClass: 'bg-orange-400 text-slate-900' };
  if (deltaP >= 5) return { label: isEn ? 'RISES' : 'SUBE', detail: `+${deltaP} hPa`, bgClass: 'bg-sky-700 text-white' };
  const sign = deltaP > 0 ? '+' : '';
  return { label: isEn ? 'STABLE' : 'ESTABLE', detail: `${sign}${deltaP} hPa`, bgClass: 'bg-slate-700 text-slate-300' };
}

export function getWindDirection(degrees: number, lang: Language = 'es') {
  const isEn = lang === 'en';
  const dirs = isEn
    ? ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
    : ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
  return dirs[Math.round(degrees / 45) % 8];
}

export function getWindChillIndex(temp: number, windSpeed: number, lang: Language = 'es') {
  const isEn = lang === 'en';
  let wci: number;
  if (temp <= 10 && windSpeed > 4.8) {
    wci = 13.12 + 0.6215 * temp - 11.37 * Math.pow(windSpeed, 0.16) + 0.3965 * temp * Math.pow(windSpeed, 0.16);
    wci = Math.round(wci * 10) / 10;
  } else {
    wci = Math.round(temp * 10) / 10;
  }

  const reasons = isEn ? [
    `Formula: 13.12 + 0.6215·T − 11.37·V^0.16 + 0.3965·T·V^0.16`,
    `Values: T = ${Math.round(temp)}°C, V = ${Math.round(windSpeed)} km/h`,
    `Feels like: ${wci.toFixed(1)}°C`,
  ] : [
    `Fórmula: 13.12 + 0.6215·T − 11.37·V^0.16 + 0.3965·T·V^0.16`,
    `Valores: T = ${Math.round(temp)}°C, V = ${Math.round(windSpeed)} km/h`,
    `Sensación: ${wci.toFixed(1)}°C`,
  ];

  if (wci > 0) return { value: wci, shortLabel: isEn ? 'COOL' : 'FRESC', label: isEn ? 'Cool' : 'Fresco', bgClass: 'bg-sky-400', reasons };
  if (wci > -10) return { value: wci, shortLabel: isEn ? 'COLD' : 'FRÍO', label: isEn ? 'Cold' : 'Frío', bgClass: 'bg-blue-500', reasons };
  if (wci > -25) return { value: wci, shortLabel: isEn ? 'V.CLD' : 'MUY', label: isEn ? 'Very Cold' : 'Muy Frío', bgClass: 'bg-indigo-600 text-white', reasons };
  if (wci > -40) return { value: wci, shortLabel: isEn ? 'SEV' : 'SEV', label: isEn ? 'Severe Cold' : 'Frío Severo', bgClass: 'bg-purple-700 text-white', reasons };
  return { value: wci, shortLabel: 'EXT', label: isEn ? 'Extreme Cold' : 'Extremo', bgClass: 'bg-slate-900 text-white', reasons };
}

export function getMigraineRisk(deltaP: number, pressure: number, humidity: number, precip: number, lang: Language = 'es', cape?: number) {
  let riskScore = 0;
  const reasons: string[] = [];
  const isEn = lang === 'en';

  // 1. Barometric pressure changes (significant decrease)
  if (deltaP <= -5) {
    riskScore += 3;
    reasons.push(isEn ? `Severe pressure drop (${deltaP} hPa) [+3 pts]` : `Caída de presión severa (${deltaP} hPa) [+3 pts]`);
  } else if (deltaP <= -3) {
    riskScore += 1;
    reasons.push(isEn ? `Moderate pressure drop (${deltaP} hPa) [+1 pt]` : `Caída de presión moderada (${deltaP} hPa) [+1 pt]`);
  }

  // 2. Lower absolute barometric pressure
  if (pressure < 1010) {
    riskScore += 1;
    reasons.push(isEn ? `Low absolute pressure (${Math.round(pressure)} hPa) [+1 pt]` : `Baja presión absoluta (${Math.round(pressure)} hPa) [+1 pt]`);
  }

  // 3. Higher humidity
  if (humidity > 70) {
    riskScore += 1;
    reasons.push(isEn ? `High relative humidity (${Math.round(humidity)}%) [+1 pt]` : `Alta humedad relativa (${Math.round(humidity)}%) [+1 pt]`);
  }

  // 4. Increased rainfall
  if (precip > 0) {
    riskScore += 1;
    reasons.push(isEn ? `Active precipitation (${precip} mm) [+1 pt]` : `Precipitaciones activas (${precip} mm) [+1 pt]`);
  }

  // 5. Convective instability (CAPE) — storm systems amplify migraine triggers
  if (cape !== undefined && cape > 1000) {
    riskScore += 1;
    reasons.push(isEn ? `High storm potential (CAPE ${Math.round(cape)} J/kg) [+1 pt]` : `Alta inestabilidad convectiva (CAPE ${Math.round(cape)} J/kg) [+1 pt]`);
  }

  riskScore = Math.min(6, riskScore);

  if (reasons.length === 0) {
    reasons.push(isEn ? `Total atmospheric stability [0 pts]` : `Estabilidad atmosférica total [0 pts]`);
  }

  if (riskScore >= 6) return { label: isEn ? 'EXTREME' : 'EXTREMO', detail: isEn ? 'High-risk clinical pattern' : 'Patrón clínico de alto riesgo', bgClass: 'bg-purple-600 text-white', reasons, score: riskScore };
  if (riskScore >= 4) return { label: isEn ? 'HIGH' : 'ALTO', detail: isEn ? 'Conducive atmospheric conditions' : 'Condiciones atmosféricas propicias', bgClass: 'bg-red-600 text-white', reasons, score: riskScore };
  if (riskScore >= 3) return { label: isEn ? 'MOD' : 'MOD', detail: isEn ? 'Moderate risk' : 'Riesgo moderado', bgClass: 'bg-orange-500 text-white', reasons, score: riskScore };
  if (riskScore >= 2) return { label: isEn ? 'LOW' : 'BAJO', detail: isEn ? 'Mild risk' : 'Riesgo leve', bgClass: 'bg-yellow-400 text-slate-900', reasons, score: riskScore };
  return { label: isEn ? 'MINIMAL' : 'MÍNIMO', detail: isEn ? 'Stable weather (No risk)' : 'Clima estable (Sin riesgo)', bgClass: 'bg-emerald-500 text-slate-900', reasons, score: riskScore };
}

export function getStormPotential(cape: number, lang: Language = 'es') {
  const isEn = lang === 'en';
  if (cape > 2500) return { level: 'extreme' as const, label: isEn ? 'EXTREME' : 'EXTREMO', bgClass: 'bg-red-600 text-white', cape };
  if (cape > 1000) return { level: 'strong' as const, label: isEn ? 'STRONG' : 'FUERTE', bgClass: 'bg-orange-500 text-white', cape };
  if (cape > 300) return { level: 'moderate' as const, label: isEn ? 'MOD' : 'MOD', bgClass: 'bg-yellow-400 text-slate-900', cape };
  if (cape > 50) return { level: 'slight' as const, label: isEn ? 'SLIGHT' : 'LEVE', bgClass: 'bg-sky-400 text-white', cape };
  return { level: 'none' as const, label: isEn ? 'NONE' : 'NINGUNO', bgClass: 'bg-slate-700 text-slate-300', cape };
}

export function getAqiInfo(aqi: number, lang: Language = 'es') {
  const isEn = lang === 'en';
  if (aqi <= 20) return { label: isEn ? 'Good' : 'Bueno', bgClass: 'bg-emerald-500 text-white' };
  if (aqi <= 40) return { label: isEn ? 'Fair' : 'Aceptable', bgClass: 'bg-yellow-400 text-slate-900' };
  if (aqi <= 60) return { label: isEn ? 'Moderate' : 'Moderado', bgClass: 'bg-orange-400 text-white' };
  if (aqi <= 80) return { label: isEn ? 'Poor' : 'Malo', bgClass: 'bg-red-500 text-white' };
  if (aqi <= 100) return { label: isEn ? 'V.Poor' : 'Muy Malo', bgClass: 'bg-purple-600 text-white' };
  return { label: isEn ? 'Extreme' : 'Extremo', bgClass: 'bg-rose-900 text-red-200' };
}

export function getPollenLevel(value: number, lang: Language = 'es') {
  const isEn = lang === 'en';
  if (value <= 0) return null;
  if (value <= 10) return { label: isEn ? 'Low' : 'Bajo', bgClass: 'bg-emerald-500/80 text-white' };
  if (value <= 50) return { label: isEn ? 'Mod' : 'Mod', bgClass: 'bg-yellow-400 text-slate-900' };
  if (value <= 200) return { label: isEn ? 'High' : 'Alto', bgClass: 'bg-orange-500 text-white' };
  return { label: isEn ? 'V.High' : 'M.Alto', bgClass: 'bg-red-600 text-white' };
}
