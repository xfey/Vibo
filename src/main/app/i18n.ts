import {
  DEFAULT_APP_LOCALE,
  type AppLocale,
  type TranslationKey,
  type TranslationParams,
  translate,
} from '@shared/i18n';

let currentMainLocale: AppLocale = DEFAULT_APP_LOCALE;

export function setMainLocale(locale: AppLocale): void {
  currentMainLocale = locale;
}

export function getMainLocale(): AppLocale {
  return currentMainLocale;
}

export function tMain(
  key: TranslationKey,
  params?: TranslationParams,
): string {
  return translate(currentMainLocale, key, params);
}

export function translateMain(
  locale: AppLocale,
  key: TranslationKey,
  params?: TranslationParams,
): string {
  return translate(locale, key, params);
}
