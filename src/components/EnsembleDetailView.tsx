import { useEffect, useMemo, useRef, useState } from 'react';
import { X, Thermometer, type LucideIcon } from 'lucide-react';
import type { Location, SeasonalPeriod, SeasonalVariable } from '../types/weather';
import { useLanguage } from '../hooks/useLanguage';
import { useNow } from '../hooks/useNow';
import { hasMeaningfulRow } from '../utils/seasonal';
import { ensembleDaysInWeek } from '../utils/ensembleStats';
import { CHART_HEIGHT, VARS, type Tab } from './ensemble/chartParts';
import { CombinedBody } from './ensemble/CombinedBody';
import { SingleBody } from './ensemble/SingleBody';

const SINGLE_CHART_HEIGHT = 220;

interface Props {
  location: Location;
  period: SeasonalPeriod;
  weekIndex: number; // 0-based (0 = "Semana 1")
  initialVariable: SeasonalVariable;
  lowConfidence: boolean;
  onClose: () => void;
}

const INITIAL_TAB: Partial<Record<SeasonalVariable, Tab>> = {
  pressure: 'pressure_msl',
  snowfall: 'snowfall',
};
const initialTab = (v: SeasonalVariable): Tab => INITIAL_TAB[v] ?? 'combined';

export function EnsembleDetailView({
  location,
  period,
  weekIndex,
  initialVariable,
  lowConfidence,
  onClose,
}: Props) {
  const { language, t } = useLanguage();
  const now = useNow();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [tab, setTab] = useState<Tab>(initialTab(initialVariable));
  const weeks = useMemo(() => [period], [period]);

  useEffect(() => {
    const el = dialogRef.current;
    if (el && !el.open) el.showModal();
  }, []);

  // Snowfall tab only where the outlook itself shows a snow signal (hidden in Santo Domingo…)
  const vars = useMemo(
    () =>
      VARS.filter(
        (v) =>
          v.key !== 'snowfall' ||
          initialVariable === 'snowfall' ||
          hasMeaningfulRow('snowfall', [period]),
      ),
    [initialVariable, period],
  );
  const locale = language === 'en' ? 'en-GB' : 'es-ES';
  const fmtDate = (d: string, opts: Intl.DateTimeFormatOptions) =>
    new Date(`${d}T00:00:00Z`).toLocaleDateString(locale, { ...opts, timeZone: 'UTC' });
  const weekLabel = `${t('ensemble.week')} ${weekIndex + 1}: ${fmtDate(period.start, { day: 'numeric' })}–${fmtDate(period.end, { day: 'numeric', month: 'short' })}`;
  const coveredDays = ensembleDaysInWeek(period.start, now);
  const activeMeta = vars.find((v) => v.key === tab);

  const tabs: { key: Tab; label: string; Icon: LucideIcon }[] = [
    { key: 'combined', label: t('ensemble.var.combined'), Icon: Thermometer },
    ...vars.map((v) => ({ key: v.key, label: t(v.labelKey), Icon: v.Icon })),
  ];

  return (
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/click-events-have-key-events
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) e.currentTarget.close();
      }}
      aria-labelledby="ensemble-detail-title"
      className="open:flex flex-col w-full max-w-none sm:max-w-2xl max-h-[92dvh] m-0 mt-auto sm:m-auto p-0 rounded-t-3xl sm:rounded-3xl bg-slate-950 text-white shadow-2xl overflow-hidden backdrop:bg-black/70 backdrop:backdrop-blur-sm"
    >
      <header className="flex items-start justify-between gap-3 px-5 py-4 bg-slate-900 shrink-0 border-b border-white/10">
        <div className="min-w-0">
          <h2
            id="ensemble-detail-title"
            className="text-base font-bold leading-tight text-white"
          >
            {weekLabel}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {location.name}
            {coveredDays > 0 && coveredDays < 7 && (
              <> · {t('ensemble.coverage').replace('{n}', String(coveredDays))}</>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={() => dialogRef.current?.close()}
          aria-label={t('summary.close')}
          className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors shrink-0"
        >
          <X size={18} />
        </button>
      </header>

      <div className="flex gap-1 px-4 pt-4 pb-2 shrink-0 overflow-x-auto">
        {tabs.map((v) => {
          const active = v.key === tab;
          return (
            <button
              key={v.key}
              type="button"
              onClick={() => setTab(v.key)}
              aria-pressed={active}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all duration-200 ${active ? 'bg-white text-slate-900 shadow' : 'bg-white/10 text-slate-300 hover:bg-white/15'}`}
            >
              <v.Icon size={12} className="shrink-0" aria-hidden="true" />
              {v.label}
            </button>
          );
        })}
      </div>

      {lowConfidence && (
        <div className="px-4 pt-1 shrink-0">
          <div className="bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] rounded-lg px-3 py-1.5">
            {t('ensemble.low_confidence').replace('{week}', String(weekIndex + 1))}
          </div>
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-5">
        {tab === 'combined' || !activeMeta ? (
          <CombinedBody
            location={location}
            weekStart={period.start}
            weeks={weeks}
            chartHeight={CHART_HEIGHT}
          />
        ) : (
          <SingleBody
            key={tab}
            location={location}
            weekStart={period.start}
            weeks={weeks}
            chartHeight={SINGLE_CHART_HEIGHT}
            meta={activeMeta}
          />
        )}
      </div>
    </dialog>
  );
}
