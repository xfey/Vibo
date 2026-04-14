import { useEffect, useMemo, useState } from 'react';

import {
  DEFAULT_CODE_FONT_LIST,
  DEFAULT_CODE_FONT_SIZE,
  MAX_CODE_FONT_SIZE,
  MIN_CODE_FONT_SIZE,
  type AppConfig,
  type AppIconTheme,
  type ResolvedTheme,
} from '@shared/domain/config';

import {
  getThemePresetDescriptor,
  buildThemeDescriptorSignature,
  resolveThemePresetId,
} from './theme-preset-registry';

const SYSTEM_THEME_MEDIA_QUERY = '(prefers-color-scheme: dark)';
export const DEFAULT_MONO_FONT_STACK = `'SF Mono', Monaco, Consolas, monospace`;

interface UseDocumentAppearanceResult {
  codeFontFamily: string;
  codeFontSize: number;
  iconTheme: AppIconTheme;
  themePresetId: AppConfig['appearance']['theme'];
  resolvedTheme: ResolvedTheme;
  signature: string;
}

function readSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'light';
  }

  return window.matchMedia(SYSTEM_THEME_MEDIA_QUERY).matches ? 'dark' : 'light';
}

function quoteFontFamily(fontFamily: string): string {
  const trimmedFontFamily = fontFamily.trim();

  if (
    trimmedFontFamily.startsWith('"') ||
    trimmedFontFamily.startsWith("'") ||
    trimmedFontFamily.includes(',')
  ) {
    return trimmedFontFamily;
  }

  return `"${trimmedFontFamily}"`;
}

function normalizeCodeFontToken(fontToken: string): string {
  const trimmedFontToken = fontToken.trim();

  if (trimmedFontToken.length === 0) {
    return '';
  }

  if (trimmedFontToken.startsWith('"') || trimmedFontToken.startsWith("'")) {
    return trimmedFontToken;
  }

  if (/^[a-z0-9-]+$/i.test(trimmedFontToken)) {
    return trimmedFontToken;
  }

  return quoteFontFamily(trimmedFontToken);
}

export function buildCodeFontStack(codeFont: string | undefined): string {
  const normalizedCodeFont = codeFont?.trim().length ? codeFont.trim() : DEFAULT_CODE_FONT_LIST;

  if (normalizedCodeFont === DEFAULT_CODE_FONT_LIST) {
    return DEFAULT_MONO_FONT_STACK;
  }

  const normalizedTokens = normalizedCodeFont
    .split(',')
    .map((fontToken) => normalizeCodeFontToken(fontToken))
    .filter((fontToken) => fontToken.length > 0);

  if (normalizedTokens.length === 0) {
    return DEFAULT_MONO_FONT_STACK;
  }

  return [...normalizedTokens, DEFAULT_MONO_FONT_STACK].join(', ');
}

function normalizeCodeFontSize(codeFontSize: number | undefined): number {
  if (typeof codeFontSize !== 'number' || !Number.isFinite(codeFontSize)) {
    return DEFAULT_CODE_FONT_SIZE;
  }

  return Math.min(
    MAX_CODE_FONT_SIZE,
    Math.max(MIN_CODE_FONT_SIZE, Math.round(codeFontSize)),
  );
}

function applyDocumentAppearance(
  themePresetId: AppConfig['appearance']['theme'],
  resolvedTheme: ResolvedTheme,
  codeFontFamily: string,
  codeFontSize: number,
  iconTheme: AppIconTheme,
  themeTokens: Record<string, string | undefined>,
): void {
  const root = document.documentElement;

  root.dataset.themePreset = themePresetId;
  root.dataset.theme = resolvedTheme;
  root.dataset.iconTheme = iconTheme;

  for (const [tokenName, tokenValue] of Object.entries(themeTokens)) {
    if (!tokenValue) {
      continue;
    }

    root.style.setProperty(`--${tokenName}`, tokenValue);
  }

  root.style.setProperty('--font-family-mono', codeFontFamily);
  root.style.setProperty('--font-size-mono', `${codeFontSize}px`);
}

export function useDocumentAppearance(
  appearance: AppConfig['appearance'] | undefined,
): UseDocumentAppearanceResult {
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(() => readSystemTheme());
  const themeSetting = appearance?.theme;
  const customThemes = appearance?.themes ?? [];
  const codeFontFamily = useMemo(
    () => buildCodeFontStack(appearance?.codeFont),
    [appearance?.codeFont],
  );
  const codeFontSize = useMemo(
    () => normalizeCodeFontSize(appearance?.codeFontSize),
    [appearance?.codeFontSize],
  );
  const themePreset = useMemo(
    () => getThemePresetDescriptor(themeSetting, customThemes, systemTheme),
    [customThemes, systemTheme, themeSetting],
  );
  const themePresetId = useMemo(
    () => resolveThemePresetId(themeSetting, customThemes, systemTheme),
    [customThemes, systemTheme, themeSetting],
  );
  const resolvedTheme = useMemo(
    () => themePreset.resolvedTheme,
    [themePreset],
  );
  const iconTheme = useMemo(() => themePreset.iconTheme, [themePreset]);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }

    const mediaQueryList = window.matchMedia(SYSTEM_THEME_MEDIA_QUERY);

    function handleThemeChange(event: MediaQueryListEvent): void {
      setSystemTheme(event.matches ? 'dark' : 'light');
    }

    setSystemTheme(mediaQueryList.matches ? 'dark' : 'light');

    if (themeSetting?.trim().toLowerCase() !== 'system') {
      return;
    }

    mediaQueryList.addEventListener('change', handleThemeChange);

    return () => {
      mediaQueryList.removeEventListener('change', handleThemeChange);
    };
  }, [themeSetting]);

  useEffect(() => {
    applyDocumentAppearance(
      themePresetId,
      resolvedTheme,
      codeFontFamily,
      codeFontSize,
      iconTheme,
      themePreset.tokens,
    );
  }, [codeFontFamily, codeFontSize, iconTheme, resolvedTheme, themePreset, themePresetId]);

  return {
    codeFontFamily,
    codeFontSize,
    iconTheme,
    themePresetId,
    resolvedTheme,
    signature: `${buildThemeDescriptorSignature(themePreset)}:${codeFontFamily}:${codeFontSize}`,
  };
}
