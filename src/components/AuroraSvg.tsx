import React, { useId } from 'react';

/**
 * Aurora borealis drawn into a 300×200 weather viewBox. Shown when there is no
 * weather data (offline, failed fetch, or a fetch slower than 1 s).
 *
 * Each curtain is a ribbon with a sinuous lower edge that ripples sideways
 * (SMIL morph of `d`), tapered tips and a top that fades to transparent. Rays
 * are a thick dashed stroke along the lower edge: every dash is a bar
 * perpendicular to the curve, so the rays follow the folds. Far curtains are
 * higher, dimmer and slower; near ones are brighter, faster and sway more.
 * Hue: red and blue curtains keep their colour; the green ones cycle
 * green → teal → violet → rose and back over HUE_CYCLE_S. No SVG filters, so
 * the cost is just repainting a few gradient-filled paths.
 */

interface Wave { amp: number; freq: number; speed: number; offset: number }

interface Curtain {
  x0: number; x1: number;
  /** Mean y of the lower edge. */
  base: number;
  /** Peak ribbon height at the middle of the curtain. */
  height: number;
  waves: Wave[];
  rayLen: number;
  rayDash: string;
  opacity: number;
  morphS: number;
  swayS: number;
  swayX: number;
  swaySkew: number;
  /** Fixed colours, or `null` to follow the shared hue cycle. */
  colors: { top: string; main: string; bright: string } | null;
  /** Colour of the ribbon top for hue-cycling curtains (e.g. a red fringe). */
  fringe?: string;
  hueBegin?: number;
}

const HUE_CYCLE_S = 240;
const HUE_KEY_TIMES = '0;0.3;0.42;0.52;0.6;0.68;0.8;1';
// Ping-pong through violet so green → rose never interpolates through grey.
const HUE_MAIN   = '#10b981;#10b981;#14b8a6;#8b5cf6;#e11d48;#8b5cf6;#14b8a6;#10b981';
const HUE_BRIGHT = '#6ee7b7;#6ee7b7;#5eead4;#c4b5fd;#fda4af;#c4b5fd;#5eead4;#6ee7b7';

// Back to front: far curtains first.
const CURTAINS: Curtain[] = [
  { // high red — real aurora is red above the green band
    x0: -40, x1: 340, base: 50, height: 34, rayLen: 22, rayDash: '0.7 3.1 1.4 4.6 0.5 2.4 1.9 5.2',
    waves: [{ amp: 5, freq: 1.1, speed: 1, offset: 0.3 }, { amp: 2.2, freq: 2.6, speed: -1, offset: 1.7 }],
    opacity: 0.34, morphS: 27, swayS: 37, swayX: 3, swaySkew: 0.8,
    colors: { top: '#be123c', main: '#e11d48', bright: '#fb7185' },
  },
  { // blue, right half
    x0: 70, x1: 360, base: 70, height: 40, rayLen: 26, rayDash: '0.9 2.7 1.6 3.9 0.6 3.3 2.1 4.4',
    waves: [{ amp: 6, freq: 1.3, speed: -1, offset: 2.1 }, { amp: 2.5, freq: 3.1, speed: 1, offset: 0.4 }],
    opacity: 0.4, morphS: 22, swayS: 31, swayX: 4, swaySkew: 1,
    colors: { top: '#4338ca', main: '#6366f1', bright: '#93c5fd' },
  },
  { // mid teal-green, left
    x0: -70, x1: 220, base: 92, height: 52, rayLen: 32, rayDash: '1 2.4 1.8 3.6 0.6 2 2.4 4.2',
    waves: [{ amp: 8, freq: 1.4, speed: 1, offset: 1.1 }, { amp: 3, freq: 3.4, speed: -1, offset: 2.6 }],
    opacity: 0.55, morphS: 17, swayS: 23, swayX: 7, swaySkew: 1.6,
    colors: null, fringe: '#0e7490', hueBegin: -40,
  },
  { // mid green, right
    x0: 40, x1: 350, base: 104, height: 60, rayLen: 36, rayDash: '0.8 2.2 2 3.2 0.6 1.8 1.4 3.8',
    waves: [{ amp: 9, freq: 1.2, speed: -1, offset: 0.2 }, { amp: 3.5, freq: 2.9, speed: 1, offset: 1.4 }],
    opacity: 0.62, morphS: 14, swayS: 19, swayX: 8, swaySkew: 2,
    colors: null, fringe: '#047857',
  },
  { // near bright green with a pink top fringe
    x0: -60, x1: 360, base: 122, height: 76, rayLen: 46, rayDash: '1.2 2 2.4 3 0.7 1.6 1.8 3.6',
    waves: [{ amp: 11, freq: 1.5, speed: 1, offset: 2.4 }, { amp: 4, freq: 3.7, speed: -2, offset: 0.9 }],
    opacity: 0.82, morphS: 10, swayS: 13, swayX: 12, swaySkew: 2.6,
    colors: null, fringe: '#f472b6',
  },
];

/** Multiplies every motion duration (morph, sway, ray drift); 2 = half speed. */
const MOTION_SLOWDOWN = 2;

const SAMPLES = 28;
const FRAMES = 6;

const round = (n: number) => Math.round(n * 10) / 10;

/** Quadratic midpoint smoothing; command structure is constant so SMIL can morph it. */
const smooth = (pts: [number, number][], move: boolean): string => {
  const mid = (a: [number, number], b: [number, number]) => `${round((a[0] + b[0]) / 2)} ${round((a[1] + b[1]) / 2)}`;
  let d = `${move ? 'M' : 'L'} ${round(pts[0][0])} ${round(pts[0][1])} L ${mid(pts[0], pts[1])}`;
  for (let i = 1; i < pts.length - 1; i++) d += ` Q ${round(pts[i][0])} ${round(pts[i][1])} ${mid(pts[i], pts[i + 1])}`;
  const last = pts[pts.length - 1];
  return `${d} L ${round(last[0])} ${round(last[1])}`;
};

const edges = (c: Curtain, phase: number) => {
  const bottom: [number, number][] = [];
  const top: [number, number][] = [];
  for (let i = 0; i < SAMPLES; i++) {
    const t = i / (SAMPLES - 1);
    const x = c.x0 + (c.x1 - c.x0) * t;
    let y = c.base;
    for (const w of c.waves) y += w.amp * Math.sin(2 * Math.PI * w.freq * t + w.speed * phase + w.offset);
    // Tapered tips; the top edge has fine "fingers" that read as rays once the gradient fades them.
    const envelope = Math.pow(Math.sin(Math.PI * t), 0.7);
    const h = c.height * envelope * (0.78 + 0.16 * Math.sin(2 * Math.PI * 1.3 * t - phase + c.base) + 0.06 * Math.sin(2 * Math.PI * 9 * t + 2 * phase));
    bottom.push([x, y]);
    top.push([x, y - h]);
  }
  return { bottom, top };
};

const frames = (build: (phase: number) => string) => {
  const out: string[] = [];
  for (let k = 0; k <= FRAMES; k++) out.push(build((2 * Math.PI * (k % FRAMES)) / FRAMES));
  return out.join(';');
};

// Geometry is static — compute once per module load.
const GEOMETRY = CURTAINS.map(c => ({
  body: frames(phase => {
    const { bottom, top } = edges(c, phase);
    return `${smooth(bottom, true)} ${smooth(top.reverse(), false)} Z`;
  }),
  rays: frames(phase => smooth(edges(c, phase).bottom.map(([x, y]) => [x, y - c.rayLen / 2]), true)),
  rayTop: c.base - c.waves.reduce((s, w) => s + w.amp, 0) - c.rayLen,
  rayBottom: c.base + c.waves.reduce((s, w) => s + w.amp, 0),
}));

const Stop: React.FC<{ offset: string; color: string; opacity: number; cycle?: string; begin?: number }> = ({ offset, color, opacity, cycle, begin = 0 }) => (
  <stop offset={offset} stopColor={color} stopOpacity={opacity}>
    {cycle && (
      <animate attributeName="stop-color" values={cycle} keyTimes={HUE_KEY_TIMES} dur={`${HUE_CYCLE_S}s`} begin={`${begin}s`} repeatCount="indefinite" />
    )}
  </stop>
);

const AuroraSvg: React.FC<{ className?: string; style?: React.CSSProperties }> = ({ className, style }) => {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const id = (name: string, i?: number) => `aurora-${uid}-${name}${i ?? ''}`;

  return (
    <g className={className} style={style}>
      <defs>
        <radialGradient id={id('glow')} cx="0.5" cy="0.15" r="0.75">
          <Stop offset="0%" color="#10b981" opacity={0.16} cycle={HUE_MAIN} />
          <Stop offset="100%" color="#10b981" opacity={0} cycle={HUE_MAIN} />
        </radialGradient>
        {CURTAINS.map((c, i) => {
          const main = c.colors?.main ?? '#10b981';
          const bright = c.colors?.bright ?? '#6ee7b7';
          const top = c.colors?.top ?? c.fringe ?? main;
          const mainCycle = c.colors ? undefined : HUE_MAIN;
          const brightCycle = c.colors ? undefined : HUE_BRIGHT;
          const g = GEOMETRY[i];
          return (
            <React.Fragment key={i}>
              {/* Body: transparent top → colour → bright lower border. */}
              <linearGradient id={id('body', i)} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" color={top} opacity={0} />
                <Stop offset="35%" color={top} opacity={0.16} />
                <Stop offset="70%" color={main} opacity={0.5} cycle={mainCycle} begin={c.hueBegin} />
                <Stop offset="90%" color={bright} opacity={0.92} cycle={brightCycle} begin={c.hueBegin} />
                <Stop offset="100%" color={bright} opacity={0.3} cycle={brightCycle} begin={c.hueBegin} />
              </linearGradient>
              <linearGradient id={id('ray', i)} gradientUnits="userSpaceOnUse" x1="0" y1={g.rayTop} x2="0" y2={g.rayBottom}>
                <Stop offset="0%" color={main} opacity={0} cycle={mainCycle} begin={c.hueBegin} />
                <Stop offset="55%" color={main} opacity={0.18} cycle={mainCycle} begin={c.hueBegin} />
                <Stop offset="100%" color={bright} opacity={0.5} cycle={brightCycle} begin={c.hueBegin} />
              </linearGradient>
            </React.Fragment>
          );
        })}
      </defs>

      {/* Ambient glow from above: fades out before any viewBox edge, so nothing clips. */}
      <ellipse cx="150" cy="40" rx="190" ry="95" fill={`url(#${id('glow')})`} />

      {CURTAINS.map((c, i) => {
        const g = GEOMETRY[i];
        const morphDur = `${c.morphS * MOTION_SLOWDOWN}s`;
        const bodyShape = (
          <path d={g.body.slice(0, g.body.indexOf(';'))}>
            <animate attributeName="d" values={g.body} dur={morphDur} repeatCount="indefinite" />
          </path>
        );
        return (
          <g key={i} opacity={c.opacity}>
            <g
              className="anim-aurora-drift"
              style={{ '--dur': `${c.swayS * MOTION_SLOWDOWN}s`, '--ax': `${c.swayX}px`, '--sk': `${c.swaySkew}deg`, animationDelay: `${-i * 3.7 * MOTION_SLOWDOWN}s` } as React.CSSProperties}
            >
              {/* The ray stroke is offset perpendicular to the curve, so on slopes its dashes
                  poke below the lower edge; clip them to the (identically morphing) body. */}
              <clipPath id={id('clip', i)}>{bodyShape}</clipPath>
              {React.cloneElement(bodyShape, { fill: `url(#${id('body', i)})` })}
              <path d={g.rays.slice(0, g.rays.indexOf(';'))} fill="none" stroke={`url(#${id('ray', i)})`} strokeWidth={c.rayLen} strokeDasharray={c.rayDash} clipPath={`url(#${id('clip', i)})`}>
                <animate attributeName="d" values={g.rays} dur={morphDur} repeatCount="indefinite" />
                <animate attributeName="stroke-dashoffset" values="0;-60" dur={`${c.morphS * 2 * MOTION_SLOWDOWN}s`} repeatCount="indefinite" />
              </path>
            </g>
          </g>
        );
      })}
    </g>
  );
};

export default AuroraSvg;
