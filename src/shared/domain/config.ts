import type { AgentId } from './agent';
import type { AppLocale } from '@shared/i18n';
export type { AppLocale } from '@shared/i18n';

export const DEFAULT_CODE_FONT_LIST = 'SF Mono, Monaco, Consolas, monospace';
export const DEFAULT_CODE_FONT_SIZE = 12;
export const MIN_CODE_FONT_SIZE = 10;
export const MAX_CODE_FONT_SIZE = 24;
export const BUILT_IN_ICON_THEMES = ['material'] as const;
export const DEFAULT_THEME_PRESET = 'vibo-light';
export const DEFAULT_ICON_THEME = 'material';
export const THEME_PRESET_FILE_TYPES = ['built-in', 'custom'] as const;
export const THEME_TOKEN_NAMES = [
  'radius-md',
  'radius-lg',
  'radius-xl',
  'font-size-ui-2xs',
  'font-size-ui-xs',
  'font-size-ui-sm',
  'font-size-ui-md',
  'font-size-ui-lg',
  'font-size-ui-xl',
  'font-size-title-sm',
  'font-size-title-md',
  'font-size-title-lg',
  'line-height-tight',
  'line-height-normal',
  'line-height-relaxed',
  'project-home-card-gap',
  'surface-page',
  'surface-panel',
  'surface-panel-strong',
  'surface-toolbar',
  'surface-sidebar',
  'surface-main',
  'surface-selected',
  'surface-hover',
  'surface-card',
  'surface-card-hover',
  'surface-card-active',
  'surface-card-muted',
  'surface-card-muted-strong',
  'surface-card-note',
  'surface-card-danger',
  'surface-card-success',
  'surface-pinned',
  'surface-pinned-hover',
  'surface-overlay',
  'surface-context-menu',
  'surface-input',
  'surface-input-strong',
  'surface-editor',
  'surface-editor-gutter',
  'surface-editor-active-line',
  'surface-editor-active-line-number',
  'surface-editor-panel',
  'surface-editor-selection',
  'surface-editor-bracket',
  'surface-image-stage',
  'surface-image-preview',
  'border-subtle',
  'border-strong',
  'border-emphasis',
  'border-faint',
  'border-focus',
  'ring-focus',
  'border-danger',
  'border-danger-strong',
  'border-success',
  'text-primary',
  'text-secondary',
  'text-muted',
  'text-inverse',
  'text-danger',
  'text-success',
  'accent',
  'accent-soft',
  'danger',
  'status-dot',
  'status-dot-ring',
  'status-running',
  'status-waiting',
  'status-starting',
  'status-exited',
  'status-failed',
  'git-diff-add-background',
  'git-diff-add-foreground',
  'git-diff-delete-background',
  'git-diff-delete-foreground',
  'git-diff-hunk-background',
  'git-diff-hunk-foreground',
  'git-diff-meta-foreground',
  'button-primary-background',
  'button-primary-background-hover',
  'button-primary-foreground',
  'button-secondary-background',
  'button-secondary-background-hover',
  'button-secondary-foreground',
  'tree-icon-border',
  'tree-directory-background',
  'tree-directory-tab-background',
  'tree-directory-open-background',
  'tree-file-background',
  'tree-file-fold-background',
  'file-icon-folder-fill',
  'file-icon-folder-tab-fill',
  'file-icon-folder-open-fill',
  'file-icon-folder-line',
  'file-icon-folder-open-line',
  'shadow-soft',
  'shadow-card',
  'shadow-floating',
  'shadow-image-preview',
  'shadow-tab-active',
  'shadow-inset-emphasis',
  'shadow-inset-strong',
  'terminal-background',
  'terminal-foreground',
  'terminal-cursor',
  'terminal-cursor-accent',
  'terminal-selection-background',
  'terminal-ansi-black',
  'terminal-ansi-red',
  'terminal-ansi-green',
  'terminal-ansi-yellow',
  'terminal-ansi-blue',
  'terminal-ansi-magenta',
  'terminal-ansi-cyan',
  'terminal-ansi-white',
  'terminal-ansi-bright-black',
  'terminal-ansi-bright-red',
  'terminal-ansi-bright-green',
  'terminal-ansi-bright-yellow',
  'terminal-ansi-bright-blue',
  'terminal-ansi-bright-magenta',
  'terminal-ansi-bright-cyan',
  'terminal-ansi-bright-white',
  'editor-syntax-keyword',
  'editor-syntax-name',
  'editor-syntax-property',
  'editor-syntax-string',
  'editor-syntax-function',
  'editor-syntax-label',
  'editor-syntax-constant',
  'editor-syntax-definition',
  'editor-syntax-type',
  'editor-syntax-link',
  'editor-syntax-comment',
  'editor-syntax-atom',
  'editor-syntax-number',
  'editor-syntax-operator',
  'editor-syntax-tag',
  'editor-syntax-attribute',
  'editor-syntax-punctuation',
  'editor-syntax-heading',
  'editor-syntax-invalid',
] as const;

export type BuiltInAppIconTheme = (typeof BUILT_IN_ICON_THEMES)[number];
export type ThemeTokenName = (typeof THEME_TOKEN_NAMES)[number];
export type ThemePresetFileType = (typeof THEME_PRESET_FILE_TYPES)[number];
export type ResolvedTheme = 'light' | 'dark';
export type AppIconTheme = string;
export type AppThemePresetId = string;
export type ThemeTokenValues = Partial<Record<ThemeTokenName, string>>;

export type CodexWebSearchMode = 'disabled' | 'cached' | 'live';

export interface AppThemeDefinition {
  id: string;
  label: string;
  description?: string;
  paletteLabel?: string;
  resolvedTheme: ResolvedTheme;
  iconTheme?: AppIconTheme;
  extends?: string;
  tokens: ThemeTokenValues;
}

export interface AppThemePresetFileDefinition extends AppThemeDefinition {
  type: ThemePresetFileType;
}

export interface CodexAgentSettings {
  model?: string;
  modelReasoningEffort?: string;
  approvalPolicy?: string;
  sandboxMode?: string;
  webSearch?: CodexWebSearchMode;
}

export interface ClaudeCodeAgentSettings {
  model?: string;
  effort?: string;
  permission?: string;
}

export interface OpenCodeAgentSettings {
  model?: string;
  primaryAgent?: string;
}

export interface AppConfig {
  version: 1;
  locale: AppLocale;
  defaultAgent: AgentId;
  appearance: {
    theme: AppThemePresetId;
    codeFont: string;
    codeFontSize: number;
    themes: AppThemeDefinition[];
  };
  agentSettings: {
    codex: CodexAgentSettings;
    claudeCode: ClaudeCodeAgentSettings;
    opencode: OpenCodeAgentSettings;
  };
}

export interface ProjectConfig {
  version: 1;
  preferredAgent?: AgentId;
  agentOverrides: {
    codex: CodexAgentSettings;
    claudeCode: ClaudeCodeAgentSettings;
    opencode: OpenCodeAgentSettings;
  };
}

export interface ProjectUiState {
  version: 1;
  sidebarWidth: number;
  gitSectionHeight: number;
}
