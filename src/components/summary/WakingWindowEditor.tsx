import { useId, useState } from 'react';
import { ChevronDown, Clock } from 'lucide-react';
import { useLanguage } from '../../hooks/useLanguage';
import { DEFAULT_WAKING_WINDOW } from '../../hooks/useWakingWindow';
import type { WakingWindow } from '../../types/weather';
import { fill, pad } from './format';

const selectClass =
  'bg-slate-100 border border-slate-200 rounded-lg px-2 py-1.5 text-sm font-semibold text-slate-800 tabular-nums focus:outline-none focus:ring-2 focus:ring-indigo-400';

function HourSelect({
  label,
  value,
  from,
  to,
  onChange,
}: Readonly<{
  label: string;
  value: number;
  from: number;
  to: number;
  onChange: (h: number) => void;
}>) {
  return (
    <label className="flex items-center gap-1.5 text-sm text-slate-600">
      {label}
      <select
        className={selectClass}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      >
        {Array.from({ length: to - from + 1 }, (_, i) => from + i).map((h) => (
          <option key={h} value={h}>
            {pad(h)}:00
          </option>
        ))}
      </select>
    </label>
  );
}

function ResetButton({ onClick }: Readonly<{ onClick: () => void }>) {
  const { t } = useLanguage();
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-xs font-bold text-indigo-600 hover:text-indigo-800 underline underline-offset-2"
    >
      {t('summary.window.reset')}
    </button>
  );
}

export function WakingWindowEditor({
  wakingWindow,
  setWakingWindow,
}: Readonly<{ wakingWindow: WakingWindow; setWakingWindow: (w: WakingWindow) => void }>) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const isDefault =
    wakingWindow.start === DEFAULT_WAKING_WINDOW.start &&
    wakingWindow.end === DEFAULT_WAKING_WINDOW.end;
  return (
    <footer className="shrink-0 border-t border-slate-100 bg-slate-50 px-5 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-xs font-semibold text-slate-600 tabular-nums">
          <Clock size={14} strokeWidth={1.75} className="text-slate-400" aria-hidden="true" />
          {fill(t('summary.window.line'), {
            start: pad(wakingWindow.start),
            end: pad(wakingWindow.end),
          })}
        </p>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold text-indigo-600 outline-none hover:text-indigo-800 focus-visible:ring-2 focus-visible:ring-indigo-400"
        >
          {t(open ? 'summary.window.hide' : 'summary.window.change')}
          <ChevronDown
            size={14}
            strokeWidth={2}
            aria-hidden="true"
            className={`transition-transform duration-300 motion-reduce:transition-none ${open ? 'rotate-180' : ''}`}
          />
        </button>
      </div>
      <div
        id={panelId}
        inert={!open}
        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none ${open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
      >
        <div className="min-h-0 overflow-hidden">
          <fieldset className="pt-3 pb-1">
            <legend className="sr-only">{t('summary.window.title')}</legend>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <HourSelect
                label={t('summary.window.from')}
                value={wakingWindow.start}
                from={0}
                to={23}
                onChange={(start) =>
                  setWakingWindow({ start, end: Math.max(wakingWindow.end, start + 1) })
                }
              />
              <HourSelect
                label={t('summary.window.to')}
                value={wakingWindow.end}
                from={wakingWindow.start + 1}
                to={24}
                onChange={(end) => setWakingWindow({ start: wakingWindow.start, end })}
              />
              {!isDefault && (
                <ResetButton onClick={() => setWakingWindow(DEFAULT_WAKING_WINDOW)} />
              )}
            </div>
            <p className="mt-2 text-[11px] leading-snug text-slate-400">
              {t('summary.window.hint')}
            </p>
          </fieldset>
        </div>
      </div>
    </footer>
  );
}
