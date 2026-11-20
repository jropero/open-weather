import { useState } from 'react';
import type { WeatherData } from '../types/weather';
import { useLanguage } from '../hooks/useLanguage';
import {
  formatLeadTime,
  type FrostType,
  type NightType,
  type WindAlert,
} from '../utils/heroAlerts';

// Hero alert tiles. Every tile is "icon + short word" over its value, ranked by severity; only the
// top MAX_VISIBLE are shown (2 rows on a 360 px phone), the rest sit behind a "+N more" toggle.
// Tapping a tile opens the Today & Tomorrow dialog; the title tooltip (desktop only) adds 3h/6h detail.

interface Props {
  pressureTrend: WeatherData['pressureTrend'];
  tempDelta3h: number | null;
  tempDelta6h: number | null;
  windAlert: WindAlert | null;
  nightType: NightType | null;
  frostType: FrostType | null;
  stormPotential: { level: string; label: string } | null;
  isFog: boolean;
  weatherCode: number;
  /** Opens the Today & Tomorrow dialog (tooltips don't exist on touch screens) */
  onOpenDetails?: () => void;
}

interface Chip {
  key: string;
  severity: number; // higher = shown first
  cls: string;
  emoji: string;
  label: string;
  value?: string;
  title?: string;
}

const MAX_VISIBLE = 4;

const TILE =
  'min-w-0 rounded-2xl py-1.5 px-3 text-left text-xs border shadow-md backdrop-blur-md text-white transition-colors hover:brightness-110 outline-none focus-visible:ring-2 focus-visible:ring-white/70';

const NEUTRAL = 'bg-white/20 border-white/10';
const AMBER = 'bg-amber-500/30 border-amber-400/40';
const RED = 'bg-red-500/30 border-red-400/40';

const arrow = (n: number) => (n > 0 ? '↑' : '↓');
const abs1 = (n: number) => Math.abs(Math.round(n * 10) / 10);

// eslint-disable-next-line sonarjs/cognitive-complexity
function pressureChip(
  trend: NonNullable<WeatherData['pressureTrend']>,
  isEn: boolean,
): Chip | null {
  const use6h = Math.abs(trend.delta6h) >= 3;
  if (!use6h && Math.abs(trend.delta3h) < 2) return null;
  const d = use6h ? trend.delta6h : trend.delta3h;
  const span = use6h ? 6 : 3;
  let severity = 15;
  let cls = NEUTRAL;
  const drop = trend.delta6h <= -3;
  if (trend.delta6h <= -5) [severity, cls] = [72, RED];
  else if (drop) [severity, cls] = [58, AMBER];
  const sharpEn = ' · significant 6h drop (main migraine trigger)';
  const sharpEs = ' · caída severa en 6h (principal riesgo)';
  let sharp = '';
  if (drop) sharp = isEn ? sharpEn : sharpEs;
  return {
    key: 'pressure',
    severity,
    cls,
    emoji: '🧭',
    label: isEn ? 'Pressure' : 'Presión',
    value: `${arrow(d)}${abs1(d)} hPa ${isEn ? `past ${span}h` : `últ. ${span}h`}${drop ? ' ⚡' : ''}`,
    title: isEn
      ? `Last 3h: ${trend.delta3h} hPa · last 6h: ${trend.delta6h} hPa${sharp}`
      : `Últimas 3h: ${trend.delta3h} hPa · últimas 6h: ${trend.delta6h} hPa${sharp}`,
  };
}

// eslint-disable-next-line sonarjs/cognitive-complexity
function tempChip(d3: number | null, d6: number | null, isEn: boolean): Chip | null {
  const d = d6 ?? d3;
  if (d === null || abs1(d) === 0) return null;
  const span = d6 === null ? 3 : 6;
  let severity = 10;
  let cls = NEUTRAL;
  if (d >= 3) [severity, cls] = [45, RED];
  else if (d <= -3) [severity, cls] = [45, 'bg-sky-500/30 border-sky-400/40'];
  else if (d > 0) cls = AMBER;
  return {
    key: 'temp',
    severity,
    cls,
    emoji: '🌡️',
    label: 'Temp',
    value: `${arrow(d)}${abs1(d)}° ${isEn ? `next ${span}h` : `próx. ${span}h`}`,
    title: isEn
      ? `Next 3h: ${d3 ?? '—'}°C · next 6h: ${d6 ?? '—'}°C`
      : `Próximas 3h: ${d3 ?? '—'}°C · próximas 6h: ${d6 ?? '—'}°C`,
  };
}

const WIND: Record<
  WindAlert['level'],
  { severity: number; cls: string; emoji: string; es: string; en: string }
> = {
  storm: {
    severity: 95,
    cls: 'bg-red-600/40 border-red-400/50',
    emoji: '🌪️',
    es: 'Borrasca',
    en: 'Storm',
  },
  gale: {
    severity: 80,
    cls: 'bg-orange-500/35 border-orange-400/45',
    emoji: '💨',
    es: 'Vendaval',
    en: 'Gale',
  },
  strong: { severity: 55, cls: AMBER, emoji: '🌬️', es: 'Viento fuerte', en: 'Strong wind' },
  breezy: {
    severity: 25,
    cls: 'bg-teal-500/25 border-teal-400/35',
    emoji: '🌬️',
    es: 'Ventoso',
    en: 'Breezy',
  },
};

const NIGHT: Record<NightType, { severity: number; cls: string; emoji: string }> = {
  ecuatorial: { severity: 65, cls: 'bg-purple-500/30 border-purple-400/40', emoji: '🌊' },
  torrida: { severity: 62, cls: RED, emoji: '🔥' },
  tropical: { severity: 35, cls: 'bg-amber-500/20 border-amber-400/30', emoji: '🌙' },
};

const FROST: Record<
  FrostType,
  { severity: number; cls: string; emoji: string; es: string; en: string }
> = {
  ice: {
    severity: 90,
    cls: 'bg-cyan-900/40 border-cyan-400/40',
    emoji: '🧊',
    es: 'Hielo esta noche',
    en: 'Ice tonight',
  },
  frost: {
    severity: 60,
    cls: 'bg-slate-700/40 border-slate-400/30',
    emoji: '🌨️',
    es: 'Riesgo helada',
    en: 'Frost risk',
  },
};

const STORM: Record<string, { severity: number; cls: string }> = {
  extreme: { severity: 100, cls: 'bg-red-600/30 border-red-400/40' },
  strong: { severity: 75, cls: 'bg-orange-500/30 border-orange-400/40' },
  moderate: { severity: 50, cls: 'bg-yellow-400/20 border-yellow-400/40' },
};

// eslint-disable-next-line sonarjs/cognitive-complexity
function buildChips(p: Props, isEn: boolean, t: (k: string) => string): Chip[] {
  const chips: Chip[] = [];
  const push = (c: Chip | null) => c && chips.push(c);

  if (p.pressureTrend) push(pressureChip(p.pressureTrend, isEn));
  push(tempChip(p.tempDelta3h, p.tempDelta6h, isEn));
  if (p.windAlert) {
    const w = WIND[p.windAlert.level] ?? WIND.breezy;
    push({
      key: 'wind',
      severity: w.severity,
      cls: w.cls,
      emoji: w.emoji,
      label: isEn ? w.en : w.es,
      value: `${p.windAlert.gusts} km/h ${formatLeadTime(p.windAlert.minutesFromNow, isEn)}`,
    });
  }
  if (p.nightType) {
    const n = NIGHT[p.nightType];
    push({
      key: 'night',
      severity: n.severity,
      cls: n.cls,
      emoji: n.emoji,
      label: t(`label.night_${p.nightType}`),
    });
  }
  if (p.frostType) {
    const f = FROST[p.frostType];
    push({
      key: 'frost',
      severity: f.severity,
      cls: f.cls,
      emoji: f.emoji,
      label: isEn ? f.en : f.es,
    });
  }
  if (p.stormPotential) {
    const s = STORM[p.stormPotential.level] ?? {
      severity: 20,
      cls: 'bg-sky-400/20 border-sky-400/30',
    };
    push({
      key: 'storm',
      severity: s.severity,
      cls: s.cls,
      emoji: '⛈️',
      label: isEn ? 'Storm' : 'Tormenta',
      value: p.stormPotential.label,
    });
  }
  if (p.isFog) {
    const rime = p.weatherCode === 48;
    const fog = rime ? { es: 'Niebla helada', en: 'Rime fog' } : { es: 'Niebla', en: 'Fog' };
    push({
      key: 'fog',
      severity: rime ? 48 : 40,
      cls: 'bg-zinc-500/30 border-zinc-400/40',
      emoji: '🌫️',
      label: isEn ? fog.en : fog.es,
    });
  }
  // Stable sort: equal severity keeps the order above (trends → wind → conditions). Rain lives in RainStrip.
  return chips.sort((a, b) => b.severity - a.severity);
}

const SINGLE_TILE =
  'col-span-2 justify-self-center w-fit max-w-full rounded-2xl py-1 px-2.5 text-left text-xs border shadow-md backdrop-blur-md text-white transition-colors hover:brightness-110 outline-none focus-visible:ring-2 focus-visible:ring-white/70';

function Tile({
  chip: c,
  single,
  spanBoth,
  onClick,
}: Readonly<{ chip: Chip; single: boolean; spanBoth: boolean; onClick?: () => void }>) {
  if (single)
    return (
      <button
        type="button"
        onClick={onClick}
        aria-haspopup="dialog"
        title={c.title}
        className={`${SINGLE_TILE} ${c.cls}`}
      >
        <span aria-hidden="true">{c.emoji}</span>{' '}
        <span className="font-bold opacity-90">{c.label}</span>
        {c.value && <span className="font-black tabular-nums"> · {c.value}</span>}
      </button>
    );
  return (
    <button
      type="button"
      onClick={onClick}
      aria-haspopup="dialog"
      title={c.title}
      className={`${TILE} ${c.cls} ${spanBoth ? 'col-span-2 w-[calc(50%-0.25rem)] justify-self-center' : ''}`}
    >
      <span className="flex items-center gap-1.5 font-bold">
        <span aria-hidden="true">{c.emoji}</span>
        <span className="truncate opacity-90">{c.label}</span>
      </span>
      {c.value && <span className="block font-black tabular-nums truncate">{c.value}</span>}
    </button>
  );
}

export function AlertBadges(props: Props) {
  const { language, t } = useLanguage();
  const [expanded, setExpanded] = useState(false);
  const chips = buildChips(props, language === 'en', t);
  if (!chips.length) return null;

  // Never hide just one chip behind a toggle — show it instead
  const cap = chips.length > MAX_VISIBLE + 1 ? MAX_VISIBLE : chips.length;
  const visible = expanded ? chips : chips.slice(0, cap);
  const hidden = chips.length - cap;

  // 2-column tiles (mobile-first): icon + word on top, value below. An odd last tile spans both columns.
  // A lone tile is compact, centered and fitted to its content (label and value on one line).
  const single = visible.length === 1 && hidden === 0;
  return (
    <div className="grid grid-cols-2 gap-2 mt-3 w-full max-w-sm mx-auto">
      {visible.map((c, i) => (
        <Tile
          key={c.key}
          chip={c}
          single={single}
          spanBoth={i === visible.length - 1 && i % 2 === 0}
          onClick={props.onOpenDetails}
        />
      ))}
      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
          className="col-span-2 justify-self-center rounded-full py-1 px-3 text-xs font-bold text-white/80 hover:text-white hover:bg-white/10"
        >
          {expanded
            ? t('hero.chips.less')
            : t('hero.chips.more').replace('{n}', String(hidden))}
        </button>
      )}
    </div>
  );
}
