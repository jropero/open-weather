import {
  CircleCheck,
  CloudLightning,
  CloudSnow,
  Factory,
  Flower2,
  Snowflake,
  Thermometer,
  ThermometerSnowflake,
  ThermometerSun,
  TrendingDown,
  Umbrella,
  Wind,
  type LucideIcon,
} from 'lucide-react';
import { useLanguage } from '../../hooks/useLanguage';
import { getAqiInfo, getPollenLevel, type GustLevel } from '../../utils/weatherCodes';
import {
  compareFelt,
  isCalmDay,
  SUMMARY_THRESHOLDS,
  type DayKey,
  type DayPart,
  type DaySummary,
  type FeltComparison,
  type FeltRange,
  type UmbrellaVerdict,
} from '../../utils/daySummary';
import { fill, fmtRanges, fmtSigned, type Translate } from './format';
import { TONE_CHIP, type Tone } from './IconChip';
import { Row } from './Row';
import type { TodayExtras } from './types';

const WIND_TONE: Record<GustLevel, Tone> = {
  breezy: 'teal',
  strong: 'orange',
  gale: 'red',
  storm: 'red',
};

export function umbrellaVisual(u: UmbrellaVerdict): { icon: LucideIcon; tone: Tone } {
  if (u.level === 'none') return { icon: Umbrella, tone: 'emerald' };
  if (u.thunder) return { icon: CloudLightning, tone: 'violet' };
  if (u.kind === 'snow') return { icon: Snowflake, tone: 'cyan' };
  if (u.kind === 'freezing') return { icon: Snowflake, tone: 'blue' };
  if (u.kind === 'mixed') return { icon: CloudSnow, tone: 'cyan' };
  return { icon: Umbrella, tone: 'sky' };
}

function rainDetail(u: UmbrellaVerdict, t: Translate) {
  return [
    u.kind !== 'snow' && u.mm > 0 && `${u.mm} mm`,
    u.cm > 0 && `${u.cm} cm`,
    u.maxProb !== null && fill(t('summary.umbrella.prob'), { n: Math.round(u.maxProb) }),
    u.intermittent && t('summary.umbrella.intermittent'),
    u.thunder && t('summary.umbrella.thunder'),
  ]
    .filter(Boolean)
    .join(' · ');
}

function RainRow({ part }: Readonly<{ part: DayPart }>) {
  const { t } = useLanguage();
  const u = part.umbrella;
  if (!u)
    return <Row icon={Umbrella} tone="slate" title={t('summary.umbrella.no_data')} muted />;
  const none = u.level === 'none';
  const { icon, tone } = umbrellaVisual(u);
  return (
    <Row
      icon={icon}
      tone={tone}
      title={t(none ? 'summary.umbrella.none' : `summary.umbrella.${u.level}.${u.kind}`)}
      detail={none ? t('summary.umbrella.none_detail') : rainDetail(u, t) || undefined}
      time={none ? undefined : fmtRanges(u.ranges)}
      strong={u.level === 'take'}
    />
  );
}

// Calm (below the hero's "breezy") or no gust data → no row
function WindRow({ part }: Readonly<{ part: DayPart }>) {
  const { t } = useLanguage();
  const w = part.wind;
  if (!w?.level) return null;
  return (
    <Row
      icon={Wind}
      tone={WIND_TONE[w.level]}
      title={fill(t('summary.wind.row'), { level: t(`summary.wind.${w.level}`), g: w.gusts })}
      time={fmtRanges(w.ranges)}
      strong={w.level !== 'breezy'}
    />
  );
}

/** Dry and calm collapses into one reassuring row */
export function RainWindRows({ part }: Readonly<{ part: DayPart }>) {
  const { t } = useLanguage();
  if (isCalmDay(part))
    return <Row icon={CircleCheck} tone="emerald" title={t('summary.calm')} />;
  return (
    <>
      <RainRow part={part} />
      <WindRow part={part} />
    </>
  );
}

const DELTA_VISUAL: Record<FeltComparison['tone'], { icon: LucideIcon; tone: Tone }> = {
  colder: { icon: ThermometerSnowflake, tone: 'blue' },
  warmer: { icon: ThermometerSun, tone: 'amber' },
  similar: { icon: Thermometer, tone: 'slate' },
};

function DeltaChip({ cmp }: Readonly<{ cmp: FeltComparison }>) {
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold leading-4 ${TONE_CHIP[DELTA_VISUAL[cmp.tone].tone]}`}
    >
      {fmtSigned(cmp.delta)}°
    </span>
  );
}

function ComparedFeltRow({
  afterTomorrow,
  cmp,
  felt,
}: Readonly<{ afterTomorrow: boolean; cmp: FeltComparison; felt: FeltRange }>) {
  const { t } = useLanguage();
  const prefix = afterTomorrow ? 'summary.felt.after' : 'summary.felt';
  const { icon, tone } = DELTA_VISUAL[cmp.tone];
  return (
    <Row
      icon={icon}
      tone={tone}
      title={t(`${prefix}.${cmp.similar ? 'similar' : cmp.adjective}`)}
      detail={fill(t(`${prefix}.detail`), { ...felt, tmin: cmp.base.min, tmax: cmp.base.max })}
      value={<DeltaChip cmp={cmp} />}
    />
  );
}

export function FeltRow({
  day,
  part,
  summary,
}: Readonly<{ day: DayKey; part: DayPart; summary: DaySummary }>) {
  const { t } = useLanguage();
  const felt = part.felt;
  if (!felt)
    return <Row icon={Thermometer} tone="slate" title={t('summary.felt.none')} muted />;
  const range = fill(t(felt.min === felt.max ? 'summary.felt.single' : 'summary.felt.range'), {
    ...felt,
  });
  if (day === 'today') return <Row icon={Thermometer} tone="amber" title={range} />;

  const afterTomorrow = day === 'dayAfterTomorrow';
  const cmp = afterTomorrow
    ? compareFelt(summary.feltDeltaDayAfter, felt, summary.tomorrowFelt)
    : compareFelt(summary.feltDelta, felt, summary.todayFelt);
  if (!cmp)
    return (
      <Row
        icon={Thermometer}
        tone="slate"
        title={range}
        detail={t('summary.felt.no_compare')}
      />
    );
  return <ComparedFeltRow afterTomorrow={afterTomorrow} cmp={cmp} felt={felt} />;
}

export function TodayExtraRows({ extras }: Readonly<{ extras: TodayExtras }>) {
  const { t, language } = useLanguage();
  const { pressureDrop6h, aqi, pollens } = extras;
  const now = t('summary.health.now');
  return (
    <>
      {pressureDrop6h !== null && (
        <Row
          icon={TrendingDown}
          tone="amber"
          title={fill(t('summary.health.pressure'), { d: fmtSigned(pressureDrop6h) })}
        />
      )}
      {aqi !== null && aqi > SUMMARY_THRESHOLDS.aqiNotable && (
        <Row
          icon={Factory}
          tone="orange"
          title={fill(t('summary.health.air'), {
            label: getAqiInfo(aqi, language).label,
            n: Math.round(aqi),
          })}
          detail={now}
        />
      )}
      {pollens.length > 0 && (
        <Row
          icon={Flower2}
          tone="emerald"
          title={fill(t('summary.health.pollen'), {
            list: pollens
              .map(
                (p) =>
                  `${t('summary.pollen.' + p.name)} ${getPollenLevel(p.value, language)?.label.toLowerCase() ?? ''}`,
              )
              .join(', '),
          })}
          detail={now}
        />
      )}
    </>
  );
}
