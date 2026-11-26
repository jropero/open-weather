import { useEffect, useMemo, useRef, useState } from 'react';
import { X, Thermometer, Smartphone, type LucideIcon } from 'lucide-react';
import type { Location, SeasonalPeriod } from '../types/weather';
import { useLanguage } from '../hooks/useLanguage';
import { useNow } from '../hooks/useNow';
import { useOrientationPrompt } from '../hooks/useOrientationPrompt';
import { hasMeaningfulRow } from '../utils/seasonal';
import { VARS, type SingleVarMeta, type Tab } from './ensemble/chartParts';
import { CombinedBody } from './ensemble/CombinedBody';
import { SingleBody } from './ensemble/SingleBody';
import { ensembleDaysInWeek } from '../utils/ensembleStats';

interface Props {
  location: Location;
  /** Every EC46 week of the outlook (the ones overlapping the ensemble window are used). */
  weeks: SeasonalPeriod[];
  onClose: () => void;
}

// Fills the viewport under the one-row header (caption + x axis + legend margins included);
// never smaller than 240 px, the body scrolls instead.
const CHART_HEIGHT = 'max(240px, calc(100dvh - 8rem))';

function RotatePrompt({ onShowAnyway }: { onShowAnyway: () => void }) {
  const { t } = useLanguage();
  return (
    <div className="flex flex-col items-center justify-center gap-4 h-full min-h-64 text-center px-6">
      <Smartphone size={48} className="text-sky-300 range-rotate-hint" aria-hidden="true" />
      <p className="text-base font-bold text-white">{t('ensemble.range.rotate')}</p>
      <button
        type="button"
        onClick={onShowAnyway}
        className="px-4 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-xs font-bold text-slate-200 transition-colors"
      >
        {t('ensemble.range.show_anyway')}
      </button>
    </div>
  );
}

function RangeBody({
  tab,
  meta,
  location,
  weeks,
  portrait,
}: {
  tab: Tab;
  meta: SingleVarMeta | undefined;
  location: Location;
  weeks: SeasonalPeriod[];
  portrait: boolean;
}) {
  const common = { location, weekStart: null, weeks, chartHeight: CHART_HEIGHT, range: true };
  const body =
    tab === 'combined' || !meta ? (
      <CombinedBody {...common} />
    ) : (
      <SingleBody key={tab} {...common} meta={meta} />
    );
  if (!portrait) return body;
  // Forced portrait scrolls sideways instead of squeezing 360 hourly points
  return (
    <div className="overflow-x-auto">
      <div style={{ minWidth: 720 }}>{body}</div>
    </div>
  );
}

export function EnsembleRangeView({ location, weeks, onClose }: Props) {
  const { t } = useLanguage();
  const now = useNow();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [tab, setTab] = useState<Tab>('combined');
  const { prompt, portrait, dismiss } = useOrientationPrompt();
  // A forced portrait view scrolls sideways instead of squeezing 360 hourly points
  const [forcedPortrait, setForcedPortrait] = useState(false);
  // Back in landscape the chart fits again: no sideways scroller, full height
  const squeezed = forcedPortrait && portrait;

  useEffect(() => {
    const el = dialogRef.current;
    if (el && !el.open) el.showModal();
  }, []);

  // Weeks overlapping the ensemble window (always a prefix of the outlook weeks)
  const rangeWeeks = useMemo(
    () => weeks.filter((w) => ensembleDaysInWeek(w.start, now) > 0),
    [weeks, now],
  );
  const vars = useMemo(
    () => VARS.filter((v) => v.key !== 'snowfall' || hasMeaningfulRow('snowfall', rangeWeeks)),
    [rangeWeeks],
  );
  const activeMeta = vars.find((v) => v.key === tab);
  const tabs: { key: Tab; label: string; Icon: LucideIcon }[] = [
    { key: 'combined', label: t('ensemble.var.combined'), Icon: Thermometer },
    ...vars.map((v) => ({ key: v.key, label: t(v.labelKey), Icon: v.Icon })),
  ];

  const showAnyway = () => {
    setForcedPortrait(true);
    dismiss();
  };

  return (
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/click-events-have-key-events
    <dialog
      ref={dialogRef}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) e.currentTarget.close();
      }}
      aria-labelledby="ensemble-range-title"
      className="open:flex flex-col w-screen h-[100dvh] max-w-none max-h-none m-0 p-0 rounded-none bg-slate-950 text-white overflow-hidden backdrop:bg-black/70"
      style={{
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
      }}
    >
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2 bg-slate-900 shrink-0 border-b border-white/10">
        <h2
          id="ensemble-range-title"
          className="text-sm font-bold leading-tight text-white shrink-0"
        >
          {t('ensemble.range.title')}
        </h2>
        <span className="text-xs text-slate-400 truncate min-w-0 max-w-40">
          {location.name}
        </span>
        <div className="flex gap-1 overflow-x-auto order-last w-full sm:order-none sm:w-auto sm:flex-1 sm:justify-center">
          {tabs.map((v) => {
            const active = v.key === tab;
            return (
              <button
                key={v.key}
                type="button"
                onClick={() => setTab(v.key)}
                aria-pressed={active}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-all duration-200 ${active ? 'bg-white text-slate-900 shadow' : 'bg-white/10 text-slate-300 hover:bg-white/15'}`}
              >
                <v.Icon size={12} className="shrink-0" aria-hidden="true" />
                {v.label}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => dialogRef.current?.close()}
          aria-label={t('summary.close')}
          className="p-1.5 bg-white/10 hover:bg-white/20 rounded-full transition-colors shrink-0 ml-auto sm:ml-0"
        >
          <X size={18} />
        </button>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-5">
        {prompt ? (
          <RotatePrompt onShowAnyway={showAnyway} />
        ) : (
          <RangeBody
            tab={tab}
            location={location}
            weeks={rangeWeeks}
            meta={activeMeta}
            portrait={squeezed}
          />
        )}
      </div>
    </dialog>
  );
}
