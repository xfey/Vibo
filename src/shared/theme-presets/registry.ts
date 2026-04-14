/// <reference types="vite/client" />

import {
  DEFAULT_THEME_PRESET,
  type AppThemeDefinition,
  type AppThemePresetFileDefinition,
  type AppThemePresetId,
  type ResolvedTheme,
} from '@shared/domain/config';
import { parseAppThemePresetFileDefinition } from '@shared/schemas/theme';

const RESERVED_THEME_ALIASES = new Set(['light', 'dark', 'system']);

const themePresetModules = import.meta.glob('./*.json', {
  eager: true,
  import: 'default',
}) as Record<string, unknown>;

function normalizeOptionalString(value: string | undefined): string | undefined {
  const normalizedValue = value?.trim();
  return normalizedValue ? normalizedValue : undefined;
}

function normalizeThemeId(themeId: string): string {
  return themeId.trim().toLowerCase();
}

function normalizeThemePresetFileDefinition(
  themeDefinition: AppThemePresetFileDefinition,
): AppThemePresetFileDefinition {
  return {
    ...themeDefinition,
    id: normalizeThemeId(themeDefinition.id),
    label: themeDefinition.label.trim(),
    description: normalizeOptionalString(themeDefinition.description),
    paletteLabel: normalizeOptionalString(themeDefinition.paletteLabel),
    extends: normalizeOptionalString(themeDefinition.extends)?.toLowerCase(),
    iconTheme: normalizeOptionalString(themeDefinition.iconTheme),
  };
}

function parseThemePresetFile(
  filePath: string,
  themeDefinition: unknown,
): AppThemePresetFileDefinition {
  try {
    return normalizeThemePresetFileDefinition(parseAppThemePresetFileDefinition(themeDefinition));
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Invalid theme preset file "${filePath}": ${errorMessage}`);
  }
}

function omitThemePresetFileType(
  themeDefinition: AppThemePresetFileDefinition,
): AppThemeDefinition {
  const { type, ...normalizedThemeDefinition } = themeDefinition;
  return normalizedThemeDefinition;
}

const discoveredThemePresetFiles = Object.entries(themePresetModules)
  .sort(([leftPath], [rightPath]) => leftPath.localeCompare(rightPath))
  .map(([filePath, themeDefinition]) => parseThemePresetFile(filePath, themeDefinition));

const seenThemeIds = new Set<string>();

for (const themeDefinition of discoveredThemePresetFiles) {
  if (RESERVED_THEME_ALIASES.has(themeDefinition.id)) {
    throw new Error(`Theme preset id "${themeDefinition.id}" is reserved.`);
  }

  if (seenThemeIds.has(themeDefinition.id)) {
    throw new Error(`Duplicate theme preset id "${themeDefinition.id}" found in theme files.`);
  }

  seenThemeIds.add(themeDefinition.id);
}

const builtInThemePresetFiles = discoveredThemePresetFiles.filter(
  (themeDefinition) => themeDefinition.type === 'built-in',
);

const builtInThemeIds = new Set<string>(
  builtInThemePresetFiles.map((themeDefinition) => themeDefinition.id),
);

function resolveFallbackBuiltInThemeId(resolvedTheme: ResolvedTheme): AppThemePresetId {
  if (resolvedTheme === 'light') {
    const preferredLightTheme = builtInThemePresetFiles.find(
      (themeDefinition) =>
        themeDefinition.id === DEFAULT_THEME_PRESET && themeDefinition.resolvedTheme === 'light',
    );

    if (preferredLightTheme) {
      return preferredLightTheme.id;
    }
  }

  const matchingTheme = builtInThemePresetFiles.find(
    (themeDefinition) => themeDefinition.resolvedTheme === resolvedTheme,
  );

  if (!matchingTheme) {
    throw new Error(`Missing built-in ${resolvedTheme} theme preset.`);
  }

  return matchingTheme.id;
}

export function listDiscoveredThemePresetFiles(): AppThemePresetFileDefinition[] {
  return discoveredThemePresetFiles.slice();
}

export function listDiscoveredThemePresetDefinitions(): AppThemeDefinition[] {
  return discoveredThemePresetFiles.map((themeDefinition) => omitThemePresetFileType(themeDefinition));
}

export function listDiscoveredBuiltInThemePresetIds(): AppThemePresetId[] {
  return builtInThemePresetFiles.map((themeDefinition) => themeDefinition.id);
}

export function listDiscoveredThemePresetIds(): AppThemePresetId[] {
  return discoveredThemePresetFiles.map((themeDefinition) => themeDefinition.id);
}

export function isDiscoveredBuiltInThemePresetId(themeId: string): boolean {
  return builtInThemeIds.has(themeId.trim().toLowerCase());
}

export function getFallbackBuiltInThemePresetId(
  resolvedTheme: ResolvedTheme,
): AppThemePresetId {
  return resolveFallbackBuiltInThemeId(resolvedTheme);
}
