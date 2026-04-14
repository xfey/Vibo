import {
  createContext,
  type PropsWithChildren,
  type ReactElement,
  useContext,
  useEffect,
  useMemo,
} from 'react';

import {
  DEFAULT_APP_LOCALE,
  type AppLocale,
  type TranslationKey,
  type TranslationParams,
  translate,
} from '@shared/i18n';

let currentRendererLocale: AppLocale = DEFAULT_APP_LOCALE;

interface I18nContextValue {
  locale: AppLocale;
  t: (key: TranslationKey, params?: TranslationParams) => string;
}

const I18nContext = createContext<I18nContextValue>({
  locale: DEFAULT_APP_LOCALE,
  t: (key, params) => translate(DEFAULT_APP_LOCALE, key, params),
});

export function setRendererLocale(locale: AppLocale): void {
  currentRendererLocale = locale;
}

export function tRenderer(
  key: TranslationKey,
  params?: TranslationParams,
): string {
  return translate(currentRendererLocale, key, params);
}

export function getRendererLocale(): AppLocale {
  return currentRendererLocale;
}

export function I18nProvider({
  locale,
  children,
}: PropsWithChildren<{
  locale: AppLocale;
}>): ReactElement {
  useEffect(() => {
    setRendererLocale(locale);
  }, [locale]);

  const contextValue = useMemo<I18nContextValue>(
    () => ({
      locale,
      t: (key, params) => translate(locale, key, params),
    }),
    [locale],
  );

  return <I18nContext.Provider value={contextValue}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  return useContext(I18nContext);
}
