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

/** Wind streaks composited on top of any weather condition when gusts ≥ 28 km/h. */
interface WindStreak {
  y: number;
  length: number;
  opacity: number;
  dur: number;
  delay: number;
  startX: number;
  endX: number;
  strokeWidth: number;
}

function generateWindStreaks(gusts: number): WindStreak[] {
  if (gusts < 28) return [];
  // Scale count and length with gust speed: breezy (28) → 6 streaks, storm (89+) → 22
  const t = Math.min(1, (gusts - 28) / 61);
  const count = Math.round(6 + t * 16);
  return Array.from({ length: count }).map(() => {
    const dur = 1.2 - t * 0.5 + Math.random() * 0.6;
    const length = 18 + t * 40 + Math.random() * 15;
    return {
      y: 20 + Math.random() * 160,
      length,
      opacity: 0.18 + t * 0.22 + Math.random() * 0.08,
      dur,
      delay: -(Math.random() * dur * 3),
      startX: -length - Math.random() * 60,
      endX: 310 + Math.random() * 60,
      strokeWidth: 0.5 + t * 0.8 + Math.random() * 0.4,
    };
  });
}

interface Props {
  condition: WeatherCondition;
  weatherParticles: WeatherParticles;
  fogGradientId: string;
  /** 0–1 rain intensity from RAIN_INTENSITY map; scales dark cloud overlay for rain (not storm). */
  rainIntensity?: number;
  cloudOpacity?: number;
  stormOpacity?: number;
  /** Current wind gusts in km/h; shows wind streaks when ≥ 28. */
  windGusts?: number;
}

const WeatherSvgEffects: React.FC<Props> = ({
  condition,
  weatherParticles,
  fogGradientId,
  rainIntensity = 0.5,
  cloudOpacity = 0.65,
  stormOpacity = 0.6,
  windGusts = 0,
}) => {
  const windStreaks = React.useMemo(() => generateWindStreaks(windGusts), [windGusts]);

  if (condition === 'clear' && windStreaks.length === 0) return null;

  const cloudFill1 = '#94a3b8';
  const cloudFill2 = '#cbd5e1';

  // Dark storm cloud overlay: full opacity for storms, scales with intensity for rain.
  // Drizzle (≤0.25) gets no dark overlay — just the grey cloud band.
  const darkCloudOpacity = condition === 'storm'
    ? stormOpacity
    : Math.max(0, (rainIntensity - 0.25) / 0.75) * stormOpacity;

  const mistGradientId = `${fogGradientId}-mist`;

  return (
    <g>
      {(condition === 'partly-cloudy' || condition === 'cloudy' || condition === 'rain' || condition === 'storm') && (
        <>
          {/* Far background layer + cumulus puffs — only when windy */}
          {windStreaks.length > 0 && (
            <>
              <g opacity={condition === 'partly-cloudy' ? 0.10 : condition === 'cloudy' ? 0.22 : 0.15}>
                <path d="M -200 35 Q 0 15 100 40 T 300 25 T 500 38 L 500 -20 L -200 -20 Z" fill="#8fa3b8" className="anim-cloud-bg" />
                <path d="M -200 58 Q 40 38 130 62 T 330 48 T 500 58 L 500 -20 L -200 -20 Z" fill="#a3b5c5" opacity={0.7} className="anim-cloud-bg" />
              </g>
              {(condition === 'cloudy' || condition === 'partly-cloudy') && (
                <g opacity={condition === 'partly-cloudy' ? 0.20 : 0.35}>
                  <ellipse cx="55"  cy="62" rx="52" ry="16" fill={cloudFill2} className="anim-cloud-slow" />
                  <ellipse cx="55"  cy="54" rx="36" ry="14" fill="#dde4ec" className="anim-cloud-slow" />
                  <ellipse cx="78"  cy="58" rx="38" ry="13" fill={cloudFill1} opacity={0.8} className="anim-cloud-slow" />
                  <ellipse cx="205" cy="50" rx="58" ry="15" fill={cloudFill2} opacity={0.9} className="anim-cloud-fast" />
                  <ellipse cx="205" cy="42" rx="40" ry="13" fill="#dde4ec" className="anim-cloud-fast" />
                  <ellipse cx="230" cy="46" rx="35" ry="11" fill={cloudFill1} opacity={0.75} className="anim-cloud-fast" />
                </g>
              )}
            </>
          )}
          {/* Mid cloud band — always shown */}
          <g opacity={condition === 'partly-cloudy' ? cloudOpacity * 0.25 : condition === 'cloudy' ? cloudOpacity * 0.6 : cloudOpacity * 0.35}>
            <path d="M -200 40 Q 50 10 120 50 T 250 30 T 500 60 L 500 -20 L -200 -20 Z" fill={cloudFill1} className="anim-cloud-fast" />
            <path d="M -200 70 Q 80 50 150 70 T 350 90 T 500 70 L 500 -20 L -200 -20 Z" fill={cloudFill2} opacity={0.6} className="anim-cloud-slow" />
          </g>
        </>
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
        <>
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
          {/* Ground mist + splash streaks — only when windy */}
          {windStreaks.length > 0 && (
            <>
              <defs>
                <linearGradient id={mistGradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#94a3b8" stopOpacity={0} />
                  <stop offset="100%" stopColor="#94a3b8" stopOpacity={rainIntensity * 0.55} />
                </linearGradient>
              </defs>
              <rect
                x="-10" y="140" width="320" height="70"
                fill={`url(#${mistGradientId})`}
                className="anim-mist"
                style={{ '--md': '6s', '--mb': rainIntensity * 0.5 } as React.CSSProperties}
              />
              {([0.15, 0.35, 0.55, 0.72, 0.88] as const).map((frac, i) => (
                <line
                  key={`splash-${frac}`}
                  x1={frac * 300 - 6} y1={170 + i * 4}
                  x2={frac * 300 + 6} y2={170 + i * 4}
                  stroke="#cbd5e1"
                  strokeWidth={0.6}
                  strokeLinecap="round"
                  className="anim-mist"
                  style={{ '--md': `${3.5 + i * 0.7}s`, '--mb': rainIntensity * 0.4, animationDelay: `${i * 0.9}s` } as React.CSSProperties}
                />
              ))}
            </>
          )}
        </>
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

      {windStreaks.length > 0 && (
        <g>
          {windStreaks.map((streak, i) => (
            <line
              key={`wind-${i}`}
              x1={streak.startX} y1={streak.y}
              x2={streak.startX + streak.length} y2={streak.y}
              stroke="#e2e8f0"
              strokeWidth={streak.strokeWidth}
              strokeLinecap="round"
              className="anim-wind"
              style={{
                '--wd': `${streak.dur}s`,
                '--ws': `${streak.startX - streak.endX}px`,
                '--we': `${streak.endX - streak.startX}px`,
                '--wo': streak.opacity,
                animationDelay: `${streak.delay}s`,
              } as React.CSSProperties}
            />
          ))}
        </g>
      )}
    </g>
  );
};

export default WeatherSvgEffects;
