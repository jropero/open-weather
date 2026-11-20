import type { Highlight } from '../../utils/daySummary';
import { useLanguage } from '../../hooks/useLanguage';
import { phraseLines } from './phrases';

/** "The one thing to know": top highlight bold, an optional second one muted */
export function Headline({ highlights }: Readonly<{ highlights: Highlight[] }>) {
  const { t, language } = useLanguage();
  const [first, ...rest] = phraseLines(highlights, t, language);
  if (!first) return null;
  return (
    <div className="summary-rise">
      <p className="text-xl font-bold leading-snug text-slate-900 text-balance">{first}</p>
      {rest.map((line) => (
        <p key={line} className="mt-0.5 text-sm font-medium leading-snug text-slate-500">
          {line}
        </p>
      ))}
    </div>
  );
}
