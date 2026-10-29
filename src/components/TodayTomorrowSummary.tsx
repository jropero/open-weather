import { useRef, type ReactNode } from 'react';
import { ChevronRight, ListChecks, X } from 'lucide-react';
import type { AirQualityData, WeatherData } from '../types/weather';
import { useLanguage } from '../hooks/useLanguage';
import { DEFAULT_WAKING_WINDOW, useWakingWindow } from '../hooks/useWakingWindow';
import { getAqiInfo, getPollenLevel, type GustLevel } from '../utils/weatherCodes';
import {
  buildDaySummary, getHighlights, getTomorrowMigraine, SUMMARY_THRESHOLDS,
  type DayPart, type Highlight, type HourRange, type NightNote, type UmbrellaVerdict,
} from '../utils/daySummary';

interface MigraineResult {
  score: number;
  label: string;
  detail: string;
}

interface TodayTomorrowSummaryProps {
  data: WeatherData;
  now: number;
  todayMigraine: MigraineResult; // the hero MIGR bar — reused so the summary can't disagree with it
  placeName: string;
  timezone?: string;
}

const POLLENS: { key: keyof AirQualityData; name: string }[] = [
  { key: 'grassPollen', name: 'grass' },
  { key: 'birchPollen', name: 'birch' },
  { key: 'alderPollen', name: 'alder' },
  { key: 'mugwortPollen', name: 'mugwort' },
  { key: 'olivePollen', name: 'olive' },
  { key: 'ragweedPollen', name: 'ragweed' },
];

const WIND_ICON: Record<GustLevel, string> = { storm: '🌪️', gale: '💨', strong: '🌬️', breezy: '🌬️' };

const pad = (h: number) => String(h).padStart(2, '0');
const fmtRange = (r: HourRange) => `${pad(r.from)}–${pad(r.to)}h`;
const fmtRanges = (rs: HourRange[]) => rs.map(fmtRange).join(', ');
const fmtSigned = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n)}`;
const fill = (s: string, vars: Record<string, string | number>) =>
  Object.entries(vars).reduce((acc, [k, v]) => acc.replaceAll(`{${k}}`, String(v)), s);
const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// Adjective depends on how warm tomorrow feels: "colder" in the cold, "hotter" in the heat
function feltKey(delta: number, feltMax: number) {
  if (delta < 0) return feltMax < 10 ? 'colder' : 'cooler';
  if (feltMax >= 25) return 'hotter';
  return feltMax < 10 ? 'milder' : 'warmer';
}

function umbrellaIcon(u: UmbrellaVerdict) {
  if (u.level === 'none') return '🌂';
  if (u.thunder) return '⛈️';
  return u.kind === 'snow' ? '❄️' : u.kind === 'rain' ? '☂️' : '🌨️';
}

function Row({ icon, title, detail, aside, muted }: { icon: string; title: string; detail?: string; aside?: string; muted?: boolean }) {
  return (
    <li className="flex items-start gap-3 py-2">
      <span aria-hidden="true" className={`text-lg leading-6 w-6 text-center shrink-0 ${muted ? 'opacity-50' : ''}`}>{icon}</span>
      <div className="flex-1 min-w-0">
        <p className={`text-sm leading-6 ${muted ? 'text-slate-500 font-medium' : 'text-slate-800 font-semibold'}`}>{title}</p>
        {detail && <p className="text-xs text-slate-500 leading-snug">{detail}</p>}
      </div>
      {aside && <span className="text-sm font-bold text-slate-700 tabular-nums whitespace-nowrap leading-6">{aside}</span>}
    </li>
  );
}

export function TodayTomorrowSummary({ data, now, todayMigraine, placeName, timezone }: TodayTomorrowSummaryProps) {
  const { language, t } = useLanguage();
  const { wakingWindow, setWakingWindow } = useWakingWindow();
  const dialogRef = useRef<HTMLDialogElement>(null);

  const summary = buildDaySummary({
    hours: data.summaryHours,
    daily: data.daily,
    timezone: data.timezone ?? timezone,
    now,
    wakingWindow,
    currentGusts: data.current.windGusts,
  });

  // --- Health inputs, all from values the hero / widgets already show ---
  const aq = data.airQuality;
  const aqi = aq?.currentAqi ?? null;
  const pollenValues = aq ? POLLENS.map(p => ({ ...p, value: aq[p.key] })).filter((p): p is typeof p & { value: number } => p.value !== null) : [];
  const notablePollens = pollenValues.filter(p => p.value > SUMMARY_THRESHOLDS.pollenNotable);
  const maxPollen = pollenValues.length ? Math.max(...pollenValues.map(p => p.value)) : null;
  const pressureDrop6h = data.pressureTrend && data.pressureTrend.delta6h <= SUMMARY_THRESHOLDS.pressureDrop6h ? data.pressureTrend.delta6h : null;
  const tomorrowMigraine = getTomorrowMigraine(summary.todayDaily, summary.tomorrowDaily, language);

  const highlights = getHighlights(summary, {
    todayMigraine: todayMigraine.score,
    tomorrowMigraine: tomorrowMigraine?.score ?? null,
    pressureDrop6h,
    aqi,
    maxPollen,
  });

  // --- Wording ---
  const windLabel = (level: GustLevel) => t(`summary.wind.${level}`);

  const phrase = (h: Highlight): string => {
    const day = t(`summary.day.${h.day}`);
    switch (h.topic) {
      case 'umbrella': {
        const u = h.umbrella;
        const kind = u.level === 'take' && u.thunder && u.kind === 'rain' ? 'thunder' : u.kind;
        return fill(t(`summary.teaser.umbrella.${u.level}.${kind}`), { day, range: fmtRanges(u.ranges) });
      }
      case 'wind':
        return fill(t('summary.teaser.wind'), { level: windLabel(h.level), day, range: fmtRanges(h.ranges) });
      case 'felt':
        return fill(t(`summary.teaser.felt.${feltKey(h.delta, h.feltMax)}`), { n: fmtSigned(h.delta) });
      case 'migraine':
        return fill(t('summary.teaser.migraine'), { score: h.score, day });
      case 'pressure':
        return fill(t('summary.teaser.pressure'), { d: fmtSigned(h.delta) });
      case 'air':
        return fill(t('summary.teaser.air'), { label: getAqiInfo(h.aqi, language).label.toLowerCase() });
      case 'pollen':
        return t('summary.teaser.pollen');
      case 'calm':
        return [t(`summary.teaser.calm.${h.day}`), h.felt && fill(t('summary.teaser.calm_felt'), { ...h.felt })].filter(Boolean).join(' · ');
    }
  };
  const teaser = highlights.length ? capitalize(highlights.map(phrase).join(' · ')) : t('summary.teaser.none');

  const feltRows = (part: DayPart, day: 'today' | 'tomorrow'): ReactNode => {
    if (!part.felt) return <Row icon="🌡️" title={t('summary.felt.none')} muted />;
    const range = part.felt.min === part.felt.max
      ? fill(t('summary.felt.single'), { ...part.felt })
      : fill(t('summary.felt.range'), { ...part.felt });
    if (day === 'today') return <Row icon="🌡️" title={range} />;

    const { feltDelta, todayFelt } = summary;
    if (feltDelta === null || !todayFelt) return <Row icon="🌡️" title={range} detail={t('summary.felt.no_compare')} />;
    const n = Math.abs(feltDelta);
    const title = n < SUMMARY_THRESHOLDS.feltSimilar
      ? t('summary.felt.similar')
      : fill(t(`summary.felt.${feltKey(feltDelta, part.felt.max)}`), { n });
    const detail = fill(t('summary.felt.detail'), { ...part.felt, tmin: todayFelt.min, tmax: todayFelt.max });
    return <Row icon="🌡️" title={title} detail={detail} aside={n < SUMMARY_THRESHOLDS.feltSimilar ? undefined : `${fmtSigned(feltDelta)}°`} />;
  };

  const umbrellaRow = (part: DayPart): ReactNode => {
    const u = part.umbrella;
    if (!u) return <Row icon="🌂" title={t('summary.umbrella.no_data')} muted />;
    if (u.level === 'none') return <Row icon="🌂" title={t('summary.umbrella.none')} detail={t('summary.umbrella.none_detail')} />;
    const detail = [
      u.kind !== 'snow' && u.mm > 0 && `${u.mm} mm`,
      u.cm > 0 && `${u.cm} cm`,
      u.maxProb !== null && fill(t('summary.umbrella.prob'), { n: Math.round(u.maxProb) }),
      u.intermittent && t('summary.umbrella.intermittent'),
      u.thunder && t('summary.umbrella.thunder'),
    ].filter(Boolean).join(' · ');
    return <Row icon={umbrellaIcon(u)} title={t(`summary.umbrella.${u.level}.${u.kind}`)} detail={detail || undefined} aside={fmtRanges(u.ranges)} />;
  };

  // Calm (below the hero's "breezy") or no gust data → no row
  const windRow = (part: DayPart): ReactNode => {
    const w = part.wind;
    if (!w?.level) return null;
    return <Row icon={WIND_ICON[w.level]} title={fill(t('summary.wind.row'), { level: windLabel(w.level), g: w.gusts })} aside={fmtRanges(w.ranges)} />;
  };

  const healthRowsToday = (): ReactNode => {
    const rows: ReactNode[] = [];
    if (todayMigraine.score >= 2) {
      rows.push(<Row key="m" icon="🧠" title={fill(t('summary.health.migraine'), { label: todayMigraine.label, score: todayMigraine.score })} detail={`${todayMigraine.detail} · ${t('summary.health.now')}`} />);
    }
    if (pressureDrop6h !== null) {
      rows.push(<Row key="p" icon="📉" title={fill(t('summary.health.pressure'), { d: fmtSigned(pressureDrop6h) })} detail={t('summary.health.pressure_detail')} />);
    }
    if (aqi !== null && aqi > SUMMARY_THRESHOLDS.aqiNotable) {
      rows.push(<Row key="a" icon="🫁" title={fill(t('summary.health.air'), { label: getAqiInfo(aqi, language).label, n: Math.round(aqi) })} detail={t('summary.health.now')} />);
    }
    if (notablePollens.length) {
      const list = notablePollens.map(p => `${t(`summary.pollen.${p.name}`)} ${getPollenLevel(p.value, language)?.label.toLowerCase() ?? ''}`).join(', ');
      rows.push(<Row key="po" icon="🌿" title={fill(t('summary.health.pollen'), { list })} detail={t('summary.health.now')} />);
    }
    if (!rows.length) {
      const detail = [
        fill(t('summary.health.ok_migraine'), { score: todayMigraine.score }),
        aqi !== null && fill(t('summary.health.ok_air'), { label: getAqiInfo(aqi, language).label.toLowerCase() }),
      ].filter(Boolean).join(' · ');
      rows.push(<Row key="ok" icon="✅" title={t('summary.health.ok')} detail={detail} />);
    }
    if (aqi === null) rows.push(<Row key="aq" icon="🫁" title={t('summary.health.aq_none')} muted />);
    return rows;
  };

  const healthRowsTomorrow = (): ReactNode => (
    <>
      {!tomorrowMigraine
        ? <Row icon="🧠" title={t('summary.health.migraine_none')} muted />
        : tomorrowMigraine.score >= 2
          ? <Row icon="🧠" title={fill(t('summary.health.migraine'), { label: tomorrowMigraine.label, score: tomorrowMigraine.score })} detail={tomorrowMigraine.detail} />
          : <Row icon="✅" title={t('summary.health.ok_tomorrow')} detail={fill(t('summary.health.ok_migraine'), { score: tomorrowMigraine.score })} />}
      <Row icon="🫁" title={t('summary.health.aq_tomorrow')} muted />
    </>
  );

  const nightLine = (note: NightNote | null, labelKey: string): ReactNode => {
    if (!note) return null;
    const p = note.precip;
    const parts = [
      p && (p.kind === 'freezing' ? t('summary.night.freezing') : fill(t(`summary.night.${p.kind}`), { mm: p.mm, cm: p.cm })),
      p && p.ranges.length > 0 && fmtRanges(p.ranges),
      note.wetMorning && t('summary.night.wet_morning'),
      note.thunder && t('summary.night.thunder'),
      note.wind && fill(t('summary.night.wind'), { level: windLabel(note.wind.level).toLowerCase(), g: note.wind.gusts }),
      note.frost && fill(t(`summary.night.${note.frost}`), { t: note.minTemp ?? '' }),
      note.warmNight && fill(t('summary.night.warm'), { label: t(`label.night_${note.warmNight}`).toLowerCase(), t: note.minTemp ?? '' }),
    ].filter(Boolean);
    return (
      <p className="flex items-start gap-2 text-xs text-slate-400 leading-snug py-1.5 pl-0.5">
        <span aria-hidden="true">🌙</span>
        <span>
          <span className="font-semibold text-slate-500">{t(labelKey)} ({fmtRange(note)}):</span> {parts.join(' · ')}
        </span>
      </p>
    );
  };

  const section = (day: 'today' | 'tomorrow', part: DayPart | null, before?: ReactNode, after?: ReactNode) => (
    <section aria-labelledby={`summary-${day}`} className="py-3 first:pt-0">
      <h3 id={`summary-${day}`} className="text-xs uppercase tracking-widest font-bold text-slate-500 mb-1">
        {t(`summary.${day}`)} {part && <span className="text-slate-400 tabular-nums normal-case tracking-normal">({fmtRange(part)})</span>}
      </h3>
      {before}
      {part ? (
        <ul className="divide-y divide-slate-100">
          {feltRows(part, day)}
          {umbrellaRow(part)}
          {windRow(part)}
          {day === 'today' ? healthRowsToday() : healthRowsTomorrow()}
        </ul>
      ) : (
        <p className="text-sm text-slate-500 py-2">{t('summary.no_data_day')}</p>
      )}
      {after}
    </section>
  );

  const hourOptions = (from: number, to: number) =>
    Array.from({ length: to - from + 1 }, (_, i) => from + i).map(h => <option key={h} value={h}>{pad(h)}:00</option>);
  const isDefaultWindow = wakingWindow.start === DEFAULT_WAKING_WINDOW.start && wakingWindow.end === DEFAULT_WAKING_WINDOW.end;
  const selectClass = 'bg-slate-100 border border-slate-200 rounded-lg px-2 py-1.5 text-sm font-semibold text-slate-800 tabular-nums focus:outline-none focus:ring-2 focus:ring-indigo-400';

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        aria-haspopup="dialog"
        className="mx-auto mb-1 flex items-center gap-1.5 max-w-full bg-white/15 hover:bg-white/25 border border-white/20 rounded-2xl py-1.5 pl-3 pr-2 text-sm font-semibold text-white text-left backdrop-blur-md shadow-md transition-colors outline-none focus-visible:ring-2 focus-visible:ring-white/70"
      >
        <ListChecks size={16} className="shrink-0 opacity-80" aria-hidden="true" />
        <span className="sr-only">{t('summary.title')}: </span>
        <span>{teaser}</span>
        <ChevronRight size={16} className="shrink-0 opacity-70" aria-hidden="true" />
      </button>

      {/* Native modal dialog: focus trap, Escape and focus return come from the browser */}
      <dialog
        ref={dialogRef}
        aria-labelledby="summary-title"
        onClick={e => { if (e.target === e.currentTarget) e.currentTarget.close(); }}
        className="open:flex flex-col w-full max-w-none sm:max-w-md max-h-[88dvh] m-0 mt-auto sm:m-auto p-0 rounded-t-3xl sm:rounded-3xl bg-white text-slate-800 shadow-2xl overflow-hidden backdrop:bg-black/60 backdrop:backdrop-blur-sm"
      >
        <header className="flex items-start justify-between gap-3 px-5 py-4 bg-slate-900 text-white shrink-0">
          <div className="min-w-0">
            <h2 id="summary-title" className="text-lg font-bold leading-tight">{t('summary.title')}</h2>
            <p className="text-[11px] text-slate-400 font-semibold mt-0.5">{fill(t('summary.local_time'), { place: placeName })}</p>
          </div>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            aria-label={t('summary.close')}
            className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            <X size={18} />
          </button>
        </header>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 divide-y divide-slate-200">
          {!summary.today && !summary.tomorrow ? (
            <p className="text-sm text-slate-500">{t('summary.no_data')}</p>
          ) : (
            <>
              {summary.today
                ? section('today', summary.today, nightLine(summary.earlyNight, 'summary.night.early'))
                : <p className="text-xs text-slate-500 pb-3">{t('summary.today_over')}</p>}
              {section('tomorrow', summary.tomorrow, nightLine(summary.night, 'summary.night.overnight'))}
            </>
          )}
        </div>

        <footer className="shrink-0 border-t border-slate-200 bg-slate-50 px-5 py-3">
          <fieldset>
            <legend className="text-xs uppercase tracking-widest font-bold text-slate-500 mb-2">{t('summary.window.title')}</legend>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <label className="flex items-center gap-1.5 text-sm text-slate-600">
                {t('summary.window.from')}
                <select
                  className={selectClass}
                  value={wakingWindow.start}
                  onChange={e => {
                    const start = Number(e.target.value);
                    setWakingWindow({ start, end: Math.max(wakingWindow.end, start + 1) });
                  }}
                >
                  {hourOptions(0, 23)}
                </select>
              </label>
              <label className="flex items-center gap-1.5 text-sm text-slate-600">
                {t('summary.window.to')}
                <select
                  className={selectClass}
                  value={wakingWindow.end}
                  onChange={e => setWakingWindow({ start: wakingWindow.start, end: Number(e.target.value) })}
                >
                  {hourOptions(wakingWindow.start + 1, 24)}
                </select>
              </label>
              {!isDefaultWindow && (
                <button
                  type="button"
                  onClick={() => setWakingWindow(DEFAULT_WAKING_WINDOW)}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-800 underline underline-offset-2"
                >
                  {t('summary.window.reset')}
                </button>
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-2 leading-snug">{t('summary.window.hint')}</p>
          </fieldset>
        </footer>
      </dialog>
    </>
  );
}
