import { createContext, useContext, useState, type ReactNode } from 'react';

export type Language = 'es' | 'en';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const translations: Record<Language, Record<string, string>> = {
  es: {
    'title.pressure_humidity': 'Presión y Humedad',
    'title.daily_forecast': 'Ventana de 7 Días (Evolución y Pronóstico)',
    'title.future_forecast': 'Próximos 3 Días',
    'title.historical': 'Memoria Atmosférica',
    'label.today': 'Hoy',
    'label.in': 'En',
    'label.humidity': 'Humedad',
    'label.temp': 'Temp',
    'label.wind': 'Viento',
    'label.rain': 'Lluvia',
    'label.fatigue': 'Fatiga',
    'label.migraine': 'Riesgo Migraña',
    'label.pressure': 'Presión',
    'label.seco': 'Seco',
    'label.humedo': 'Húmedo',
    'label.gps': 'Actual (GPS)',
    'label.how_to_interpret': 'Cómo interpretar este gráfico',
    'label.mountain': 'Montaña Roja:',
    'label.pressure_desc': 'Presión Atmosférica',
    'label.yellow_line': 'Línea Amarilla:',
    'label.temperature': 'Temperatura',
    'label.indigo_cols': 'Columnas Índigo:',
    'label.rain_vol': 'Volumen de Lluvia',
    'label.bg_aurora': 'Fondo (Aurora):',
    'label.humidity_risk': 'Riesgo Humedad Alta',
    'label.clinical_breakdown': 'Desgloses Clínicos y Matemáticos',
    'label.fatigue_calc': 'Cálculo de Fatiga (Thom)',
    'label.migraine_doi': 'Riesgo de Migraña (DOI: 10.1111/head.14482)',
    'title.select_location': 'Seleccionar Ubicación',
    'placeholder.search_city': 'Buscar ciudad...',
    'btn.gps_active': 'Obteniendo GPS...',
    'btn.gps_use': 'Usar mi ubicación actual',
    'alert.gps_error': 'No se pudo obtener la ubicación GPS.',
    'label.info_unavailable': 'Información no disponible',
    'label.wind_heat_relief': 'El viento alivia el calor',
    'label.wind_calm': 'Calma',
    'label.night_tropical': 'Noche Tropical',
    'label.night_tropical_desc': 'Mínima no bajará de 20°C',
    'label.night_torrida': 'Noche Tórrida',
    'label.night_torrida_desc': 'Mínima de hasta 25°C',
    'label.night_ecuatorial': 'Noche Ecuatorial',
    'label.night_ecuatorial_desc': 'Mínima superior a 25°C'
  },
  en: {
    'title.pressure_humidity': 'Pressure & Humidity',
    'title.daily_forecast': '7-Day Window (Evolution & Forecast)',
    'title.future_forecast': 'Next 3 Days',
    'title.historical': 'Atmospheric Memory',
    'label.today': 'Today',
    'label.in': 'In',
    'label.humidity': 'Humidity',
    'label.temp': 'Temp',
    'label.wind': 'Wind',
    'label.rain': 'Rain',
    'label.fatigue': 'Fatigue',
    'label.migraine': 'Migraine Risk',
    'label.pressure': 'Pressure',
    'label.seco': 'Dry',
    'label.humedo': 'Wet',
    'label.gps': 'Current (GPS)',
    'label.how_to_interpret': 'How to interpret this chart',
    'label.mountain': 'Red Mountain:',
    'label.pressure_desc': 'Atmospheric Pressure',
    'label.yellow_line': 'Yellow Line:',
    'label.temperature': 'Temperature',
    'label.indigo_cols': 'Indigo Columns:',
    'label.rain_vol': 'Rain Volume',
    'label.bg_aurora': 'Background (Aurora):',
    'label.humidity_risk': 'High Humidity Risk',
    'label.clinical_breakdown': 'Clinical & Mathematical Breakdowns',
    'label.fatigue_calc': 'Fatigue Calculation (Thom)',
    'label.migraine_doi': 'Migraine Risk (DOI: 10.1111/head.14482)',
    'title.select_location': 'Select Location',
    'placeholder.search_city': 'Search city...',
    'btn.gps_active': 'Getting GPS...',
    'btn.gps_use': 'Use my current location',
    'alert.gps_error': 'Could not obtain GPS location.',
    'label.info_unavailable': 'Information unavailable',
    'label.wind_heat_relief': 'Wind relieves heat',
    'label.wind_calm': 'Calm',
    'label.night_tropical': 'Tropical Night',
    'label.night_tropical_desc': 'Min temp won\'t drop below 20°C',
    'label.night_torrida': 'Torrid Night',
    'label.night_torrida_desc': 'Min temp up to 25°C',
    'label.night_ecuatorial': 'Equatorial Night',
    'label.night_ecuatorial_desc': 'Min temp exceeds 25°C'
  }
};

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>('es');

  const t = (key: string): string => {
    return translations[language][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
