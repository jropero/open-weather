import { useLanguage } from '../hooks/useLanguage';

interface SeasonalAttributionProps {
  variant: 'full' | 'compact';
  seas5Issue?: string | null;
}

const linkProps = { target: '_blank', rel: 'noopener noreferrer' } as const;

// Wording follows open-meteo.com/en/licence ("Weather data by Open-Meteo.com" + link) and the
// ECMWF Terms of Use for services created with ECMWF data (statement, source, CC BY 4.0, disclaimer, modifications).
export function SeasonalAttribution({ variant, seas5Issue }: SeasonalAttributionProps) {
  const { language, t } = useLanguage();

  if (variant === 'compact') {
    return (
      <p className="text-[10px] leading-snug text-slate-600">
        {t('seasonal.compact.source')}:{' '}
        <a href="https://open-meteo.com/" {...linkProps} className="font-bold underline underline-offset-2 hover:text-indigo-700">Open-Meteo.com</a>
        {' · '}
        <a href="https://www.ecmwf.int/" {...linkProps} className="font-bold underline underline-offset-2 hover:text-indigo-700">ECMWF</a> SEAS5
        {' · '}
        <a href="https://creativecommons.org/licenses/by/4.0/" {...linkProps} className="underline underline-offset-2 hover:text-indigo-700">CC BY 4.0</a>
      </p>
    );
  }

  const issue = seas5Issue
    ? new Date(`${seas5Issue}T00:00:00Z`).toLocaleDateString(language === 'en' ? 'en-GB' : 'es-ES', { month: 'short', year: 'numeric', timeZone: 'UTC' })
    : '—';

  return (
    <footer className="mt-4 pt-3 border-t border-white/10 text-[10px] leading-snug text-slate-200 flex flex-col gap-1">
      <p>
        <a href="https://open-meteo.com/" {...linkProps} className="font-bold text-white underline underline-offset-2 hover:text-sky-200">
          {t('seasonal.attr.data')}
        </a>
        {' · '}
        {t('seasonal.attr.models').replace('{issue}', issue)}
      </p>
      <p>
        {t('seasonal.attr.ecmwf')}{' '}
        <a href="https://www.ecmwf.int/" {...linkProps} className="underline underline-offset-2 hover:text-sky-200">www.ecmwf.int</a>.{' '}
        {t('seasonal.attr.licence')}{' '}
        <a href="https://creativecommons.org/licenses/by/4.0/" {...linkProps} className="underline underline-offset-2 hover:text-sky-200">CC BY 4.0</a>.{' '}
        {t('seasonal.attr.modified')} {t('seasonal.attr.disclaimer')}
      </p>
    </footer>
  );
}
