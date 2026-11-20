import { Sunrise, Sunset } from 'lucide-react';
import { useLanguage } from '../hooks/useLanguage';
import { formatClock, nextSunEvent } from '../utils/heroAlerts';

/** Next sun event in the location's local time: "Atardece 16:52" by day, "Amanece 07:48" at night. */
export function SunEventLine({
  daily,
  now,
  timezone,
}: Readonly<{
  daily: ReadonlyArray<{ sunrise?: string; sunset?: string }>;
  now: number;
  timezone?: string;
}>) {
  const { t } = useLanguage();
  const ev = nextSunEvent(daily, now);
  if (!ev) return null;
  const Icon = ev.kind === 'sunrise' ? Sunrise : Sunset;
  const text = t(`hero.sun.${ev.kind}`).replace('{time}', formatClock(ev.at, timezone));
  return (
    <p className="flex items-center justify-center gap-1 text-sm font-medium opacity-80 -mt-3 mb-4 whitespace-nowrap">
      <Icon size={15} strokeWidth={2} aria-hidden="true" />
      <span>{text}</span>
    </p>
  );
}
