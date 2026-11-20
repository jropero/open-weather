import {
  CircleCheck,
  Flower2,
  Gauge,
  Haze,
  ThermometerSnowflake,
  ThermometerSun,
  Wind,
  type LucideIcon,
} from 'lucide-react';
import type { Highlight } from '../../utils/daySummary';
import { umbrellaVisual } from './DayRows';
import type { Tone } from './IconChip';

export interface TeaserVisual {
  icon: LucideIcon;
  tone: Tone;
}

const WIND_TONE = { breezy: 'teal', strong: 'orange', gale: 'red', storm: 'red' } as const;

/** Icon + meaning colour of a highlight's topic (same palette as the dialog rows) */
export function teaserVisual(h: Highlight | undefined): TeaserVisual {
  switch (h?.topic) {
    case 'umbrella':
      return umbrellaVisual(h.umbrella);
    case 'wind':
      return { icon: Wind, tone: WIND_TONE[h.level] };
    case 'felt':
      return h.delta > 0
        ? { icon: ThermometerSun, tone: 'amber' }
        : { icon: ThermometerSnowflake, tone: 'blue' };
    case 'pressure':
      return { icon: Gauge, tone: 'indigo' };
    case 'air':
      return { icon: Haze, tone: 'orange' };
    case 'pollen':
      return { icon: Flower2, tone: 'yellow' };
    case 'calm':
    default:
      return { icon: CircleCheck, tone: 'emerald' };
  }
}
