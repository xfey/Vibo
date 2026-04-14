import { z } from 'zod';

import { AGENT_IDS, DEFAULT_AGENT_ID } from '@shared/domain/agent';
import { APP_LOCALES, DEFAULT_APP_LOCALE } from '@shared/i18n';
import {
  DEFAULT_CODE_FONT_LIST,
  DEFAULT_CODE_FONT_SIZE,
  MAX_CODE_FONT_SIZE,
  MIN_CODE_FONT_SIZE,
  DEFAULT_THEME_PRESET,
  type AppConfig,
  type AppThemeDefinition,
  type ProjectConfig,
  type ProjectUiState,
} from '@shared/domain/config';
import { appThemeDefinitionSchema } from './theme';

const agentIdSchema = z.enum(AGENT_IDS);
const appLocaleSchema = z.enum(APP_LOCALES);
const codexWebSearchSchema = z
  .union([
    z.enum(['disabled', 'cached', 'live']),
    z.boolean().transform((value) => (value ? 'live' : 'disabled')),
  ])
  .optional();
const codexAgentSettingsSchema = z
  .object({
    model: z.string().optional(),
    modelReasoningEffort: z.string().optional(),
    approvalPolicy: z.string().optional(),
    sandboxMode: z.string().optional(),
    webSearch: codexWebSearchSchema,
  })
  .default({});
const claudeCodeAgentSettingsSchema = z
  .object({
    model: z.string().optional(),
    effort: z.string().optional(),
    permission: z.string().optional(),
  })
  .default({});
const openCodeAgentSettingsSchema = z
  .object({
    model: z.string().optional(),
    primaryAgent: z.string().optional(),
  })
  .default({});
const themeSettingSchema = z
  .string()
  .trim()
  .min(1)
  .catch(DEFAULT_THEME_PRESET)
  .default(DEFAULT_THEME_PRESET);
const customThemesSchema = z
  .array(z.unknown())
  .default([])
  .transform((values): AppThemeDefinition[] =>
    values.flatMap((value) => {
      const parsedTheme = appThemeDefinitionSchema.safeParse(value);
      return parsedTheme.success ? [parsedTheme.data] : [];
    }),
  );
const codeFontSizeSchema = z
  .number()
  .int()
  .min(MIN_CODE_FONT_SIZE)
  .max(MAX_CODE_FONT_SIZE)
  .catch(DEFAULT_CODE_FONT_SIZE)
  .default(DEFAULT_CODE_FONT_SIZE);

export const appConfigSchema = z.object({
  version: z.literal(1).default(1),
  locale: appLocaleSchema.catch(DEFAULT_APP_LOCALE).default(DEFAULT_APP_LOCALE),
  defaultAgent: agentIdSchema.default(DEFAULT_AGENT_ID),
  appearance: z
    .object({
      theme: themeSettingSchema,
      codeFont: z.string().default(DEFAULT_CODE_FONT_LIST),
      codeFontSize: codeFontSizeSchema,
      themes: customThemesSchema,
    })
    .default({
      theme: DEFAULT_THEME_PRESET,
      codeFont: DEFAULT_CODE_FONT_LIST,
      codeFontSize: DEFAULT_CODE_FONT_SIZE,
      themes: [],
    }),
  agentSettings: z
    .object({
      codex: codexAgentSettingsSchema,
      claudeCode: claudeCodeAgentSettingsSchema,
      opencode: openCodeAgentSettingsSchema,
    })
    .default({
      codex: {},
      claudeCode: {},
      opencode: {},
    }),
});

export const projectConfigSchema = z.object({
  version: z.literal(1).default(1),
  preferredAgent: agentIdSchema.optional(),
  agentOverrides: z
    .object({
      codex: codexAgentSettingsSchema,
      claudeCode: claudeCodeAgentSettingsSchema,
      opencode: openCodeAgentSettingsSchema,
    })
    .default({
      codex: {},
      claudeCode: {},
      opencode: {},
    }),
});

export const projectUiStateSchema = z.object({
  version: z.literal(1).default(1),
  sidebarWidth: z.number().int().positive().default(280),
  gitSectionHeight: z.number().int().positive().default(156),
});

export function createDefaultAppConfig(): AppConfig {
  return appConfigSchema.parse({});
}

export function createDefaultProjectConfig(): ProjectConfig {
  return projectConfigSchema.parse({});
}

export function createDefaultProjectUiState(): ProjectUiState {
  return projectUiStateSchema.parse({});
}
