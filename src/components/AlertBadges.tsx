import type { WeatherData } from '../types/weather';
import { useLanguage } from '../hooks/useLanguage';
import {
  formatLeadTime,
  type FrostType,
  type NightType,
  type PrecipOnset,
  type WindAlert,
} from '../utils/heroAlerts';

// Hero alert badges, grouped by category; each group is its own flex row so cities with many
// active alerts (Basel, Taipei) wrap into short rows instead of a long vertical stack.
// Markup and colours moved from App.tsx unchanged.

interface Props {
  pressureTrend: WeatherData['pressureTrend'];
  tempDelta3h: number | null;
  tempDelta6h: number | null;
  precipOnset: PrecipOnset | null;
  rain: { h3: number; h6: number; h24: number };
  windAlert: WindAlert | null;
  nightType: NightType | null;
  frostType: FrostType | null;
  stormPotential: { level: string; label: string } | null;
  isFog: boolean;
  weatherCode: number;
}

const BADGE =
  'rounded-full py-1.5 px-3 text-xs font-bold border flex items-center shadow-md backdrop-blur-md';

function delta6hBadgeClass(delta6h: number | undefined): string {
  if (delta6h === undefined || delta6h > -3)
    return 'bg-blue-500/20 border-blue-400/30 text-white';
  if (delta6h <= -5) return 'bg-red-500/30 border-red-400/40 text-white';
  return 'bg-amber-500/30 border-amber-400/40 text-white';
}

function tempDelta3hClass(d: number | null): string {
  if (d !== null && d > 0) return 'text-orange-200';
  if (d !== null && d < 0) return 'text-sky-200';
  return 'text-white';
}

function tempDelta6hBadgeClass(d: number | null): string {
  if (d !== null && d >= 3) return 'bg-red-500/30 border-red-400/40 text-white';
  if (d !== null && d > 0) return 'bg-amber-500/30 border-amber-400/40 text-white';
  return 'bg-white/20 border-white/10 text-white';
}

// eslint-disable-next-line sonarjs/cognitive-complexity
function precipBadge(onset: PrecipOnset, rainNext3h: number, isEn: boolean) {
  if (onset.type === 'snow')
    return {
      cls: 'bg-cyan-500/30 border-cyan-400/40',
      emoji: '❄️',
      text: isEn ? 'Snow' : 'Nieve',
    };
  if (onset.type === 'freezing')
    return {
      cls: 'bg-indigo-500/30 border-indigo-400/40',
      emoji: '🌨️',
      text: isEn ? 'Freezing' : 'Helada',
    };
  const mmh = rainNext3h / 3;
  let text: string;
  if (mmh >= 10) text = isEn ? 'Violent rain' : 'Torrencial';
  else if (mmh >= 2.5) text = isEn ? 'Heavy rain' : 'Fuerte';
  else if (mmh >= 0.5) text = isEn ? 'Moderate rain' : 'Moderada';
  else text = isEn ? 'Light rain' : 'Leve';
  return { cls: 'bg-blue-500/30 border-blue-400/40', emoji: '🌧️', text };
}

function amountBadgeClass(value: number, type: PrecipOnset['type']): string {
  if (!value) return 'bg-white/5 border-white/10 text-white/30';
  if (type === 'snow') return 'bg-cyan-500/20 border-cyan-400/30 text-cyan-200';
  if (type === 'freezing') return 'bg-indigo-500/20 border-indigo-400/30 text-indigo-200';
  return 'bg-blue-500/20 border-blue-400/30 text-blue-200';
}

// eslint-disable-next-line sonarjs/cognitive-complexity
function windBadge(level: WindAlert['level'], isEn: boolean) {
  switch (level) {
    case 'storm':
      return {
        cls: 'bg-red-600/40 border-red-400/50',
        emoji: '🌪️',
        text: isEn ? 'Storm' : 'Borrasca',
      };
    case 'gale':
      return {
        cls: 'bg-orange-500/35 border-orange-400/45',
        emoji: '💨',
        text: isEn ? 'Gale' : 'Vendaval',
      };
    case 'strong':
      return {
        cls: 'bg-amber-500/30 border-amber-400/40',
        emoji: '🌬️',
        text: isEn ? 'Strong wind' : 'Viento fuerte',
      };
    default:
      return {
        cls: 'bg-teal-500/25 border-teal-400/35',
        emoji: '🌬️',
        text: isEn ? 'Breezy' : 'Ventoso',
      };
  }
}

const NIGHT_BADGE: Record<NightType, { cls: string; emoji: string }> = {
  ecuatorial: { cls: 'bg-purple-500/30 border-purple-400/40 text-white', emoji: '🌊' },
  torrida: { cls: 'bg-red-500/30 border-red-400/40 text-white', emoji: '🔥' },
  tropical: { cls: 'bg-amber-500/20 border-amber-400/30 text-white', emoji: '🌙' },
};

const FROST_TEXT: Record<FrostType, { es: string; en: string }> = {
  ice: { es: 'Hielo esta noche', en: 'Ice tonight' },
  frost: { es: 'Riesgo helada', en: 'Frost risk' },
};

const FOG_TEXT = {
  rime: { es: 'Niebla helada', en: 'Rime fog' },
  fog: { es: 'Niebla', en: 'Fog' },
};

function stormBadgeClass(level: string): string {
  if (level === 'extreme') return 'bg-red-600/30 border-red-400/40 text-white';
  if (level === 'strong') return 'bg-orange-500/30 border-orange-400/40 text-white';
  if (level === 'moderate') return 'bg-yellow-400/20 border-yellow-400/40 text-white';
  return 'bg-sky-400/20 border-sky-400/30 text-white';
}

const signed = (n: number) => `${n > 0 ? '+' : ''}${n}`;

// eslint-disable-next-line sonarjs/cognitive-complexity
export function AlertBadges({
  pressureTrend,
  tempDelta3h,
  tempDelta6h,
  precipOnset,
  rain,
  windAlert,
  nightType,
  frostType,
  stormPotential,
  isFog,
  weatherCode,
}: Props) {
  const { language, t } = useLanguage();
  const isEn = language === 'en';

  const showP3 = !!pressureTrend && Math.abs(pressureTrend.delta3h) >= 2;
  const showP6 = !!pressureTrend && Math.abs(pressureTrend.delta6h) >= 3;
  const showTrends = showP3 || showP6 || tempDelta3h !== null || tempDelta6h !== null;
  const precip = precipOnset ? precipBadge(precipOnset, rain.h3, isEn) : null;
  const wind = windAlert ? windBadge(windAlert.level, isEn) : null;

  return (
    <div className="flex flex-col items-center gap-2 mt-3">
      {/* Group: Pressure + Temperature trends */}
      {showTrends && (
        <div className="flex flex-wrap justify-center gap-2">
          {showP3 && (
            <div className="bg-white/20 backdrop-blur-md rounded-full py-1.5 px-3 text-xs font-bold text-white border border-white/10 flex items-center gap-1 shadow-md">
              <span className="text-white/50 uppercase tracking-wider">3h</span>
              <span
                className={pressureTrend!.delta3h <= -2 ? 'text-orange-200' : 'text-blue-200'}
              >
                {signed(pressureTrend!.delta3h)} hPa
              </span>
            </div>
          )}
          {showP6 && (
            <div className={`${BADGE} gap-1 ${delta6hBadgeClass(pressureTrend!.delta6h)}`}>
              <span className="uppercase tracking-wider opacity-70">6h</span>
              <span>{signed(pressureTrend!.delta6h)} hPa</span>
              {pressureTrend!.delta6h <= -3 && (
                <span
                  title={
                    isEn
                      ? 'Significant 6h drop (Main migraine trigger)'
                      : 'Caída severa en 6h (Principal riesgo)'
                  }
                >
                  ⚡
                </span>
              )}
            </div>
          )}
          {tempDelta3h !== null && (
            <div className="bg-white/20 backdrop-blur-md rounded-full py-1.5 px-3 text-xs font-bold text-white border border-white/10 flex items-center gap-1 shadow-md">
              <span className="text-white/50 uppercase tracking-wider">3h</span>
              <span className={tempDelta3hClass(tempDelta3h)}>{signed(tempDelta3h)}°C</span>
            </div>
          )}
          {tempDelta6h !== null && (
            <div className={`${BADGE} gap-1 ${tempDelta6hBadgeClass(tempDelta6h)}`}>
              <span
                className={`uppercase tracking-wider ${tempDelta6h > 0 ? 'opacity-80' : 'text-white/50'}`}
              >
                6h
              </span>
              <span>{signed(tempDelta6h)}°C</span>
              {tempDelta6h >= 3 && (
                <span
                  title={
                    isEn ? 'Sharp temperature rise in 6h' : 'Subida fuerte de temperatura en 6h'
                  }
                >
                  🔥
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Group: Precipitation — onset badge + amounts in same row */}
      {precipOnset && precip && (
        <div className="flex flex-wrap justify-center gap-2">
          <div className={`${BADGE} gap-1.5 ${precip.cls} text-white`}>
            <span>{precip.emoji}</span>
            <span className="opacity-80">{precip.text}</span>
            <span className="font-black text-white/90">
              {formatLeadTime(precipOnset.minutesFromNow, isEn)}
            </span>
          </div>
          {(
            [
              { label: '3h', value: rain.h3 },
              { label: '6h', value: rain.h6 },
              { label: '24h', value: rain.h24 },
            ] as const
          ).map(({ label, value }) => (
            <div
              key={label}
              className={`rounded-full py-1.5 px-3 text-xs font-bold border flex items-center gap-1 backdrop-blur-md ${amountBadgeClass(value, precipOnset.type)}`}
            >
              <span className="opacity-60">{label}</span>
              <span className="font-black">{value > 0 ? `${value}mm` : '—'}</span>
            </div>
          ))}
        </div>
      )}

      {/* Group: Wind */}
      {windAlert && wind && (
        <div className="flex flex-wrap justify-center gap-2">
          <div className={`${BADGE} gap-1.5 text-white ${wind.cls}`}>
            <span>{wind.emoji}</span>
            <span className="opacity-80">{wind.text}</span>
            <span className="font-bold">{windAlert.gusts} km/h</span>
            <span className="font-black opacity-90">
              {formatLeadTime(windAlert.minutesFromNow, isEn)}
            </span>
          </div>
        </div>
      )}

      {/* Group: Conditions (night type, frost, storm potential, fog) */}
      {(nightType || frostType || stormPotential || isFog) && (
        <div className="flex flex-wrap justify-center gap-2">
          {nightType && (
            <div className={`${BADGE} gap-1.5 ${NIGHT_BADGE[nightType].cls}`}>
              <span>{NIGHT_BADGE[nightType].emoji}</span>
              <span>{t(`label.night_${nightType}`)}</span>
            </div>
          )}
          {frostType && (
            <div
              className={`${BADGE} gap-1.5 ${frostType === 'ice' ? 'bg-cyan-900/40 border-cyan-400/40 text-white' : 'bg-slate-700/40 border-slate-400/30 text-white'}`}
            >
              <span>{frostType === 'ice' ? '🧊' : '🌨️'}</span>
              <span>{FROST_TEXT[frostType][isEn ? 'en' : 'es']}</span>
            </div>
          )}
          {stormPotential && (
            <div className={`${BADGE} gap-1.5 ${stormBadgeClass(stormPotential.level)}`}>
              <span>⛈️</span>
              <span>
                {isEn ? 'Storm' : 'Tormenta'}: {stormPotential.label}
              </span>
            </div>
          )}
          {isFog && (
            <div className={`${BADGE} gap-1.5 bg-zinc-500/30 border-zinc-400/40 text-white`}>
              <span>🌫️</span>
              <span>{FOG_TEXT[weatherCode === 48 ? 'rime' : 'fog'][isEn ? 'en' : 'es']}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
