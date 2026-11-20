import type { AirQualityData, WeatherData } from '../../types/weather';
import type { WakingWindow } from '../../types/weather';
import {
  buildDaySummary,
  buildOverview,
  getHighlights,
  RAIN_STRIP_HOURS,
  SUMMARY_THRESHOLDS,
  type DaySummary,
} from '../../utils/daySummary';
import type { TodayExtras } from './types';

const POLLENS: { key: keyof AirQualityData; name: string }[] = [
  { key: 'grassPollen', name: 'grass' },
  { key: 'birchPollen', name: 'birch' },
  { key: 'alderPollen', name: 'alder' },
  { key: 'mugwortPollen', name: 'mugwort' },
  { key: 'olivePollen', name: 'olive' },
  { key: 'ragweedPollen', name: 'ragweed' },
];

function pollenValues(aq: AirQualityData | null | undefined) {
  if (!aq) return [];
  return POLLENS.map((p) => ({ name: p.name, value: aq[p.key] })).filter(
    (p): p is { name: string; value: number } => typeof p.value === 'number',
  );
}

/** Everything the dialog and the hero teaser show, derived from the same inputs as before */
export function useSummaryModel({
  data,
  now,
  wakingWindow,
  timezone,
}: {
  data: WeatherData;
  now: number;
  wakingWindow: WakingWindow;
  timezone?: string;
}) {
  const summary: DaySummary = buildDaySummary({
    hours: data.summaryHours,
    daily: data.daily,
    timezone: data.timezone ?? timezone,
    now,
    wakingWindow,
    currentGusts: data.current.windGusts,
  });
  const aq = data.airQuality;
  const pollens = pollenValues(aq);
  const drop = data.pressureTrend?.delta6h;
  const pressureDrop6h =
    drop !== undefined && drop <= SUMMARY_THRESHOLDS.pressureDrop6h ? drop : null;
  const aqi = aq?.currentAqi ?? null;
  const health = {
    pressureDrop6h,
    aqi,
    maxPollen: pollens.length ? Math.max(...pollens.map((p) => p.value)) : null,
  };
  // Hero teaser: the rain strip already shows today's rain when it covers every remaining waking hour
  const highlights = getHighlights(summary, health, {
    omitTodayUmbrella:
      !!summary.today && summary.today.to - summary.today.from <= RAIN_STRIP_HOURS,
  });
  // Dialog headline: nothing is covered elsewhere, so today's umbrella may lead
  const dialogHighlights = getHighlights(summary, health);

  const overview = buildOverview(summary);
  const extras: TodayExtras = {
    pressureDrop6h,
    aqi,
    pollens: pollens.filter((p) => p.value > SUMMARY_THRESHOLDS.pollenNotable),
  };
  return { summary, highlights, dialogHighlights, overview, extras };
}
