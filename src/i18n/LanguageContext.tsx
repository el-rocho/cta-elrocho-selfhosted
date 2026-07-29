import React from 'react';
import type { LanguageOption } from '../types/bloodPressure';
import { getTranslation } from './translations';
import { LanguageContext } from './useLanguage';

interface LanguageProviderProps {
  language: LanguageOption;
  onLanguageChange?: (lang: LanguageOption) => void;
  children: React.ReactNode;
}

export const LanguageProvider: React.FC<LanguageProviderProps> = ({
  language,
  onLanguageChange,
  children,
}) => {
  const t = (path: string, params?: Record<string, string | number>) =>
    getTranslation(language, path, params);

  return (
    <LanguageContext.Provider value={{ language, setLanguage: onLanguageChange, t }}>
      {children}
    </LanguageContext.Provider>
  );
};
