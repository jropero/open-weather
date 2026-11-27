import { CloudFog, Moon, Sun, SunDim, type LucideIcon } from 'lucide-react';
import { useLanguage } from '../hooks/useLanguage';
import { currentLight, formatLux, type LightLevel } from '../utils/daylight';
import { fill } from './summary/format';

// Current outdoor light (estimated lux, ±15 %) for one city row of the comparison panel.

const LEVEL_STYLE: Record<LightLevel, { Icon: LucideIcon; color: string }> = {
  dark: { Icon: CloudFog, color: 'text-slate-400' },
  dim: { Icon: SunDim, color: 'text-slate-400' },
  bright: { Icon: Sun, color: 'text-amber-500' },
  very_bright: { Icon: Sun, color: 'text-amber-500' },
};

interface Props {
  direct?: number | null;
  diffuse?: number | null;
  isDay?: boolean | null;
}

export function LocationLux({ direct, diffuse, isDay }: Readonly<Props>) {
  const { language, t } = useLanguage();
  const light = currentLight(direct, diffuse, isDay);
  if (!light) return null;

  if (light.kind === 'night') {
    return (
      <div className="flex items-center gap-1.5" title={t('light.now.night.title')}>
        <Moon size={12} className="text-indigo-300" aria-hidden="true" />
        <span className="font-semibold text-slate-500">{t('light.now.night')}</span>
      </div>
    );
  }

  const { Icon, color } = LEVEL_STYLE[light.level];
  const value = formatLux(light.lux, language, false);
  const title = fill(t('light.now.title'), { v: value, w: Math.round(light.wm2) });
  return (
    <div className="flex items-center gap-1.5" title={title}>
      <Icon size={12} className={color} aria-hidden="true" />
      <span className="font-bold text-slate-600">
        {value} <span className="text-[8px] text-slate-500 font-semibold">lux</span>
      </span>
    </div>
  );
}
