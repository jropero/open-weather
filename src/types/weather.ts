export interface Location {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  isGPS?: boolean;
}

export interface CurrentWeather {
  temperature: number;
  humidity: number;
  weatherCode: number;
  windSpeed: number;
  windDirection: number;
  surfacePressure: number;
}

export interface DailyWeather {
  date: string;
  weatherCode: number;
  maxTemp: number;
  minTemp: number;
  meanPressure: number;
  humidity: number;
  precipitation: number;
  windSpeed: number;
}

export interface HistoricalWeather {
  year: number;
  data: DailyWeather;
}

export interface WeatherData {
  current: CurrentWeather;
  daily: DailyWeather[];
  historical: HistoricalWeather[];
}
