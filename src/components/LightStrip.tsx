import { CloudFog, Sun, SunDim } from 'lucide-react';
import { useLanguage } from '../hooks/useLanguage';
import type { HourRange } from '../utils/daySummary';
import {
  BRIGHT_LUX,
  buildLightOutlook,
  formatLux,
  type LightLevel,
  type LightOutlook,
  type LightStripHour,
  type LightVerdict,
} from '../utils/daylight';

// Hero light strip: outdoor illuminance estimate over the next daylight block — one sentence
// ("Best light 11–14h") over a log-scale bar per hour. Informational only (not a button).

interface Props {
  hours: Parameters<typeof buildLightOutlook>[0];
  now: number;
  timezone?: string | null;
}

type TFn = (k: string) => string;

const WRAP =
  'urgent-in block w-full max-w-sm mx-auto mb-3 rounded-2xl bg-white/10 border border-white/10 px-3 py-2 text-left text-white shadow-md backdrop-blur-md';

const pad = (h: number) => String(h).padStart(2, '0');
const fill = (s: string, vars: Record<string, string | number>) =>
  Object.entries(vars).reduce((acc, [k, v]) => acc.replaceAll(`{${k}}`, String(v)), s);

// Log scale: 500 lux → 8 %, 100 000 lux → 100 %
const LUX_MIN = 500;
const LUX_MAX = 100000;
const BAR_REGION_PX = 40;
const heightPct = (lux: number) => {
  const f = Math.log(Math.max(lux, LUX_MIN) / LUX_MIN) / Math.log(LUX_MAX / LUX_MIN);
  return Math.min(100, Math.max(8, 8 + f * 92));
};
const GUIDE_PX = Math.round((heightPct(BRIGHT_LUX) / 100) * BAR_REGION_PX);

const BAR_COLOR: Record<LightLevel, string> = {
  dark: 'bg-white/20',
  dim: 'bg-white/45',
  bright: 'bg-amber-300',
  very_bright: 'bg-yellow-200',
};

const HEAD_ICON = {
  bright: { Icon: Sun, cls: 'text-amber-300 bg-amber-300/20' },
  dim: { Icon: SunDim, cls: 'text-amber-100/70 bg-amber-100/10' },
  dark: { Icon: CloudFog, cls: 'text-slate-300 bg-slate-300/15' },
};

function HeadIcon({ verdict }: Readonly<{ verdict: LightVerdict }>) {
  const { Icon, cls } = HEAD_ICON[verdict];
  return (
    <span
      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${cls}`}
      aria-hidden="true"
    >
      <Icon size={15} />
    </span>
  );
}

function rangesText(o: LightOutlook, t: TFn): string {
  const text = o.brightRanges
    .map((r: HourRange, i) => {
      const from = i === 0 && o.startsNow ? t('rain.strip.now') : pad(r.from);
      return `${from}–${pad(r.to % 24)}h`;
    })
    .join(', ');
  return fill(t('light.best'), { r: text });
}

function headline(o: LightOutlook, lang: 'es' | 'en', t: TFn) {
  // Visible text always uses the compact "13k" form (same as the bar label); the sr text says "13 mil"
  const peak = formatLux(o.peakLux, lang, false);
  let main: string;
  if (o.verdict === 'bright') main = rangesText(o, t);
  else
    main = `${t(o.verdict === 'dim' ? 'light.grey' : 'light.dark')} · ${fill(t('light.peak'), { v: peak })}`;
  const text = o.day === 'tomorrow' ? fill(t('light.tomorrow'), { s: main }) : main;
  return { text, peak };
}

function Bar({ h }: Readonly<{ h: LightStripHour }>) {
  if (h.lux === null || h.level === null)
    return <span className="block w-full h-[2px] border-t border-dashed border-white/40" />;
  return (
    <span
      className={`block w-full rounded-t-sm ${BAR_COLOR[h.level]}`}
      style={{ height: `${Math.round((heightPct(h.lux) / 100) * BAR_REGION_PX)}px` }}
    />
  );
}

function PeakLabel({ show, text }: Readonly<{ show: boolean; text: string }>) {
  if (!show) return null;
  return (
    <span className="mb-[2px] block text-[9px] font-bold leading-none tabular-nums whitespace-nowrap opacity-90">
      {text}
    </span>
  );
}

function Bars({ o, lang }: Readonly<{ o: LightOutlook; lang: 'es' | 'en' }>) {
  return (
    <span className="relative mt-2 flex items-end gap-[3px] h-[54px]" aria-hidden="true">
      <span
        className="pointer-events-none absolute left-0 right-0 border-t border-dashed border-white/30"
        style={{ bottom: GUIDE_PX }}
      />
      <span
        className="pointer-events-none absolute right-0 text-[8px] leading-none opacity-50"
        style={{ bottom: GUIDE_PX + 2 }}
      >
        10k
      </span>
      {o.hours.map((h) => (
        <span
          key={h.ms}
          className="relative flex-1 h-full flex flex-col justify-end items-center"
        >
          <PeakLabel show={h === o.peakHour} text={formatLux(o.peakLux, lang, false)} />
          <Bar h={h} />
        </span>
      ))}
    </span>
  );
}

function HourLabels({ hours }: Readonly<{ hours: LightStripHour[] }>) {
  return (
    <span
      className="mt-0.5 flex gap-[3px] text-[10px] font-semibold opacity-70 tabular-nums"
      aria-hidden="true"
    >
      {hours.map((h, i) => (
        <span key={h.ms} className="flex-1 text-left whitespace-nowrap">
          {i % 3 === 0 && pad(h.hour)}
        </span>
      ))}
    </span>
  );
}

export function LightStrip({ hours, now, timezone }: Readonly<Props>) {
  const { t, language } = useLanguage();
  const outlook = buildLightOutlook(hours, now, timezone);
  if (!outlook) return null;
  const { text, peak } = headline(outlook, language, t);
  const sr = fill(t('light.sr'), {
    s: text,
    v: formatLux(outlook.peakLux, language),
    h: pad(outlook.peakHour.hour),
  });
  const showPeak = outlook.verdict === 'bright';

  return (
    <section data-light-strip title={t('light.title')} className={WRAP}>
      <span className="sr-only">{sr}</span>
      <span
        className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5"
        aria-hidden="true"
      >
        <span className="flex items-center gap-1.5 text-base font-bold leading-tight">
          <HeadIcon verdict={outlook.verdict} />
          <span>{text}</span>
        </span>
        {showPeak && (
          <span className="shrink-0 text-[11px] leading-tight opacity-70">
            {fill(t('light.peak'), { v: peak })}
          </span>
        )}
      </span>
      <Bars o={outlook} lang={language} />
      <HourLabels hours={outlook.hours} />
    </section>
  );
}
