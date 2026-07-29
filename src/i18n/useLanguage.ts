import { createContext, useContext } from 'react';
import type { LanguageOption } from '../types/bloodPressure';
import { getTranslation } from './translations';

interface LanguageContextProps {
  language: LanguageOption;
  setLanguage?: (lang: LanguageOption) => void;
  t: (path: string, params?: Record<string, string | number>) => string;
}

export const LanguageContext = createContext<LanguageContextProps>({
  language: 'es',
  t: (path, params) => getTranslation('es', path, params),
});

export const useLanguage = () => useContext(LanguageContext);
