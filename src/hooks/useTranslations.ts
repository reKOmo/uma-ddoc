import { loadTranslations, type TranslationsFile } from '../lib/translations.ts';
import { useAsync } from './useAsync.ts';

// null until loaded, and without the file.
export const useTranslations = (): TranslationsFile | null => useAsync(loadTranslations, []).data ?? null;
