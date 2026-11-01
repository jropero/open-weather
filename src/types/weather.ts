export interface Location {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  isGPS?: boolean;
  timezone?: string;
}

export interface CurrentWeather {
  temperature: number;
  humidity: number;
  weatherCode: number;
  windSpeed: number;
  windGusts: number;
  windDirection: number;
  surfacePressure: number;
  elevation: number;
}

export interface DailyWeather {
  date: string;
  weatherCode: number;
  maxTemp: number;
  minTemp: number;
  meanPressure: number;
  humidity: number;
  precipitation: number;
  precipitationProbability: number;
  windSpeed: number;
  sunshineDuration: number; // seconds
  precipitationHours: number;
  sunrise: string;
  sunset: string;
}

export interface HistoricalWeather {
  year: number;
  data: DailyWeather | null;
  error?: boolean;
}

export interface PressureTrend {
  delta3h: number;
  delta6h: number;
  currentPressure: number;
}

export interface HourlyWeather {
  time: string;
  temperature: number;
  humidity: number;
  pressure: number;
  precipitation: number;
  precipProbability: number;
  weatherCode: number;
  windSpeed: number;
  windGusts: number;
  dewPoint: number;
  snowfall: number;
  apparentTemperature: number;
  cape: number;
}

// Hourly values for the Today & Tomorrow summary — nulls are kept so missing data is never read as 0
export interface SummaryHour {
  time: string; // UTC, parse with +Z
  temperature: number | null;
  apparentTemperature: number | null;
  precipitation: number | null;
  precipProbability: number | null;
  snowfall: number | null;
  weatherCode: number | null;
  windGusts: number | null;
}

// Waking hours in the location's local time; `end` is exclusive (07–23 covers the 07:00…22:00 hour slots)
export interface WakingWindow {
  start: number; // 0–23
  end: number;   // start+1 … 24
}

export interface AirQualityData {
  currentAqi: number | null;
  currentPm25: number | null;
  currentPm10: number | null;
  grassPollen: number | null;
  birchPollen: number | null;
  alderPollen: number | null;
  mugwortPollen: number | null;
  olivePollen: number | null;
  ragweedPollen: number | null;
  uvIndex: number | null;
  dominantPollutant: string | null;
  hourlyAqi: number[];
  hourlyTime: string[];
  aqiPm25: number | null;
  aqiPm10: number | null;
  aqiNo2: number | null;
  aqiO3: number | null;
  aqiSo2: number | null;
}

export interface WeatherData {
  current: CurrentWeather;
  daily: DailyWeather[];
  hourly: HourlyWeather[];
  summaryHours: SummaryHour[]; // current hour −25 h … +74 h (covers today, tomorrow and day-after-tomorrow in any timezone)
  timezone: string | null;     // IANA timezone of the location, from the timezone=auto daily response
  historical: HistoricalWeather[];
  pressureTrend: PressureTrend | null;
  airQuality: AirQualityData | null;
}

// --- Long-range outlook (Open-Meteo Seasonal API: ECMWF EC46 weekly + SEAS5 monthly) ---

export type SeasonalVariable = 'temperature' | 'precipitation' | 'pressure' | 'sunshine' | 'snowfall';
export type SeasonKey = 'DJF' | 'MAM' | 'JJA' | 'SON';
export type SeasonName = 'winter' | 'spring' | 'summer' | 'autumn';
export type ClimateZone = 'north' | 'south' | 'tropical';
export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface SeasonalValue {
  mean: number | null;      // period mean (temp °C, pressure hPa) or period total (precip mm, sunshine s, snow cm)
  anomaly: number | null;   // forecast minus the model's hindcast climatology, same unit as mean
  probAbove: number | null; // % of ensemble members with anomaly > 0 (weekly temp/precip/pressure only)
}

export interface SeasonalRawPeriod {
  start: string; // YYYY-MM-DD — Monday (weekly) or 1st of month (monthly)
  values: Record<SeasonalVariable, SeasonalValue>;
}

export interface SeasonalForecastData {
  weekly: SeasonalRawPeriod[];
  monthly: SeasonalRawPeriod[];
}

export interface SeasonInfo {
  key: SeasonKey;
  kind: 'rest' | 'next';
  months: string[];       // start dates of the months that have data
  monthsExpected: number; // months the column should cover (rest of season can be < 3)
}

export interface SeasonalPeriod {
  start: string;
  end: string; // inclusive
  days: number;
  inProgress: boolean; // started before today
  values: Record<SeasonalVariable, SeasonalValue>;
  confidence: ConfidenceLevel;
  agreement: number | null; // weekly only: mean ensemble agreement on the anomaly sign, %
  season?: SeasonInfo;
}

export interface SeasonalOutlook {
  weeks: SeasonalPeriod[];
  months: SeasonalPeriod[];
  seasons: SeasonalPeriod[]; // [rest of current season, next full season]
  zone: ClimateZone;
  today: string;
  seas5Issue: string | null; // first monthly entry = SEAS5 issue month
}
