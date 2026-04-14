import { DEFAULT_ICON_THEME, type AppIconTheme, type BuiltInAppIconTheme } from '@shared/domain/config';

export interface FileIconThemeDescriptor {
  id: BuiltInAppIconTheme;
  label: string;
  description: string;
  sourceLabel: string;
  previewFiles: [string, string, string];
}

export const BUILT_IN_FILE_ICON_THEMES: FileIconThemeDescriptor[] = [
  {
    id: 'material',
    label: 'Material',
    description: '使用丰富的文件类型图标，适合快速扫读项目结构。',
    sourceLabel: 'Built-in / Material Icons',
    previewFiles: ['src', 'app.tsx', 'README.md'],
  },
];

export function isBuiltInFileIconThemeId(value: string): value is BuiltInAppIconTheme {
  return BUILT_IN_FILE_ICON_THEMES.some((theme) => theme.id === value);
}

export function resolveBuiltInFileIconThemeId(iconThemeId: AppIconTheme | undefined): BuiltInAppIconTheme {
  if (typeof iconThemeId === 'string' && isBuiltInFileIconThemeId(iconThemeId)) {
    return iconThemeId;
  }

  return DEFAULT_ICON_THEME;
}

export function getFileIconThemeDescriptor(
  iconThemeId: AppIconTheme | undefined,
): FileIconThemeDescriptor {
  const resolvedId = resolveBuiltInFileIconThemeId(iconThemeId);
  return BUILT_IN_FILE_ICON_THEMES.find((theme) => theme.id === resolvedId) ?? BUILT_IN_FILE_ICON_THEMES[0];
}
