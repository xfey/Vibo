import { z } from 'zod';

import {
  THEME_PRESET_FILE_TYPES,
  THEME_TOKEN_NAMES,
  type AppThemeDefinition,
  type AppThemePresetFileDefinition,
} from '@shared/domain/config';

export const themeTokenValueSchema = z.string().trim().min(1);

const themeTokenShape = Object.fromEntries(
  THEME_TOKEN_NAMES.map((tokenName) => [tokenName, themeTokenValueSchema]),
);

export const themeTokensSchema = z.object(themeTokenShape).partial().default({});

export const appThemeDefinitionSchema = z.object({
  id: z.string().trim().min(1),
  label: z.string().trim().min(1),
  description: z.string().trim().min(1).optional(),
  paletteLabel: z.string().trim().min(1).optional(),
  resolvedTheme: z.enum(['light', 'dark']),
  iconTheme: z.string().trim().min(1).optional(),
  extends: z.string().trim().min(1).optional(),
  tokens: themeTokensSchema,
});

export const appThemeDefinitionsSchema = z.array(appThemeDefinitionSchema).default([]);

export const appThemePresetFileDefinitionSchema = appThemeDefinitionSchema.extend({
  type: z.enum(THEME_PRESET_FILE_TYPES),
});

export function parseAppThemeDefinition(value: unknown): AppThemeDefinition {
  return appThemeDefinitionSchema.parse(value);
}

export function parseAppThemePresetFileDefinition(
  value: unknown,
): AppThemePresetFileDefinition {
  return appThemePresetFileDefinitionSchema.parse(value);
}
