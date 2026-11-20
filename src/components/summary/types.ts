/** Current readings that only matter for today, shown only when notable */
export interface TodayExtras {
  pressureDrop6h: number | null;
  aqi: number | null;
  pollens: { name: string; value: number }[]; // notable only
}
