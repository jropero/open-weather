import type { LucideIcon } from 'lucide-react';

export type Tone =
  | 'sky'
  | 'teal'
  | 'orange'
  | 'red'
  | 'amber'
  | 'blue'
  | 'indigo'
  | 'emerald'
  | 'yellow'
  | 'purple'
  | 'violet'
  | 'cyan'
  | 'slate';

// One soft tinted chip per meaning (icon colour = meaning, never decoration)
export const TONE_CHIP: Record<Tone, string> = {
  sky: 'bg-sky-50 text-sky-600',
  teal: 'bg-teal-50 text-teal-600',
  orange: 'bg-orange-50 text-orange-600',
  red: 'bg-red-50 text-red-600',
  amber: 'bg-amber-50 text-amber-600',
  blue: 'bg-blue-50 text-blue-600',
  indigo: 'bg-indigo-50 text-indigo-600',
  emerald: 'bg-emerald-50 text-emerald-600',
  yellow: 'bg-yellow-50 text-yellow-600',
  purple: 'bg-purple-50 text-purple-600',
  violet: 'bg-violet-50 text-violet-600',
  cyan: 'bg-cyan-50 text-cyan-600',
  slate: 'bg-slate-100 text-slate-500',
};

export const TONE_TEXT: Record<Tone, string> = {
  sky: 'text-sky-600',
  teal: 'text-teal-600',
  orange: 'text-orange-600',
  red: 'text-red-600',
  amber: 'text-amber-600',
  blue: 'text-blue-600',
  indigo: 'text-indigo-600',
  emerald: 'text-emerald-600',
  yellow: 'text-yellow-600',
  purple: 'text-purple-600',
  violet: 'text-violet-600',
  cyan: 'text-cyan-600',
  slate: 'text-slate-500',
};

export function IconChip({ icon: Icon, tone }: Readonly<{ icon: LucideIcon; tone: Tone }>) {
  return (
    <span
      aria-hidden="true"
      className={`flex size-8 shrink-0 items-center justify-center rounded-xl ${TONE_CHIP[tone]}`}
    >
      <Icon size={18} strokeWidth={1.75} />
    </span>
  );
}
