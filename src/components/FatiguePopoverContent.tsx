import { useLanguage } from '../hooks/useLanguage';
import { getThomsDiscomfortIndex, getWindChillIndex } from '../utils/weatherCodes';

interface PopoverBodyProps {
  title: string;
  value: string;
  reasons: string[];
  footer: string;
  accentClass: string;
  bulletClass: string;
}

function PopoverBody({
  title,
  value,
  reasons,
  footer,
  accentClass,
  bulletClass,
}: Readonly<PopoverBodyProps>) {
  return (
    <>
      <span
        className={`font-bold border-b border-white/10 pb-1 mb-1 text-xs flex items-center justify-between ${accentClass}`}
      >
        <span>{title}</span>
        <span className="shrink-0 whitespace-nowrap pl-2">{value}</span>
      </span>
      <div className="flex flex-col gap-1.5 font-mono text-[10px]">
        {reasons.map((reason) => (
          <div key={reason} className="flex items-start gap-1">
            <span className={bulletClass}>•</span>
            <span>{reason}</span>
          </div>
        ))}
      </div>
      <span className="text-[10px] text-slate-400 mt-1 border-t border-white/10 pt-1">
        {footer}
      </span>
    </>
  );
}

interface FatiguePopoverContentProps {
  /** POLAR mode: explain the wind chill index instead of Thom's discomfort index. */
  polar: boolean;
  thom: ReturnType<typeof getThomsDiscomfortIndex>;
  windChill: ReturnType<typeof getWindChillIndex> | null;
}

/** Body of the popover on the hero's right gauge (FAT. = Thom, POLAR = wind chill). */
export function FatiguePopoverContent({
  polar,
  thom,
  windChill,
}: Readonly<FatiguePopoverContentProps>) {
  const { t } = useLanguage();
  if (polar && windChill) {
    return (
      <PopoverBody
        title={t('hero.wci.title')}
        value={`${Math.round(windChill.value)} · ${windChill.label}`}
        reasons={windChill.reasons}
        footer={t('hero.wci.footer')}
        accentClass="text-sky-300"
        bulletClass="text-sky-400"
      />
    );
  }
  return (
    <PopoverBody
      title={t('hero.thom.title')}
      value={`${thom.value.toFixed(1)} DI`}
      reasons={thom.reasons}
      footer={t('hero.thom.footer')}
      accentClass="text-indigo-300"
      bulletClass="text-indigo-400"
    />
  );
}
