// WMO rain/storm codes → 0–1 intensity (0 = light drizzle, 1 = violent storm)
export const RAIN_INTENSITY: Record<number, number> = {
  51: 0.10, 56: 0.15, 53: 0.20, 61: 0.25, 55: 0.30,
  57: 0.35, 80: 0.30, 66: 0.35, 62: 0.40, 63: 0.50,
  81: 0.55, 67: 0.60, 65: 0.70, 82: 0.85, 95: 0.90,
  96: 0.95, 99: 1.00,
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export interface RainDrop {
  x: number;
  y: number;
  length: number;
  width: number;
  opacity: number;
  dur: number;
  drift: number;
  driftPx: number;
  delay: number;
}

export interface SnowFlake {
  x: number;
  y: number;
  r: number;
  opacity: number;
  dur: number;
  drift: number;
  delay: number;
}

export interface WeatherParticles {
  rain: RainDrop[];
  snow: SnowFlake[];
}

export function generateWeatherParticles(rainIntensity: number): WeatherParticles {
  const count = Math.round(lerp(50, 140, rainIntensity));

  const rain: RainDrop[] = Array.from({ length: count }).map(() => {
    const dur = lerp(2.4, 1.1, rainIntensity) + Math.random() * 0.6;
    const drift = -5 - Math.random() * 10;
    return {
      x: Math.random() * 360 - 30,
      y: -30 - Math.random() * 50,
      length: lerp(6, 30, rainIntensity) + Math.random() * 5,
      width: lerp(0.4, 1.6, rainIntensity) + Math.random() * 0.3,
      opacity: 0.30 + Math.random() * 0.13,
      dur,
      drift,
      driftPx: drift * 20,
      delay: -(Math.random() * dur),
    };
  });

  const snow: SnowFlake[] = Array.from({ length: 55 }).map(() => {
    const dur = 3 + Math.random() * 4;
    return {
      x: Math.random() * 300,
      y: -20 - Math.random() * 50,
      r: Math.random() * 1.5 + 0.5,
      opacity: Math.random() * 0.6 + 0.4,
      dur,
      drift: -20 + Math.random() * 40,
      delay: -(Math.random() * dur),
    };
  });

  return { rain, snow };
}
