import { wmoToCondition, type WeatherCondition } from '../../utils/weatherCodes';

interface Tint {
  chip: string; // soft gradient behind the overview illustration
  icon: string;
  dot: string; // small dot in the day header
}

const TINTS: Record<WeatherCondition, Tint> = {
  clear: { chip: 'from-amber-100 to-orange-50', icon: 'text-amber-500', dot: 'bg-amber-400' },
  'partly-cloudy': {
    chip: 'from-amber-50 to-sky-100',
    icon: 'text-sky-600',
    dot: 'bg-amber-300',
  },
  cloudy: { chip: 'from-slate-100 to-slate-50', icon: 'text-slate-500', dot: 'bg-slate-400' },
  fog: { chip: 'from-slate-100 to-slate-50', icon: 'text-slate-500', dot: 'bg-slate-400' },
  rain: { chip: 'from-sky-100 to-sky-50', icon: 'text-sky-600', dot: 'bg-sky-500' },
  snow: { chip: 'from-cyan-100 to-sky-50', icon: 'text-cyan-600', dot: 'bg-cyan-400' },
  storm: {
    chip: 'from-violet-100 to-indigo-50',
    icon: 'text-violet-600',
    dot: 'bg-violet-500',
  },
};

export const getTint = (code: number | null): Tint => TINTS[wmoToCondition(code ?? 0)];
