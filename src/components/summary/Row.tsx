import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { IconChip, type Tone } from './IconChip';

interface RowProps {
  icon: LucideIcon;
  tone: Tone;
  title: string;
  detail?: string;
  /** Right-aligned value (time range, delta chip …) */
  value?: ReactNode;
  /** Long values go on their own line under the title instead of squeezing it */
  time?: string;
  muted?: boolean;
  /** The one fact that matters most for the day */
  strong?: boolean;
}

const LONG_TIME = 13;

function titleClass({ muted, strong }: Pick<RowProps, 'muted' | 'strong'>) {
  if (muted) return 'text-slate-500 font-medium';
  return strong ? 'text-slate-900 font-bold' : 'text-slate-800 font-semibold';
}

function RowText({ title, detail, time, muted, strong }: Readonly<RowProps>) {
  return (
    <div className="min-w-0">
      <p className={`text-sm leading-snug ${titleClass({ muted, strong })}`}>{title}</p>
      {time && (
        <p className="text-xs font-semibold text-slate-600 tabular-nums leading-snug">{time}</p>
      )}
      {detail && <p className="text-xs text-slate-500 leading-snug">{detail}</p>}
    </div>
  );
}

export function Row(props: Readonly<RowProps>) {
  const { icon, tone, value, time, muted } = props;
  const inline = time !== undefined && time.length <= LONG_TIME;
  const under = time !== undefined && !inline ? time : undefined;
  return (
    <li className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-start gap-3 py-2.5">
      <div className={muted ? 'opacity-60' : undefined}>
        <IconChip icon={icon} tone={tone} />
      </div>
      <RowText {...props} time={under} />
      <div className="text-right text-sm font-bold text-slate-700 tabular-nums whitespace-nowrap leading-8">
        {value ?? (inline ? time : null)}
      </div>
    </li>
  );
}
