import { ChevronRight, Umbrella } from 'lucide-react';
import { useLanguage } from '../../hooks/useLanguage';
import { type DayOverview, type Highlight } from '../../utils/daySummary';
import { getWeatherInfo } from '../../utils/weatherCodes';
import { fill } from './format';
import { TONE_CHIP } from './IconChip';
import { phraseLines } from './phrases';
import { teaserVisual } from './teaserVisual';

const BUTTON =
  'group block w-full max-w-sm mx-auto mb-3 rounded-2xl bg-white/10 border border-white/10 px-3 py-2 text-left text-white shadow-md backdrop-blur-md transition duration-150 hover:bg-white/15 hover:brightness-110 active:scale-[0.99] outline-none focus-visible:ring-2 focus-visible:ring-white/70 motion-reduce:transition-none motion-reduce:active:scale-100';

function felt(o: DayOverview) {
  if (!o.felt) return '–';
  return o.felt.min === o.felt.max ? `${o.felt.min}°` : `${o.felt.min}–${o.felt.max}°`;
}

function TeaserDay({ o }: Readonly<{ o: DayOverview }>) {
  const { t, language } = useLanguage();
  const Icon = getWeatherInfo(o.weatherCode ?? 0, language).icon;
  const rainy = o.umbrella?.level === 'take' || o.umbrella?.level === 'maybe';
  return (
    <li className="min-w-0 flex flex-col items-center gap-1">
      <span className="text-[10px] font-bold uppercase leading-none tracking-wide text-white/70">
        {t(`summary.short.${o.day}`)}
      </span>
      <span className="flex items-center gap-1 text-sm font-bold leading-none tabular-nums">
        <Icon size={18} strokeWidth={1.5} aria-hidden="true" />
        {felt(o)}
      </span>
      {rainy && (
        <Umbrella
          size={12}
          strokeWidth={2}
          aria-hidden="true"
          className={o.umbrella?.level === 'take' ? 'text-sky-200' : 'text-sky-200/60'}
        />
      )}
    </li>
  );
}

function TeaserStrip({ items }: Readonly<{ items: DayOverview[] }>) {
  if (!items.length) return null;
  return (
    <ul
      aria-hidden="true"
      className={`mt-2 grid gap-1 border-t border-white/10 pt-2 ${items.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}
    >
      {items.map((o) => (
        <TeaserDay key={o.day} o={o} />
      ))}
    </ul>
  );
}

function TeaserHeadline({ highlights }: Readonly<{ highlights: Highlight[] }>) {
  const { t, language } = useLanguage();
  const { icon: Icon, tone } = teaserVisual(highlights[0]);
  const [first, ...rest] = phraseLines(highlights, t, language);
  return (
    <div className="mt-1.5 flex items-center gap-2.5">
      <span
        aria-hidden="true"
        className={`flex size-8 shrink-0 items-center justify-center rounded-full shadow-sm ring-2 ring-white/20 ${TONE_CHIP[tone]}`}
      >
        <Icon size={17} strokeWidth={1.75} />
      </span>
      <span className="min-w-0 text-balance">
        <span className="block text-sm font-bold leading-tight">
          {first ?? t('summary.teaser.none')}
        </span>
        {rest.map((line) => (
          <span
            key={line}
            className="mt-0.5 block text-xs font-medium leading-tight text-white/70"
          >
            {line}
          </span>
        ))}
      </span>
    </div>
  );
}

/** Hero teaser: label, the one thing to know, and a 3-day strip — all from the dialog's model */
export function Teaser({
  highlights,
  overview,
  onOpen,
}: Readonly<{ highlights: Highlight[]; overview: DayOverview[]; onOpen: () => void }>) {
  const { t, language } = useLanguage();
  const n = overview.length;
  const key = n === 1 ? 'summary.teaser.label.one' : 'summary.teaser.label';
  const label = n ? fill(t(key), { n }) : t('summary.title');
  return (
    <button type="button" onClick={onOpen} aria-haspopup="dialog" className={BUTTON}>
      <span className="sr-only">
        {t('summary.teaser.sr')}: {phraseLines(highlights, t, language).join('. ')}
      </span>
      <span aria-hidden="true" className="block">
        <span className="flex items-center justify-between text-[10px] font-bold uppercase leading-none tracking-wider text-white/70">
          {label}
          <ChevronRight
            size={14}
            className="transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
          />
        </span>
        <TeaserHeadline highlights={highlights} />
        <TeaserStrip items={overview} />
      </span>
    </button>
  );
}
