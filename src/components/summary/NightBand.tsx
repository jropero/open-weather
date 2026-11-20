import { Moon } from 'lucide-react';
import { useLanguage } from '../../hooks/useLanguage';
import { buildNightChips, type NightChip, type NightNote } from '../../utils/daySummary';
import { fill, fmtRange, fmtRanges } from './format';
import { TONE_TEXT, type Tone } from './IconChip';

const CHIP_TONE: Record<NightChip['tone'], Tone> = {
  rain: 'sky',
  wind: 'teal',
  cold: 'blue',
  warm: 'orange',
  storm: 'violet',
};

function NightChipView({ chip }: Readonly<{ chip: NightChip }>) {
  const { t } = useLanguage();
  const vars = { ...chip.vars };
  for (const [name, key] of Object.entries(chip.varKeys)) vars[name] = t(key).toLowerCase();
  const text = fill(t(chip.labelKey), vars);
  return (
    <li
      className={`rounded-full border border-indigo-100 bg-white px-2.5 py-1 text-xs font-semibold tabular-nums leading-4 ${TONE_TEXT[CHIP_TONE[chip.tone]]}`}
    >
      {chip.ranges.length > 0 ? `${text} · ${fmtRanges(chip.ranges)}` : text}
    </li>
  );
}

/** Night side notes between two days: never affect the verdicts */
export function NightBand({
  note,
  labelKey,
  delay = 0,
}: Readonly<{ note: NightNote | null; labelKey: string; delay?: number }>) {
  const { t } = useLanguage();
  const chips = note ? buildNightChips(note) : [];
  if (!note || chips.length === 0) return null;
  return (
    <div
      className="summary-rise rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-slate-50 px-3 py-3"
      style={{ animationDelay: `${delay}ms` }}
    >
      <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-indigo-950">
        <span
          aria-hidden="true"
          className="flex size-6 items-center justify-center rounded-full bg-indigo-100 text-indigo-600"
        >
          <Moon size={14} strokeWidth={1.75} />
        </span>
        <span>
          {t(labelKey)}{' '}
          <span className="tabular-nums text-indigo-700/80">({fmtRange(note)})</span>
        </span>
      </p>
      <ul className="flex flex-wrap gap-1.5">
        {chips.map((chip) => (
          <NightChipView key={chip.id} chip={chip} />
        ))}
      </ul>
    </div>
  );
}
