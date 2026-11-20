import { useRef, type RefObject } from 'react';
import { X } from 'lucide-react';
import type { WeatherData } from '../types/weather';
import { useLanguage } from '../hooks/useLanguage';
import { useWakingWindow } from '../hooks/useWakingWindow';
import { DialogBody } from './summary/DialogBody';
import { fill, pad } from './summary/format';
import { Teaser } from './summary/Teaser';
import { useSummaryModel } from './summary/useSummaryModel';
import { WakingWindowEditor } from './summary/WakingWindowEditor';

interface TodayTomorrowSummaryProps {
  data: WeatherData;
  now: number;
  placeName: string;
  timezone?: string;
  /** Lets the hero alert tiles open this dialog too */
  dialogRef?: RefObject<HTMLDialogElement | null>;
}

export function TodayTomorrowSummary({
  data,
  now,
  placeName,
  timezone,
  dialogRef: externalRef,
}: Readonly<TodayTomorrowSummaryProps>) {
  const { t } = useLanguage();
  const { wakingWindow, setWakingWindow } = useWakingWindow();
  const ownRef = useRef<HTMLDialogElement>(null);
  const dialogRef = externalRef ?? ownRef;
  const model = useSummaryModel({ data, now, wakingWindow, timezone });
  const { summary, highlights } = model;
  const hasData = !!(summary.today ?? summary.tomorrow ?? summary.dayAfterTomorrow);

  return (
    <>
      <Teaser
        highlights={highlights}
        overview={model.overview}
        onOpen={() => dialogRef.current?.showModal()}
      />

      {/* Native modal dialog: focus trap, Escape and focus return come from the browser */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/click-events-have-key-events */}
      <dialog
        ref={dialogRef}
        aria-labelledby="summary-title"
        onClick={(e) => {
          if (e.target === e.currentTarget) e.currentTarget.close();
        }}
        className="open:flex flex-col w-full max-w-none sm:max-w-md max-h-[88dvh] text-left m-0 mt-auto sm:m-auto p-0 rounded-t-3xl sm:rounded-3xl bg-white text-slate-800 shadow-2xl overflow-hidden backdrop:bg-black/60 backdrop:backdrop-blur-sm"
      >
        <header className="flex items-start justify-between gap-3 px-5 py-4 bg-slate-900 text-white shrink-0">
          <div className="min-w-0">
            <h2 id="summary-title" className="text-lg font-bold leading-tight">
              {t('summary.title')}
            </h2>
            <p className="text-[11px] text-slate-400 font-semibold mt-0.5 tabular-nums">
              {fill(t('summary.subtitle'), {
                place: placeName,
                start: pad(wakingWindow.start),
                end: pad(wakingWindow.end),
              })}
            </p>
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

        <div className="flex-1 min-h-0 overflow-y-auto px-5 pb-5">
          {hasData ? (
            <DialogBody
              summary={summary}
              highlights={model.dialogHighlights}
              overview={model.overview}
              extras={model.extras}
            />
          ) : (
            <p className="text-sm text-slate-500">{t('summary.no_data')}</p>
          )}
        </div>

        <WakingWindowEditor wakingWindow={wakingWindow} setWakingWindow={setWakingWindow} />
      </dialog>
    </>
  );
}
