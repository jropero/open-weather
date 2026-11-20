import type { CSSProperties } from 'react';
import type { HourRange } from '../../utils/daySummary';

export type Translate = (key: string) => string;

export const pad = (h: number) => String(h).padStart(2, '0');
export const fmtRange = (r: HourRange) => `${pad(r.from)}–${pad(r.to)}h`;
export const fmtRanges = (rs: HourRange[]) => rs.map(fmtRange).join(', ');
export const fill = (s: string, vars: Record<string, string | number>) =>
  Object.entries(vars).reduce((acc, [k, v]) => acc.replaceAll(`{${k}}`, String(v)), s);
export const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function fmtSigned(n: number) {
  if (n > 0) return `+${n}`;
  if (n < 0) return `−${Math.abs(n)}`;
  return '0';
}

/** Inline CSS custom property (animation stagger) */
export const cssVar = (name: string, value: string | number): CSSProperties =>
  ({ [name]: value }) as CSSProperties;
