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
}

export interface WeatherData {
  current: CurrentWeather;
  daily: DailyWeather[];
  hourly: HourlyWeather[];
  historical: HistoricalWeather[];
  pressureTrend: PressureTrend | null;
  airQuality: AirQualityData | null;
}
