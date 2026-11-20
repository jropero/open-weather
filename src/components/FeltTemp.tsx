import { useLanguage } from '../hooks/useLanguage';

interface FeltTempProps {
  /** Felt temperature in °C; null/undefined (e.g. old cached data) hides the element. */
  value: number | null | undefined;
}

/** Small "feels like" reading shown between the hero temperature and the weather icon. */
export function FeltTemp({ value }: Readonly<FeltTempProps>) {
  const { t } = useLanguage();
  if (value == null || !Number.isFinite(value)) return null;
  const n = String(Math.round(value));
  const label = t('hero.felt.label').replace('{n}', n);
  return (
    <div className="flex flex-col items-center gap-0.5 leading-none" title={label}>
      <span className="sr-only">{label}</span>
      <span
        className="text-[9px] font-bold tracking-widest opacity-75 uppercase"
        aria-hidden="true"
      >
        {t('hero.felt')}
      </span>
      <span className="text-base font-bold tabular-nums" aria-hidden="true">
        {n}°
      </span>
    </div>
  );
}
