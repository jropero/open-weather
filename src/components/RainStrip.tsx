import type { ReactNode } from 'react';
import { Cloud, CloudMoon, CloudSun, Moon, Sun } from 'lucide-react';
import type { SummaryHour } from '../types/weather';
import { useLanguage } from '../hooks/useLanguage';
import {
  buildRainOutlook,
  type HourRange,
  type RainOutlook,
  type RainStripHour,
  type UmbrellaVerdict,
} from '../utils/daySummary';

// Hero rain strip: one sentence ("Take an umbrella · 12–13h, 18–23h") over a bar per hour for the
// next RAIN_STRIP_HOURS hours — height = mm, opacity = probability. Tap opens the Today & Tomorrow dialog.
// Dry: shows a "clear" variant (clear spells + total sun hours when any) if any hour is sun/partly/moon, else nothing. Uses the same umbrella rules as the dialog, but on a fixed 12 h window instead of the waking window.

interface Props {
  hours: SummaryHour[];
  now: number;
  timezone?: string | null;
  onOpenDetails?: () => void;
}

const pad = (h: number) => String(h).padStart(2, '0');
const fill = (s: string, vars: Record<string, string | number>) =>
  Object.entries(vars).reduce((acc, [k, v]) => acc.replaceAll(`{${k}}`, String(v)), s);

// Square-root scale: drizzle still reads as rain (≥ 25 %), 2.5 mm/h and more fills the bar
const MM_FULL = 2.5;
const barHeight = (mm: number) => Math.max(25, Math.min(100, Math.sqrt(mm / MM_FULL) * 100));
// Bars are sized in px against this fixed region; the label sits above it in extra headroom
const BAR_REGION_PX = 40;

// < 10 mm → one decimal, ≥ 10 → integer; a wet hour never shows "0.0"
const fmtMm = (mm: number) =>
  mm >= 10 ? String(Math.round(mm)) : Math.max(0.1, mm).toFixed(1);

const BAR_COLOR: Record<NonNullable<RainStripHour['kind']>, string> = {
  rain: 'bg-sky-300',
  snow: 'bg-white',
  freezing: 'bg-indigo-300',
};

const WRAP =
  'block w-full max-w-sm mx-auto mb-3 rounded-2xl bg-white/10 border border-white/10 px-3 py-2 text-left text-white shadow-md backdrop-blur-md hover:bg-white/15 outline-none focus-visible:ring-2 focus-visible:ring-white/70';

function icon(u: UmbrellaVerdict) {
  if (u.thunder) return '⛈️';
  if (u.kind === 'snow') return '❄️';
  if (u.kind === 'rain') return '☂️';
  return '🌨️';
}

function Bar({ h }: Readonly<{ h: RainStripHour }>) {
  // Missing data is drawn dashed, never as a dry hour
  if (h.mm === null)
    return <span className="block w-full h-[2px] border-t border-dashed border-white/40" />;
  if (h.kind === null)
    return <span className="block w-full h-[2px] rounded-full bg-white/25" />;
  const opacity = h.prob === null ? 1 : 0.3 + (0.7 * h.prob) / 100;
  return (
    <span
      className={`block w-full rounded-t-sm ${BAR_COLOR[h.kind]}`}
      style={{ height: `${Math.round((barHeight(h.mm) / 100) * BAR_REGION_PX)}px`, opacity }}
    />
  );
}

const SKY_ICON = {
  sun: { Icon: Sun, cls: 'text-amber-300' },
  partly: { Icon: CloudSun, cls: 'text-amber-300' },
  cloud: { Icon: Cloud, cls: 'text-slate-200 opacity-70' },
  moon: { Icon: Moon, cls: 'text-indigo-200' },
  moon_partly: { Icon: CloudMoon, cls: 'text-indigo-200' },
};

// Compact (11 px, 12 px row) above the bars; large (16 px) when the icons are the only content
function SkyMark({ sky, size }: Readonly<{ sky: RainStripHour['sky']; size: number }>) {
  const entry = sky && SKY_ICON[sky];
  return (
    <span className="flex items-center justify-center" style={{ height: size + 1 }}>
      {entry && <entry.Icon size={size} className={entry.cls} aria-hidden="true" />}
    </span>
  );
}

function Bars({ hours }: Readonly<{ hours: RainStripHour[] }>) {
  return (
    <span className="flex items-end gap-[3px] h-[54px]" aria-hidden="true">
      {hours.map((h, i) => (
        <span
          key={h.ms}
          className={`flex-1 h-full flex flex-col justify-end items-center ${i === 0 ? 'border-l border-white/60 pl-[2px]' : ''}`}
        >
          <MmLabel h={h} />
          <Bar h={h} />
        </span>
      ))}
    </span>
  );
}

function MmLabel({ h }: Readonly<{ h: RainStripHour }>) {
  if (h.kind === null || h.mm === null) return null;
  return (
    <span className="mb-[2px] block text-[9px] font-bold leading-none tabular-nums whitespace-nowrap opacity-90">
      {fmtMm(h.mm)}
    </span>
  );
}

// "now–14h, from 18h · on and off · with thunder" — a spell running past the strip has no end hour
function spellText(
  r: HourRange,
  fromNow: boolean,
  openEnd: boolean,
  t: (k: string) => string,
): string {
  if (fromNow && openEnd) return t('rain.strip.all');
  const from = fromNow ? t('rain.strip.now') : `${pad(r.from)}h`;
  if (openEnd) return fill(t('rain.strip.from'), { h: from });
  return `${fromNow ? from : pad(r.from)}–${pad(r.to % 24)}h`;
}

interface Spells {
  ranges: HourRange[];
  intermittent: boolean;
  thunder: boolean;
  startsNow: boolean;
}

function whenText(outlook: RainOutlook, u: Spells, t: (k: string) => string) {
  const stripEnd = ((outlook.hours.at(-1)?.hour ?? 0) + 1) % 24;
  const last = u.ranges.length - 1;
  const ranges = u.ranges
    .map((r, i) =>
      spellText(r, i === 0 && u.startsNow, i === last && r.to % 24 === stripEnd, t),
    )
    .join(', ');
  return [
    ranges,
    u.intermittent && t('summary.umbrella.intermittent'),
    u.thunder && t('summary.umbrella.thunder'),
  ]
    .filter(Boolean)
    .join(' · ');
}

interface Summary {
  head: ReactNode;
  lead: string; // aria-label prefix
  when: string;
  total: string | null;
  totalLabel: string;
}

type TFn = (k: string) => string;

function rainSummary(outlook: RainOutlook, u: UmbrellaVerdict, t: TFn): Summary {
  const title = t(`summary.umbrella.${u.level}.${u.kind}`);
  return {
    head: (
      <>
        <span aria-hidden="true">{icon(u)}</span>
        <span className="truncate">{title}</span>
      </>
    ),
    lead: `${title}: `,
    when: whenText(outlook, { ...u, startsNow: outlook.startsNow }, t),
    total: u.kind === 'snow' && outlook.cm > 0 ? `${outlook.cm} cm` : `${outlook.mm} mm`,
    totalLabel: fill(t('rain.strip.total'), { n: outlook.hours.length }),
  };
}

const HEADER_ICON = {
  sun: { Icon: Sun, cls: 'text-amber-300' },
  moon: { Icon: Moon, cls: 'text-indigo-200' },
  partly: { Icon: CloudSun, cls: 'text-amber-300' },
  moon_partly: { Icon: CloudMoon, cls: 'text-indigo-200' },
};

function ClearIcon({ sky }: Readonly<{ sky: RainOutlook['headerSky'] }>) {
  if (!sky) return null;
  const { Icon, cls } = HEADER_ICON[sky];
  return <Icon size={18} className={`shrink-0 ${cls}`} aria-hidden="true" />;
}

function sunSummary(outlook: RainOutlook, t: TFn): Summary {
  const word = t(`rain.strip.${outlook.clearLevel === 'clear' ? 'clear' : 'mixed'}`);
  const spells = {
    ranges: outlook.clearRanges,
    intermittent: outlook.clearIntermittent,
    thunder: false,
    startsNow: outlook.clearStartsNow,
  };
  return {
    head: (
      <>
        <ClearIcon sky={outlook.headerSky} />
        <span className="truncate">{word}</span>
      </>
    ),
    lead: `${word} `,
    when: whenText(outlook, spells, t),
    // Night-only clear window: no sun total
    total: outlook.sunHours > 0 ? `${outlook.sunHours} h` : null,
    totalLabel: fill(t('rain.strip.sun_total'), { n: outlook.hours.length }),
  };
}

function summarize(outlook: RainOutlook, t: TFn): Summary | null {
  const { umbrella } = outlook;
  if (umbrella && umbrella.level !== 'none') return rainSummary(outlook, umbrella, t);
  return outlook.clearRanges.length > 0 ? sunSummary(outlook, t) : null;
}

export function RainStrip({ hours, now, timezone, onOpenDetails }: Readonly<Props>) {
  const { t } = useLanguage();
  const outlook = buildRainOutlook({ hours, now, timezone });
  if (!outlook) return null;

  if (!outlook.umbrella)
    return <p className="mb-3 text-sm font-semibold opacity-80">{t('rain.strip.no_data')}</p>;

  const summary = summarize(outlook, t);
  if (!summary) return null;
  const { when, total, totalLabel } = summary;
  const sunOnly = outlook.umbrella.level === 'none'; // dry-sunny variant: icons + hour labels only

  return (
    <button
      type="button"
      onClick={onOpenDetails}
      aria-haspopup="dialog"
      data-rain-strip
      aria-label={`${summary.lead}${when}.${total ? ` ${total} ${totalLabel}` : ''}`}
      className={WRAP}
    >
      <span className="flex items-start justify-between gap-3">
        <span className="min-w-0">
          <span className="flex items-center gap-1.5 text-base font-bold leading-tight">
            {summary.head}
          </span>
          <span className="block text-sm font-semibold opacity-85 tabular-nums">{when}</span>
        </span>
        {total && (
          <span className="shrink-0 text-right leading-tight">
            <span className="block text-xl font-black tabular-nums">{total}</span>
            <span className="block text-[10px] opacity-70">{totalLabel}</span>
          </span>
        )}
      </span>

      {/* Bars are decorative — the sentence above carries the information */}
      <span className="mt-2 flex gap-[3px]" aria-hidden="true">
        {outlook.hours.map((h, i) => (
          <span
            key={h.ms}
            className={`flex-1 ${i === 0 ? 'border-l border-transparent pl-[2px]' : ''}`}
          >
            <SkyMark sky={h.sky} size={sunOnly ? 16 : 11} />
          </span>
        ))}
      </span>
      {!sunOnly && <Bars hours={outlook.hours} />}
      <span
        className="mt-0.5 flex gap-[3px] text-[10px] font-semibold opacity-70 tabular-nums"
        aria-hidden="true"
      >
        {outlook.hours.map((h, i) => (
          <span key={h.ms} className="flex-1 text-left whitespace-nowrap">
            {i === 0 ? t('rain.strip.now') : i % 3 === 0 && pad(h.hour)}
          </span>
        ))}
      </span>
    </button>
  );
}
