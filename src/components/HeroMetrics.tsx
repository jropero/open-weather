import { Droplets, Sun, Wind } from 'lucide-react';
import { useLanguage } from '../hooks/useLanguage';
import { getUvInfo, getWindDirection } from '../utils/weatherCodes';
import { compassIndex, showGusts, uvHeroColor, uvShown } from '../utils/heroMetrics';

interface Props {
  humidity: number;
  windSpeed: number;
  windDirection: number;
  windGusts: number | null | undefined;
  uvIndex: number | null | undefined;
}

const ICON = { size: 15, strokeWidth: 2, 'aria-hidden': true } as const;
const ITEM = 'flex items-center gap-1 whitespace-nowrap';
const Divider = () => <span aria-hidden="true" className="w-px h-3.5 bg-white/25" />;

function WindItem({ p }: Readonly<{ p: Props }>) {
  const { language, t } = useLanguage();
  const calm = p.windSpeed <= 0;
  const speed = Math.round(p.windSpeed);
  const gusts = showGusts(p.windGusts) ? Math.round(p.windGusts) : null;
  const dir = t(`wind.from.${compassIndex(p.windDirection)}`);
  let aria = t('label.wind_calm');
  if (!calm) {
    aria = t('hero.metric.wind').replace('{n}', String(speed)).replace('{dir}', dir);
    if (gusts !== null) aria += t('hero.metric.gusts').replace('{n}', String(gusts));
  }
  let text = t('label.wind_calm');
  if (!calm) text = `${speed} km/h ${getWindDirection(p.windDirection, language)}`;
  return (
    <span className={ITEM} aria-label={aria} title={aria}>
      <Wind {...ICON} />
      <span aria-hidden="true">
        {text}
        {!calm && gusts !== null && ` · ${t('hero.metric.gusts_short')} ${gusts}`}
      </span>
    </span>
  );
}

function UvItem({ uv }: Readonly<{ uv: number }>) {
  const { language, t } = useLanguage();
  const n = Math.round(uv);
  const aria = t('hero.metric.uv')
    .replace('{n}', String(n))
    .replace('{level}', getUvInfo(uv, language).label.toLowerCase());
  return (
    <span className={`${ITEM} font-semibold ${uvHeroColor(uv)}`} aria-label={aria} title={aria}>
      <Sun {...ICON} />
      <span aria-hidden="true">UV {n}</span>
    </span>
  );
}

/** One non-wrapping row of icon + value items: humidity, wind (+ gusts when breezy), UV (hidden at 0). */
export function HeroMetrics(p: Readonly<Props>) {
  const { t } = useLanguage();
  const hum = t('hero.metric.humidity').replace('{n}', String(Math.round(p.humidity)));
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm font-medium opacity-90 mb-4">
      <span className={ITEM} aria-label={hum} title={hum}>
        <Droplets {...ICON} />
        <span aria-hidden="true">{Math.round(p.humidity)}%</span>
      </span>
      <Divider />
      <WindItem p={p} />
      {uvShown(p.uvIndex) && (
        <>
          <Divider />
          <UvItem uv={p.uvIndex} />
        </>
      )}
    </div>
  );
}
