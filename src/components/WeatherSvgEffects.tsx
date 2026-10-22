import React from 'react';
import type { WeatherParticles } from '../utils/weatherParticles';

export type WeatherCondition = 'clear' | 'partly-cloudy' | 'cloudy' | 'rain' | 'storm' | 'snow' | 'fog';

/** Map WMO weather codes to a WeatherCondition for the SVG animation layer. */
export function wmoToCondition(code: number): WeatherCondition {
  if (code === 0) return 'clear';
  if (code <= 2) return 'partly-cloudy';
  if (code === 3) return 'cloudy';
  if (code === 45 || code === 48) return 'fog';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if (code === 95 || code === 96 || code === 99) return 'storm';
  if (code >= 51) return 'rain';
  return 'clear';
}

interface Props {
  condition: WeatherCondition;
  weatherParticles: WeatherParticles;
  fogGradientId: string;
  /** 0–1 rain intensity from RAIN_INTENSITY map; scales dark cloud overlay for rain (not storm). */
  rainIntensity?: number;
  cloudOpacity?: number;
  stormOpacity?: number;
}

const WeatherSvgEffects: React.FC<Props> = ({
  condition,
  weatherParticles,
  fogGradientId,
  rainIntensity = 0.5,
  cloudOpacity = 0.65,
  stormOpacity = 0.6,
}) => {
  if (condition === 'clear') return null;

  const cloudFill1 = '#94a3b8';
  const cloudFill2 = '#cbd5e1';

  // Dark storm cloud overlay: full opacity for storms, scales with intensity for rain.
  // Drizzle (≤0.25) gets no dark overlay — just the grey cloud band.
  const darkCloudOpacity = condition === 'storm'
    ? stormOpacity
    : Math.max(0, (rainIntensity - 0.25) / 0.75) * stormOpacity;

  return (
    <g>
      {(condition === 'partly-cloudy' || condition === 'cloudy' || condition === 'rain' || condition === 'storm') && (
        <g opacity={condition === 'partly-cloudy' ? cloudOpacity * 0.25 : condition === 'cloudy' ? cloudOpacity * 0.6 : cloudOpacity * 0.35}>
          <path d="M -200 40 Q 50 10 120 50 T 250 30 T 500 60 L 500 -20 L -200 -20 Z" fill={cloudFill1} className="anim-cloud-fast" />
          <path d="M -200 70 Q 80 50 150 70 T 350 90 T 500 70 L 500 -20 L -200 -20 Z" fill={cloudFill2} opacity={0.6} className="anim-cloud-slow" />
        </g>
      )}

      {condition === 'snow' && (
        <g opacity={0.6}>
          <path d="M -200 30 Q 60 5 140 35 T 350 20 T 500 30 L 500 -20 L -200 -20 Z" fill="#6b7280" className="anim-cloud-slow" />
          <path d="M -200 60 Q 80 35 170 55 T 350 50 T 500 60 L 500 -20 L -200 -20 Z" fill="#9ca3af" opacity={0.7} className="anim-cloud-fast" />
        </g>
      )}

      {condition === 'fog' && (
        <g>
          <defs>
            <linearGradient id={fogGradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#d1d5db" stopOpacity={0} />
              <stop offset="40%"  stopColor="#d1d5db" stopOpacity={0.7} />
              <stop offset="100%" stopColor="#e5e7eb" stopOpacity={0.95} />
            </linearGradient>
          </defs>
          <rect x="-10" y="80" width="320" height="130" fill={`url(#${fogGradientId})`} opacity={0.85} />
          <ellipse cx="70"  cy="75"  rx="130" ry="14" fill="#e5e7eb" opacity={0.5}  className="anim-cloud-slow" />
          <ellipse cx="220" cy="65"  rx="110" ry="11" fill="#f3f4f6" opacity={0.4}  className="anim-cloud-fast" />
          <ellipse cx="150" cy="90"  rx="160" ry="16" fill="#e5e7eb" opacity={0.55} className="anim-cloud-slow" />
        </g>
      )}

      {(condition === 'storm' || condition === 'rain') && darkCloudOpacity > 0 && (
        <g className="animate-[pulse_10s_ease-in-out_infinite]" opacity={darkCloudOpacity}>
          <path d="M -200 50 Q 30 20 80 40 T 180 30 T 280 50 T 500 30 L 500 -20 L -200 -20 Z" fill="#1e293b" className="anim-cloud-slow" />
          <path d="M -200 80 Q 70 50 160 80 T 350 60 T 500 80 L 500 -20 L -200 -20 Z" fill="#0f172a" opacity={0.8} className="anim-cloud-fast" />
        </g>
      )}

      {(condition === 'rain' || condition === 'storm') && (
        <g>
          {weatherParticles.rain.map((drop, i) => (
            <line
              key={`rain-${i}`}
              x1={drop.x}              y1={drop.y}
              x2={drop.x + drop.drift} y2={drop.y + drop.length}
              stroke="#94a3b8"
              strokeWidth={drop.width}
              opacity={drop.opacity}
              className="anim-fall"
              style={{ '--drift': `${drop.driftPx}px`, '--dur': `${drop.dur}s`, animationDelay: `${drop.delay}s` } as React.CSSProperties}
            />
          ))}
        </g>
      )}

      {condition === 'snow' && (
        <g>
          {weatherParticles.snow.map((flake, i) => (
            <circle
              key={`snow-${i}`}
              cx={flake.x} cy={flake.y} r={flake.r}
              fill="#ffffff"
              opacity={flake.opacity}
              className="anim-fall"
              style={{ '--drift': `${flake.drift}px`, '--dur': `${flake.dur}s`, animationDelay: `${flake.delay}s` } as React.CSSProperties}
            />
          ))}
        </g>
      )}
    </g>
  );
};

export default WeatherSvgEffects;
