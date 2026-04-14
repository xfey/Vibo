import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';

import { app } from 'electron';
import { ZodType } from 'zod';

import type {
  ProjectCapabilities,
  ProjectStoragePaths,
  RemoteProjectMetadata,
} from '@shared/contracts/project';
import type {
  AppConfig,
  AppThemeDefinition,
  ClaudeCodeAgentSettings,
  CodexAgentSettings,
  OpenCodeAgentSettings,
  ProjectConfig,
  ProjectUiState,
} from '@shared/domain/config';
import {
  DEFAULT_CODE_FONT_LIST,
  DEFAULT_CODE_FONT_SIZE,
  MAX_CODE_FONT_SIZE,
  MIN_CODE_FONT_SIZE,
} from '@shared/domain/config';
import type { ProjectRef, SshProjectRef } from '@shared/domain/project';
import { isLocalProject } from '@shared/domain/project';
import type { RecentProjectRecord } from '@shared/domain/recent-project';
import {
  appConfigSchema,
  createDefaultAppConfig,
  createDefaultProjectConfig,
  createDefaultProjectUiState,
  projectConfigSchema,
  projectUiStateSchema,
} from '@shared/schemas/config';
import { createDefaultRecentProjects, recentProjectsSchema } from '@shared/schemas/recents';
import { listDiscoveredThemePresetIds } from '@shared/theme-presets/registry';
import { tMain } from '@main/app/i18n';

async function ensureDirectory(directoryPath: string): Promise<void> {
  await mkdir(directoryPath, { recursive: true });
}

async function writeJsonFile<T>(filePath: string, value: T): Promise<void> {
  await ensureDirectory(path.dirname(filePath));
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function isMissingFileError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'ENOENT'
  );
}

function normalizeOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalizedValue = value.trim();
  return normalizedValue.length > 0 ? normalizedValue : undefined;
}

function normalizeCodexWebSearch(value: unknown): CodexAgentSettings['webSearch'] | undefined {
  if (typeof value === 'boolean') {
    return value ? 'live' : 'disabled';
  }

  const normalizedValue = normalizeOptionalString(value);

  if (!normalizedValue) {
    return undefined;
  }

  if (normalizedValue === 'true') {
    return 'live';
  }

  if (normalizedValue === 'false') {
    return 'disabled';
  }

  switch (normalizedValue) {
    case 'disabled':
    case 'cached':
    case 'live':
      return normalizedValue;
    default:
      return undefined;
  }
}

function mergeAppConfigWithNativeAgentSettings(
  storedAppConfig: AppConfig,
  nativeAgentSettings: AppConfig['agentSettings'],
): AppConfig {
  return {
    ...storedAppConfig,
    agentSettings: {
      codex: {
        ...nativeAgentSettings.codex,
        ...storedAppConfig.agentSettings.codex,
      },
      claudeCode: {
        ...nativeAgentSettings.claudeCode,
        ...storedAppConfig.agentSettings.claudeCode,
      },
      opencode: {
        ...nativeAgentSettings.opencode,
        ...storedAppConfig.agentSettings.opencode,
      },
    },
  };
}

const LEGACY_DEFAULT_CODE_FONT_LISTS = new Set([
  'SF Mono',
  'SF Mono, SFMono-Regular, ui-monospace, monospace',
  'SF Mono, Menlo, Consolas, monospace',
]);

function normalizeStoredCodeFont(codeFont: string): string {
  const normalizedCodeFont = codeFont.trim();

  if (normalizedCodeFont.length === 0) {
    return DEFAULT_CODE_FONT_LIST;
  }

  if (LEGACY_DEFAULT_CODE_FONT_LISTS.has(normalizedCodeFont)) {
    return DEFAULT_CODE_FONT_LIST;
  }

  return normalizedCodeFont;
}

function normalizeStoredCodeFontSize(codeFontSize: number): number {
  if (!Number.isFinite(codeFontSize)) {
    return DEFAULT_CODE_FONT_SIZE;
  }

  return Math.min(
    MAX_CODE_FONT_SIZE,
    Math.max(MIN_CODE_FONT_SIZE, Math.round(codeFontSize)),
  );
}

const RESERVED_THEME_ALIASES = new Set(['light', 'dark', 'system']);
const RESERVED_THEME_IDS = new Set<string>(listDiscoveredThemePresetIds());

function normalizeStoredThemeDefinitions(
  themeDefinitions: AppThemeDefinition[],
): {
  themes: AppThemeDefinition[];
  didChange: boolean;
} {
  const seenThemeIds = new Set<string>();
  const normalizedThemes: AppThemeDefinition[] = [];
  let didChange = false;

  for (const themeDefinition of themeDefinitions) {
    const normalizedId = themeDefinition.id.trim().toLowerCase();
    const normalizedLabel = themeDefinition.label.trim();
    const normalizedDescription = normalizeOptionalString(themeDefinition.description);
    const normalizedPaletteLabel = normalizeOptionalString(themeDefinition.paletteLabel);
    const normalizedExtends = normalizeOptionalString(themeDefinition.extends)?.toLowerCase();
    const normalizedIconTheme = normalizeOptionalString(themeDefinition.iconTheme);
    const isReservedThemeId =
      RESERVED_THEME_ALIASES.has(normalizedId) || RESERVED_THEME_IDS.has(normalizedId);

    if (
      normalizedId.length === 0 ||
      normalizedLabel.length === 0 ||
      isReservedThemeId ||
      seenThemeIds.has(normalizedId)
    ) {
      didChange = true;
      continue;
    }

    seenThemeIds.add(normalizedId);
    normalizedThemes.push({
      ...themeDefinition,
      id: normalizedId,
      label: normalizedLabel,
      description: normalizedDescription,
      paletteLabel: normalizedPaletteLabel,
      extends: normalizedExtends,
      iconTheme: normalizedIconTheme,
    });

    if (
      normalizedId !== themeDefinition.id ||
      normalizedLabel !== themeDefinition.label ||
      normalizedDescription !== themeDefinition.description ||
      normalizedPaletteLabel !== themeDefinition.paletteLabel ||
      normalizedExtends !== themeDefinition.extends ||
      normalizedIconTheme !== themeDefinition.iconTheme
    ) {
      didChange = true;
    }
  }

  if (normalizedThemes.length !== themeDefinitions.length) {
    didChange = true;
  }

  return {
    themes: normalizedThemes,
    didChange,
  };
}

function normalizeStoredAppConfig(storedAppConfig: AppConfig): {
  config: AppConfig;
  didChange: boolean;
} {
  const normalizedCodeFont = normalizeStoredCodeFont(storedAppConfig.appearance.codeFont);
  const normalizedCodeFontSize = normalizeStoredCodeFontSize(
    storedAppConfig.appearance.codeFontSize,
  );
  const normalizedThemes = normalizeStoredThemeDefinitions(storedAppConfig.appearance.themes);

  if (
    normalizedCodeFont === storedAppConfig.appearance.codeFont &&
    normalizedCodeFontSize === storedAppConfig.appearance.codeFontSize &&
    !normalizedThemes.didChange
  ) {
    return {
      config: storedAppConfig,
      didChange: false,
    };
  }

  return {
    config: {
      ...storedAppConfig,
      appearance: {
        ...storedAppConfig.appearance,
        codeFont: normalizedCodeFont,
        codeFontSize: normalizedCodeFontSize,
        themes: normalizedThemes.themes,
      },
    },
    didChange: true,
  };
}

function stripMatchingCodexAgentSettings(
  effectiveSettings: CodexAgentSettings,
  nativeSettings: CodexAgentSettings,
): CodexAgentSettings {
  return {
    model: effectiveSettings.model === nativeSettings.model ? undefined : effectiveSettings.model,
    modelReasoningEffort:
      effectiveSettings.modelReasoningEffort === nativeSettings.modelReasoningEffort
        ? undefined
        : effectiveSettings.modelReasoningEffort,
    approvalPolicy:
      effectiveSettings.approvalPolicy === nativeSettings.approvalPolicy
        ? undefined
        : effectiveSettings.approvalPolicy,
    sandboxMode:
      effectiveSettings.sandboxMode === nativeSettings.sandboxMode
        ? undefined
        : effectiveSettings.sandboxMode,
    webSearch:
      effectiveSettings.webSearch === nativeSettings.webSearch
        ? undefined
        : effectiveSettings.webSearch,
  };
}

function stripMatchingClaudeAgentSettings(
  effectiveSettings: ClaudeCodeAgentSettings,
  nativeSettings: ClaudeCodeAgentSettings,
): ClaudeCodeAgentSettings {
  return {
    model: effectiveSettings.model === nativeSettings.model ? undefined : effectiveSettings.model,
    effort: effectiveSettings.effort === nativeSettings.effort ? undefined : effectiveSettings.effort,
    permission:
      effectiveSettings.permission === nativeSettings.permission
        ? undefined
        : effectiveSettings.permission,
  };
}

function stripMatchingOpenCodeAgentSettings(
  effectiveSettings: OpenCodeAgentSettings,
  nativeSettings: OpenCodeAgentSettings,
): OpenCodeAgentSettings {
  return {
    model: effectiveSettings.model === nativeSettings.model ? undefined : effectiveSettings.model,
    primaryAgent:
      effectiveSettings.primaryAgent === nativeSettings.primaryAgent
        ? undefined
        : effectiveSettings.primaryAgent,
  };
}

function stripNativeAgentSettings(
  effectiveAppConfig: AppConfig,
  nativeAgentSettings: AppConfig['agentSettings'],
): AppConfig {
  return {
    ...effectiveAppConfig,
    agentSettings: {
      codex: stripMatchingCodexAgentSettings(
        effectiveAppConfig.agentSettings.codex,
        nativeAgentSettings.codex,
      ),
      claudeCode: stripMatchingClaudeAgentSettings(
        effectiveAppConfig.agentSettings.claudeCode,
        nativeAgentSettings.claudeCode,
      ),
      opencode: stripMatchingOpenCodeAgentSettings(
        effectiveAppConfig.agentSettings.opencode,
        nativeAgentSettings.opencode,
      ),
    },
  };
}

function parseTomlScalar(rawValue: string): string | undefined {
  const valueWithoutComment = rawValue.split('#', 1)[0]?.trim() ?? '';

  if (valueWithoutComment.length === 0) {
    return undefined;
  }

  if (valueWithoutComment.startsWith('"') && valueWithoutComment.endsWith('"')) {
    try {
      return JSON.parse(valueWithoutComment);
    } catch {
      return valueWithoutComment.slice(1, -1);
    }
  }

  if (valueWithoutComment.startsWith("'") && valueWithoutComment.endsWith("'")) {
    return valueWithoutComment.slice(1, -1);
  }

  return valueWithoutComment;
}

function readCodexTopLevelValue(fileContents: string, key: string): string | undefined {
  const pattern = new RegExp(`^${key}\\s*=\\s*(.+)$`);

  for (const line of fileContents.split(/\r?\n/u)) {
    const trimmedLine = line.trim();

    if (trimmedLine.length === 0 || trimmedLine.startsWith('#')) {
      continue;
    }

    if (trimmedLine.startsWith('[')) {
      break;
    }

    const match = trimmedLine.match(pattern);

    if (match) {
      return parseTomlScalar(match[1]);
    }
  }

  return undefined;
}

export class ConfigStore {
  getUserDataDirectory(): string {
    return app.getPath('userData');
  }

  getGlobalConfigPath(): string {
    return path.join(this.getUserDataDirectory(), 'config.json');
  }

  getCodexNativeConfigPath(): string {
    return path.join(homedir(), '.codex', 'config.toml');
  }

  getClaudeNativeConfigPath(): string {
    return path.join(homedir(), '.claude', 'settings.json');
  }

  getRecentsPath(): string {
    return path.join(this.getUserDataDirectory(), 'recents.json');
  }

  getRemoteProjectsDirectory(): string {
    return path.join(this.getUserDataDirectory(), 'remote-projects');
  }

  getProjectStoragePaths(project: ProjectRef): ProjectStoragePaths {
    if (isLocalProject(project)) {
      const viboDir = path.join(project.locator.path, '.vibo');

      return {
        kind: 'local_vibo',
        projectRoot: project.locator.path,
        viboDir,
        projectConfigPath: path.join(viboDir, 'project.json'),
        projectUiStatePath: path.join(viboDir, 'ui-state.json'),
      };
    }

    const cacheDir = path.join(this.getRemoteProjectsDirectory(), project.fingerprint);

    return {
      kind: 'remote_cache',
      cacheDir,
      metadataPath: path.join(cacheDir, 'metadata.json'),
      projectConfigPath: path.join(cacheDir, 'project.json'),
      projectUiStatePath: path.join(cacheDir, 'ui-state.json'),
    };
  }

  createProjectCapabilities(project: ProjectRef): ProjectCapabilities {
    if (isLocalProject(project)) {
      return {
        workspace: {
          deleteMode: 'trash',
          canRevealInSystemShell: true,
          supportsImagePreview: true,
        },
        git: {
          enabled: true,
        },
        sessions: {
          supportsRecentResume: true,
        },
        skills: {
          supportsProjectLocalDiscovery: true,
        },
      };
    }

    return {
      workspace: {
        deleteMode: 'permanent',
        canRevealInSystemShell: false,
        supportsImagePreview: false,
      },
        git: {
          enabled: false,
          reason: tMain('git.remoteUnsupported'),
        },
      sessions: {
        supportsRecentResume: true,
      },
      skills: {
        supportsProjectLocalDiscovery: false,
      },
    };
  }

  async ensureGlobalFiles(): Promise<void> {
    await ensureDirectory(this.getUserDataDirectory());
    await Promise.all([this.readAppConfig(), this.readRecentProjects()]);
  }

  async ensureProjectFiles(project: ProjectRef): Promise<ProjectStoragePaths> {
    const storage = this.getProjectStoragePaths(project);

    if (storage.kind === 'local_vibo') {
      await ensureDirectory(storage.viboDir);
    } else {
      await ensureDirectory(storage.cacheDir);
      await this.writeRemoteProjectMetadata(project, storage.metadataPath);
    }

    await this.readProjectConfig(project);
    await this.readProjectUiState(project);

    return storage;
  }

  async readAppConfig(): Promise<AppConfig> {
    const [storedAppConfigRaw, nativeAgentSettings] = await Promise.all([
      this.readConfigFile(this.getGlobalConfigPath(), appConfigSchema, createDefaultAppConfig),
      this.readNativeAgentSettings(),
    ]);
    const { config: storedAppConfig, didChange } = normalizeStoredAppConfig(storedAppConfigRaw);

    if (didChange) {
      await writeJsonFile(this.getGlobalConfigPath(), storedAppConfig);
    }

    return mergeAppConfigWithNativeAgentSettings(storedAppConfig, nativeAgentSettings);
  }

  async writeAppConfig(config: AppConfig): Promise<void> {
    const normalizedConfig = appConfigSchema.parse(config);
    const nativeAgentSettings = await this.readNativeAgentSettings();

    await writeJsonFile(
      this.getGlobalConfigPath(),
      stripNativeAgentSettings(normalizedConfig, nativeAgentSettings),
    );
  }

  async readRecentProjects(): Promise<RecentProjectRecord[]> {
    return this.readConfigFile(
      this.getRecentsPath(),
      recentProjectsSchema,
      createDefaultRecentProjects,
    );
  }

  async writeRecentProjects(recentProjects: RecentProjectRecord[]): Promise<void> {
    const normalizedRecents = recentProjectsSchema.parse(recentProjects);
    await writeJsonFile(this.getRecentsPath(), normalizedRecents);
  }

  async readProjectConfig(project: ProjectRef): Promise<ProjectConfig> {
    const storage = this.getProjectStoragePaths(project);

    return this.readConfigFile(
      storage.projectConfigPath,
      projectConfigSchema,
      createDefaultProjectConfig,
    );
  }

  async writeProjectConfig(project: ProjectRef, projectConfig: ProjectConfig): Promise<void> {
    const normalizedConfig = projectConfigSchema.parse(projectConfig);
    const storage = this.getProjectStoragePaths(project);

    await writeJsonFile(storage.projectConfigPath, normalizedConfig);
  }

  async readProjectUiState(project: ProjectRef): Promise<ProjectUiState> {
    const storage = this.getProjectStoragePaths(project);

    return this.readConfigFile(
      storage.projectUiStatePath,
      projectUiStateSchema,
      createDefaultProjectUiState,
    );
  }

  async writeProjectUiState(project: ProjectRef, projectUiState: ProjectUiState): Promise<void> {
    const normalizedState = projectUiStateSchema.parse(projectUiState);
    const storage = this.getProjectStoragePaths(project);

    await writeJsonFile(storage.projectUiStatePath, normalizedState);
  }

  private async readConfigFile<T>(
    filePath: string,
    schema: ZodType<T>,
    createDefaultValue: () => T,
  ): Promise<T> {
    try {
      const raw = await readFile(filePath, 'utf8');
      return schema.parse(JSON.parse(raw));
    } catch (error) {
      const fallbackValue = createDefaultValue();

      if (!isMissingFileError(error)) {
        console.warn(`Invalid config detected at ${filePath}, rewriting with defaults.`, error);
      }

      await writeJsonFile(filePath, fallbackValue);
      return fallbackValue;
    }
  }

  private async readNativeAgentSettings(): Promise<AppConfig['agentSettings']> {
    const [codex, claudeCode] = await Promise.all([
      this.readNativeCodexAgentSettings(),
      this.readNativeClaudeAgentSettings(),
    ]);

    return {
      codex,
      claudeCode,
      opencode: {},
    };
  }

  private async readNativeCodexAgentSettings(): Promise<CodexAgentSettings> {
    try {
      const raw = await readFile(this.getCodexNativeConfigPath(), 'utf8');

      return {
        model: readCodexTopLevelValue(raw, 'model'),
        modelReasoningEffort: readCodexTopLevelValue(raw, 'model_reasoning_effort'),
        approvalPolicy: readCodexTopLevelValue(raw, 'approval_policy'),
        sandboxMode: readCodexTopLevelValue(raw, 'sandbox_mode'),
        webSearch: normalizeCodexWebSearch(readCodexTopLevelValue(raw, 'web_search')),
      };
    } catch (error) {
      if (!isMissingFileError(error)) {
        console.warn('Failed to read native Codex config.', error);
      }

      return {};
    }
  }

  private async readNativeClaudeAgentSettings(): Promise<ClaudeCodeAgentSettings> {
    try {
      const raw = await readFile(this.getClaudeNativeConfigPath(), 'utf8');
      const parsed = JSON.parse(raw) as Record<string, unknown>;

      return {
        model: normalizeOptionalString(parsed.model),
        effort: normalizeOptionalString(parsed.effortLevel),
        permission: normalizeOptionalString(parsed.defaultMode),
      };
    } catch (error) {
      if (!isMissingFileError(error)) {
        console.warn('Failed to read native Claude Code settings.', error);
      }

      return {};
    }
  }

  private async writeRemoteProjectMetadata(
    project: ProjectRef,
    metadataPath: string,
  ): Promise<void> {
    if (isLocalProject(project)) {
      return;
    }

    const metadata: RemoteProjectMetadata = {
      version: 1,
      host: project.locator.host,
      remotePath: project.locator.remotePath,
    };

    await writeJsonFile(metadataPath, metadata);
  }
}
