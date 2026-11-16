import { useEffect, useState, type ReactNode } from 'react';
import { LanguageContext, type Language } from '../hooks/useLanguage';
import { translations } from '../constants/translations';

const STORAGE_KEY = 'language';

function readStoredLanguage(): Language {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'es' || stored === 'en') return stored;
  } catch {
    /* localStorage unavailable */
  }
  return 'es';
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(readStoredLanguage);

  // Keep <html lang> in sync so screen readers use the right voice and pronunciation
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* storage full / unavailable */
    }
  };

  // Missing key → other language → the key itself (the i18n test keeps both tables in sync)
  const t = (key: string): string =>
    translations[language][key] || translations[language === 'es' ? 'en' : 'es'][key] || key;

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}
