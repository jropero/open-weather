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
  if (code === 0) return { label: isEn ? 'Clear' : 'Despejado', icon: Sun, color: 'text-amber-300 fill-amber-300', colorDark: 'text-amber-500 fill-amber-500', animation: 'animate-sun' };
  if (code === 1 || code === 2 || code === 3) return { label: isEn ? 'Cloudy' : 'Nublado', icon: Cloud, color: 'text-slate-300 fill-slate-300 opacity-90', colorDark: 'text-slate-400 fill-slate-400', animation: 'animate-cloud' };
  if (code === 45 || code === 48) return { label: isEn ? 'Fog' : 'Niebla', icon: CloudFog, color: 'text-zinc-300 fill-zinc-300 opacity-80', colorDark: 'text-zinc-400 fill-zinc-400', animation: 'animate-cloud' };
  if (code === 51 || code === 53 || code === 55 || code === 56 || code === 57) return { label: isEn ? 'Drizzle' : 'Llovizna', icon: CloudDrizzle, color: 'text-sky-300 fill-sky-300', colorDark: 'text-sky-500 fill-sky-500', animation: 'animate-rain' };
  if (code === 61 || code === 63 || code === 65 || code === 66 || code === 67) return { label: isEn ? 'Rain' : 'Lluvia', icon: CloudRain, color: 'text-blue-300 fill-blue-300', colorDark: 'text-blue-500 fill-blue-500', animation: 'animate-rain' };
  if (code === 71 || code === 73 || code === 75 || code === 77 || code === 85 || code === 86) return { label: isEn ? 'Snow' : 'Nieve', icon: CloudSnow, color: 'text-cyan-100 fill-cyan-100', colorDark: 'text-cyan-600 fill-cyan-600', animation: 'animate-cloud' };
  if (code === 80 || code === 81 || code === 82) return { label: isEn ? 'Rain Showers' : 'Chubascos', icon: CloudRain, color: 'text-blue-400 fill-blue-400', colorDark: 'text-blue-600 fill-blue-600', animation: 'animate-rain' };
  if (code === 95 || code === 96 || code === 99) return { label: isEn ? 'Thunderstorm' : 'Tormenta', icon: CloudLightning, color: 'text-purple-300 fill-purple-300', colorDark: 'text-purple-500 fill-purple-500', animation: 'animate-storm' };
  
  return { label: isEn ? 'Unknown' : 'Desconocido', icon: Sun, color: 'text-amber-300 fill-amber-300', colorDark: 'text-amber-500 fill-amber-500', animation: 'animate-sun' };
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
  if (deltaP >= 5) return { label: isEn ? 'RISES' : 'SUBE', detail: `+${deltaP} hPa`, bgClass: 'bg-sky-500 text-white' };
  const sign = deltaP > 0 ? '+' : '';
  return { label: isEn ? 'STABLE' : 'ESTABLE', detail: `${sign}${deltaP} hPa`, bgClass: 'bg-slate-700 text-slate-300' };
}

export function getMigraineRisk(deltaP: number, pressure: number, humidity: number, precip: number, lang: Language = 'es') {
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

  if (reasons.length === 0) {
    reasons.push(isEn ? `Total atmospheric stability [0 pts]` : `Estabilidad atmosférica total [0 pts]`);
  }

  if (riskScore >= 6) return { label: isEn ? 'EXTREME' : 'EXTREMO', detail: isEn ? 'High-risk clinical pattern' : 'Patrón clínico de alto riesgo', bgClass: 'bg-purple-600 text-white', reasons, score: riskScore };
  if (riskScore >= 4) return { label: isEn ? 'HIGH' : 'ALTO', detail: isEn ? 'Conducive atmospheric conditions' : 'Condiciones atmosféricas propicias', bgClass: 'bg-red-600 text-white', reasons, score: riskScore };
  if (riskScore >= 3) return { label: isEn ? 'MOD' : 'MOD', detail: isEn ? 'Moderate risk' : 'Riesgo moderado', bgClass: 'bg-orange-500 text-white', reasons, score: riskScore };
  if (riskScore >= 2) return { label: isEn ? 'LOW' : 'BAJO', detail: isEn ? 'Mild risk' : 'Riesgo leve', bgClass: 'bg-yellow-400 text-slate-900', reasons, score: riskScore };
  return { label: isEn ? 'MINIMAL' : 'MÍNIMO', detail: isEn ? 'Stable weather (No risk)' : 'Clima estable (Sin riesgo)', bgClass: 'bg-emerald-500 text-slate-900', reasons, score: riskScore };
}
