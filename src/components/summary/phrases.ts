import { getAqiInfo } from '../../utils/weatherCodes';
import {
  feltAdjective,
  type DayKey,
  type Highlight,
  type UmbrellaVerdict,
} from '../../utils/daySummary';
import type { Language } from '../../hooks/useLanguage';
import { capitalize, fill, fmtRanges, fmtSigned, type Translate } from './format';

function umbrellaPhrase(u: UmbrellaVerdict, day: string, t: Translate) {
  const kind = u.level === 'take' && u.thunder && u.kind === 'rain' ? 'thunder' : u.kind;
  return fill(t(`summary.teaser.umbrella.${u.level}.${kind}`), {
    day,
    range: fmtRanges(u.ranges),
  });
}

function calmPhrase(day: DayKey, felt: { min: number; max: number } | null, t: Translate) {
  const felts = felt && fill(t('summary.teaser.calm_felt'), { ...felt });
  return [t(`summary.teaser.calm.${day}`), felts].filter(Boolean).join(' · ');
}

/** The teaser wording of one highlight (shared by the hero button and the dialog headline) */
export function highlightPhrase(h: Highlight, t: Translate, language: Language): string {
  const day = t(`summary.day.${h.day}`);
  switch (h.topic) {
    case 'umbrella':
      return umbrellaPhrase(h.umbrella, day, t);
    case 'wind':
      return fill(t('summary.teaser.wind'), {
        level: t(`summary.wind.${h.level}`),
        day,
        range: fmtRanges(h.ranges),
      });
    case 'felt':
      return fill(t(`summary.teaser.felt.${feltAdjective(h.delta, h.feltMax)}`), {
        n: fmtSigned(h.delta),
        day,
      });
    case 'pressure':
      return fill(t('summary.teaser.pressure'), { d: fmtSigned(h.delta) });
    case 'air':
      return fill(t('summary.teaser.air'), {
        label: getAqiInfo(h.aqi, language).label.toLowerCase(),
      });
    case 'pollen':
      return t('summary.teaser.pollen');
    case 'calm':
      return calmPhrase(h.day, h.felt, t);
  }
}

export const phraseLines = (hs: Highlight[], t: Translate, language: Language) =>
  hs.map((h) => capitalize(highlightPhrase(h, t, language)));
