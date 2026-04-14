import {
  DEFAULT_ICON_THEME,
  DEFAULT_THEME_PRESET,
  type AppIconTheme,
  type AppLocale,
  type AppThemeDefinition,
  type AppThemePresetId,
  type ResolvedTheme,
  type ThemeTokenValues,
} from '@shared/domain/config';
import { DEFAULT_APP_LOCALE, translate } from '@shared/i18n';
import {
  getFallbackBuiltInThemePresetId,
  listDiscoveredThemePresetFiles,
} from '@shared/theme-presets/registry';

export type ThemeSource = 'built-in' | 'custom';

interface ThemeRegistryEntry extends AppThemeDefinition {
  source: ThemeSource;
}

export interface ThemePresetDescriptor {
  id: AppThemePresetId;
  label: string;
  description: string;
  source: ThemeSource;
  resolvedTheme: ResolvedTheme;
  iconTheme: AppIconTheme;
  paletteLabel: string;
  paletteSwatches: [string, string, string];
  tokens: ThemeTokenValues;
}

type ThemeRegistry = Map<string, ThemeRegistryEntry>;

export const BASE_THEME_TOKENS: ThemeTokenValues = {
  'radius-md': '8px',
  'radius-lg': '12px',
  'radius-xl': '18px',
  'font-size-ui-2xs': '10px',
  'font-size-ui-xs': '12px',
  'font-size-ui-sm': '13px',
  'font-size-ui-md': '14px',
  'font-size-ui-lg': '15px',
  'font-size-ui-xl': '18px',
  'font-size-title-sm': '17px',
  'font-size-title-md': '20px',
  'font-size-title-lg': '26px',
  'line-height-tight': '1.35',
  'line-height-normal': '1.5',
  'line-height-relaxed': '1.6',
  'project-home-card-gap': '10px',
};

const DISCOVERED_THEME_ENTRIES: ThemeRegistryEntry[] = listDiscoveredThemePresetFiles().map(
  ({ type, ...themeDefinition }) => ({
    ...themeDefinition,
    source: type,
  }),
);

const BUILT_IN_THEME_ENTRIES = DISCOVERED_THEME_ENTRIES.filter(
  (themeEntry) => themeEntry.source === 'built-in',
);

const DISCOVERED_CUSTOM_THEME_ENTRIES = DISCOVERED_THEME_ENTRIES.filter(
  (themeEntry) => themeEntry.source === 'custom',
);

function normalizeThemeId(themeId: string | undefined | null): string | null {
  if (typeof themeId !== 'string') {
    return null;
  }

  const normalizedThemeId = themeId.trim().toLowerCase();
  return normalizedThemeId.length > 0 ? normalizedThemeId : null;
}

function getBuiltInThemeIdForResolvedTheme(resolvedTheme: ResolvedTheme): AppThemePresetId {
  return getFallbackBuiltInThemePresetId(resolvedTheme);
}

function buildThemeRegistry(customThemes: AppThemeDefinition[] = []): ThemeRegistry {
  const themeRegistry: ThemeRegistry = new Map(
    [...BUILT_IN_THEME_ENTRIES, ...DISCOVERED_CUSTOM_THEME_ENTRIES].map((themeEntry) => [
      themeEntry.id,
      themeEntry,
    ]),
  );

  for (const themeDefinition of customThemes) {
    const normalizedThemeId = normalizeThemeId(themeDefinition.id);

    if (!normalizedThemeId || themeRegistry.has(normalizedThemeId)) {
      continue;
    }

    themeRegistry.set(normalizedThemeId, {
      ...themeDefinition,
      id: normalizedThemeId,
      label: themeDefinition.label.trim(),
      description: themeDefinition.description?.trim() || undefined,
      paletteLabel: themeDefinition.paletteLabel?.trim() || undefined,
      extends: normalizeThemeId(themeDefinition.extends) ?? undefined,
      iconTheme: themeDefinition.iconTheme?.trim() || undefined,
      source: 'custom',
    });
  }

  return themeRegistry;
}

function getResolvedThemeFallbackEntry(
  resolvedTheme: ResolvedTheme,
  registry: ThemeRegistry,
): ThemeRegistryEntry {
  const fallbackThemeId = getBuiltInThemeIdForResolvedTheme(resolvedTheme);
  const fallbackEntry = registry.get(fallbackThemeId);

  if (!fallbackEntry) {
    throw new Error(`Missing fallback theme preset for "${fallbackThemeId}".`);
  }

  return fallbackEntry;
}

function resolveThemeEntryById(
  themeId: string | undefined,
  registry: ThemeRegistry,
  resolvingThemeIds: Set<string> = new Set(),
): ThemeRegistryEntry | null {
  const normalizedThemeId = normalizeThemeId(themeId);

  if (!normalizedThemeId) {
    return null;
  }

  const themeEntry = registry.get(normalizedThemeId);

  if (!themeEntry) {
    return null;
  }

  return resolveThemeEntry(themeEntry, registry, resolvingThemeIds);
}

function resolveThemeEntry(
  themeEntry: ThemeRegistryEntry,
  registry: ThemeRegistry,
  resolvingThemeIds: Set<string>,
): ThemeRegistryEntry {
  const nextResolvingThemeIds = new Set(resolvingThemeIds);
  nextResolvingThemeIds.add(themeEntry.id);

  let baseThemeEntry: ThemeRegistryEntry | null = null;

  if (themeEntry.source === 'custom') {
    const extendedThemeId = normalizeThemeId(themeEntry.extends);

    if (!extendedThemeId) {
      baseThemeEntry = resolveThemeEntryById(
        getBuiltInThemeIdForResolvedTheme(themeEntry.resolvedTheme),
        registry,
      );
    } else if (nextResolvingThemeIds.has(extendedThemeId)) {
      baseThemeEntry = resolveThemeEntryById(
        getBuiltInThemeIdForResolvedTheme(themeEntry.resolvedTheme),
        registry,
      );
    } else {
      baseThemeEntry = resolveThemeEntryById(extendedThemeId, registry, nextResolvingThemeIds);

      if (!baseThemeEntry) {
        baseThemeEntry = resolveThemeEntryById(
          getBuiltInThemeIdForResolvedTheme(themeEntry.resolvedTheme),
          registry,
        );
      }
    }
  }

  const mergedTokens: ThemeTokenValues = {
    ...BASE_THEME_TOKENS,
    ...(baseThemeEntry?.tokens ?? {}),
    ...themeEntry.tokens,
  };

  return {
    ...themeEntry,
    iconTheme: themeEntry.iconTheme ?? baseThemeEntry?.iconTheme ?? DEFAULT_ICON_THEME,
    tokens: mergedTokens,
  };
}

function buildThemePaletteSwatches(tokens: ThemeTokenValues): [string, string, string] {
  return [
    tokens['surface-panel-strong'] ?? tokens['surface-page'] ?? '#ffffff',
    tokens['surface-toolbar'] ?? tokens['surface-panel'] ?? '#f3f4f6',
    tokens.accent ?? '#3f72c6',
  ];
}

function resolveThemeSelectionId(
  themeId: AppThemePresetId | undefined,
  registry: ThemeRegistry,
  systemTheme: ResolvedTheme,
): AppThemePresetId {
  const normalizedThemeId = normalizeThemeId(themeId);

  if (!normalizedThemeId || normalizedThemeId === 'system') {
    return getBuiltInThemeIdForResolvedTheme(systemTheme);
  }

  if (normalizedThemeId === 'light') {
    return getBuiltInThemeIdForResolvedTheme('light');
  }

  if (normalizedThemeId === 'dark') {
    return getBuiltInThemeIdForResolvedTheme('dark');
  }

  if (registry.has(normalizedThemeId)) {
    return normalizedThemeId;
  }

  return getBuiltInThemeIdForResolvedTheme(systemTheme);
}

function buildThemePresetDescriptor(
  themeEntry: ThemeRegistryEntry,
  registry: ThemeRegistry,
  locale: AppLocale,
): ThemePresetDescriptor {
  const resolvedThemeEntry = resolveThemeEntry(themeEntry, registry, new Set());
  const localizedDescription =
    themeEntry.id === 'vibo-light'
      ? translate(locale, 'theme.viboLight.description')
      : themeEntry.id === 'vibo-dark'
        ? translate(locale, 'theme.viboDark.description')
        : themeEntry.description;
  const localizedPaletteLabel =
    themeEntry.id === 'vibo-light'
      ? translate(locale, 'theme.viboLight.paletteLabel')
      : themeEntry.id === 'vibo-dark'
        ? translate(locale, 'theme.viboDark.paletteLabel')
        : themeEntry.paletteLabel;

  return {
    id: themeEntry.id,
    label: themeEntry.label,
    description:
      localizedDescription ??
      (themeEntry.source === 'custom'
        ? translate(locale, 'settings.theme.customDescription')
        : translate(locale, 'settings.theme.builtInDescription', {
            label: themeEntry.label,
          })),
    source: themeEntry.source,
    resolvedTheme: themeEntry.resolvedTheme,
    iconTheme: resolvedThemeEntry.iconTheme ?? DEFAULT_ICON_THEME,
    paletteLabel:
      localizedPaletteLabel ??
      (themeEntry.resolvedTheme === 'dark'
        ? translate(locale, 'settings.theme.customDark')
        : translate(locale, 'settings.theme.customLight')),
    paletteSwatches: buildThemePaletteSwatches(resolvedThemeEntry.tokens),
    tokens: resolvedThemeEntry.tokens,
  };
}

export function listThemePresetDescriptors(
  customThemes: AppThemeDefinition[] = [],
  locale: AppLocale = DEFAULT_APP_LOCALE,
): ThemePresetDescriptor[] {
  const registry = buildThemeRegistry(customThemes);

  return Array.from(registry.values()).map((themeEntry) =>
    buildThemePresetDescriptor(themeEntry, registry, locale),
  );
}

export function resolveThemePresetId(
  themeId: AppThemePresetId | undefined,
  customThemes: AppThemeDefinition[] = [],
  systemTheme: ResolvedTheme = 'light',
): AppThemePresetId {
  const registry = buildThemeRegistry(customThemes);
  return resolveThemeSelectionId(themeId, registry, systemTheme);
}

export function getThemePresetDescriptor(
  themeId: AppThemePresetId | undefined,
  customThemes: AppThemeDefinition[] = [],
  systemTheme: ResolvedTheme = 'light',
  locale: AppLocale = DEFAULT_APP_LOCALE,
): ThemePresetDescriptor {
  const registry = buildThemeRegistry(customThemes);
  const resolvedThemeId = resolveThemeSelectionId(themeId, registry, systemTheme);
  const resolvedThemeEntry =
    resolveThemeEntryById(resolvedThemeId, registry) ??
    resolveThemeEntryById(DEFAULT_THEME_PRESET, registry) ??
    getResolvedThemeFallbackEntry('light', registry);

  return buildThemePresetDescriptor(resolvedThemeEntry, registry, locale);
}

export function buildThemeDescriptorSignature(themeDescriptor: ThemePresetDescriptor): string {
  const serializedTokens = Object.entries(themeDescriptor.tokens)
    .filter(([, tokenValue]) => typeof tokenValue === 'string' && tokenValue.length > 0)
    .sort(([leftName], [rightName]) => leftName.localeCompare(rightName))
    .map(([tokenName, tokenValue]) => `${tokenName}:${tokenValue}`)
    .join('|');

  return [
    themeDescriptor.id,
    themeDescriptor.resolvedTheme,
    themeDescriptor.iconTheme,
    serializedTokens,
  ].join(';');
}
