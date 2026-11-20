import { CircleCheck, Wind } from 'lucide-react';
import { useLanguage } from '../../hooks/useLanguage';
import { getWeatherInfo } from '../../utils/weatherCodes';
import { type DayKey, type DayOverview, type UmbrellaVerdict } from '../../utils/daySummary';
import { fill, fmtRange } from './format';
import { TONE_TEXT, type Tone } from './IconChip';
import { umbrellaVisual } from './DayRows';
import { getTint } from './weatherTint';

const WIND_TONE: Record<string, Tone> = { strong: 'orange', gale: 'red', storm: 'red' };

export function scrollToDay(day: DayKey) {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document
    .getElementById(`summary-section-${day}`)
    ?.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
}

function rainAmount(u: UmbrellaVerdict) {
  if (u.mm > 0 && u.kind !== 'snow') return `${u.mm} mm`;
  if (u.cm > 0) return `${u.cm} cm`;
  return u.maxProb === null ? '–' : `${Math.round(u.maxProb)}%`;
}

function RainLine({ umbrella }: Readonly<{ umbrella: UmbrellaVerdict | null }>) {
  const { t } = useLanguage();
  if (!umbrella || umbrella.level === 'none') {
    return (
      <span className="flex items-center gap-1 text-xs font-medium text-slate-500">
        {umbrella && (
          <CircleCheck
            size={14}
            strokeWidth={1.75}
            className="text-emerald-500"
            aria-hidden="true"
          />
        )}
        {umbrella ? t('summary.overview.dry') : '–'}
      </span>
    );
  }
  const { icon: Icon, tone } = umbrellaVisual(umbrella);
  return (
    <span className="flex items-center gap-1 text-xs font-semibold text-slate-700 tabular-nums">
      <Icon size={14} strokeWidth={1.75} className={TONE_TEXT[tone]} aria-hidden="true" />
      {rainAmount(umbrella)}
    </span>
  );
}

function dayLabel(o: DayOverview, t: (k: string) => string) {
  return o.day === 'today'
    ? `${t('summary.today')} (${fmtRange(o.part)})`
    : t(`summary.${o.day}`);
}

function rainText(u: UmbrellaVerdict | null, t: (k: string) => string) {
  if (!u) return t('summary.umbrella.no_data');
  if (u.level === 'none') return t('summary.umbrella.none');
  return t(`summary.umbrella.${u.level}.${u.kind}`);
}

function ariaSummary(o: DayOverview, t: (k: string) => string) {
  const felt = o.felt && fill(t('summary.felt.range'), { ...o.felt });
  return [dayLabel(o, t), felt, rainText(o.umbrella, t)].filter(Boolean).join('. ');
}

function OverviewCard({ o }: Readonly<{ o: DayOverview }>) {
  const { t, language } = useLanguage();
  const info = getWeatherInfo(o.weatherCode ?? 0, language);
  const tint = getTint(o.weatherCode);
  const Icon = info.icon;
  const windTone = o.strongWind ? WIND_TONE[o.strongWind] : null;
  return (
    <li className="min-w-0">
      <button
        type="button"
        onClick={() => scrollToDay(o.day)}
        aria-label={ariaSummary(o, t)}
        className="flex h-full w-full flex-col items-center gap-2 rounded-2xl border border-slate-100 bg-white px-2 pb-3 pt-2.5 text-center shadow-sm transition-transform duration-150 outline-none hover:scale-[1.02] active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-indigo-400 motion-reduce:transition-none motion-reduce:hover:scale-100 motion-reduce:active:scale-100"
      >
        <span className="flex min-h-8 flex-col justify-center text-[11px] font-bold uppercase leading-tight tracking-wide text-slate-500">
          {t(`summary.${o.day}`)}
          {o.day === 'today' && (
            <span className="font-semibold normal-case tracking-normal text-slate-400 tabular-nums">
              {fmtRange(o.part)}
            </span>
          )}
        </span>
        <span
          aria-hidden="true"
          title={info.label}
          className={`flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br ${tint.chip}`}
        >
          <Icon size={36} strokeWidth={1.5} className={tint.icon} />
        </span>
        <span className="text-lg font-bold leading-none text-slate-900 tabular-nums">
          {o.felt ? `${o.felt.min}–${o.felt.max}°` : '–'}
        </span>
        <span className="flex items-center gap-1.5">
          <RainLine umbrella={o.umbrella} />
          {windTone && (
            <Wind
              size={14}
              strokeWidth={1.75}
              className={TONE_TEXT[windTone]}
              aria-hidden="true"
            />
          )}
        </span>
      </button>
    </li>
  );
}

export function OverviewCards({ items }: Readonly<{ items: DayOverview[] }>) {
  return (
    <ul
      className={`summary-rise grid gap-2 ${items.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}
      style={{ animationDelay: '60ms' }}
    >
      {items.map((o) => (
        <OverviewCard key={o.day} o={o} />
      ))}
    </ul>
  );
}
