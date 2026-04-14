import type { ReactElement } from 'react';
import { getIcon } from 'material-file-icons';

import type { WorkspaceEntryKind } from '@shared/contracts/workspace';
import type { AppIconTheme } from '@shared/domain/config';

import { getFileIconThemeDescriptor, resolveBuiltInFileIconThemeId } from './icon-theme-registry';

interface FileEntryIconProps {
  entryKind: WorkspaceEntryKind;
  entryName: string;
  iconTheme: AppIconTheme;
  size?: 'sm' | 'md';
  isOpen?: boolean;
  className?: string;
}

interface FileIconThemePreviewProps {
  iconTheme: AppIconTheme;
}

function joinClassNames(...classNames: Array<string | undefined | false>): string {
  return classNames.filter(Boolean).join(' ');
}

function MaterialDirectoryGlyph({ isOpen = false }: { isOpen?: boolean }): ReactElement {
  return (
    <svg viewBox="0 0 20 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path
        d="M2.2 3.7C2.2 2.7 3 1.9 4 1.9H7.4L9.1 3.5H15.9C16.9 3.5 17.7 4.3 17.7 5.3V5.5H2.2V3.7Z"
        fill="var(--file-icon-folder-tab-fill)"
      />
      <path
        d="M2.2 5.1C2.2 4.1 3 3.3 4 3.3H15.9C16.9 3.3 17.7 4.1 17.7 5.1V12.2C17.7 13.2 16.9 14 15.9 14H4C3 14 2.2 13.2 2.2 12.2V5.1Z"
        fill={isOpen ? 'var(--file-icon-folder-open-fill)' : 'var(--file-icon-folder-fill)'}
      />
      <path
        d="M2.2 5.6H17.7"
        stroke={isOpen ? 'var(--file-icon-folder-open-line)' : 'var(--file-icon-folder-line)'}
        strokeWidth="0.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MaterialFileGlyph({ entryName }: { entryName: string }): ReactElement {
  const svgMarkup = getIcon(entryName).svg;

  return (
    <span
      className="file-entry-icon-material"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: svgMarkup }}
    />
  );
}

export function FileEntryIcon({
  entryKind,
  entryName,
  iconTheme,
  size = 'md',
  isOpen = false,
  className,
}: FileEntryIconProps): ReactElement {
  const isDirectory = entryKind === 'directory';
  const resolvedThemeId = resolveBuiltInFileIconThemeId(iconTheme);
  const icon = isDirectory ? <MaterialDirectoryGlyph isOpen={isOpen} /> : <MaterialFileGlyph entryName={entryName} />;

  return (
    <span
      className={joinClassNames(
        'file-entry-icon',
        `file-entry-icon-${size}`,
        `file-entry-icon-theme-${resolvedThemeId}`,
        className,
      )}
      aria-hidden="true"
    >
      {icon}
    </span>
  );
}

export function FileIconThemePreview({
  iconTheme,
}: FileIconThemePreviewProps): ReactElement {
  const descriptor = getFileIconThemeDescriptor(iconTheme);
  const [directoryName, primaryFileName, secondaryFileName] = descriptor.previewFiles;

  return (
    <span className="icon-theme-preview" aria-hidden="true">
      <FileEntryIcon entryKind="directory" entryName={directoryName} iconTheme={descriptor.id} size="sm" isOpen />
      <FileEntryIcon entryKind="file" entryName={primaryFileName} iconTheme={descriptor.id} size="sm" />
      <FileEntryIcon entryKind="file" entryName={secondaryFileName} iconTheme={descriptor.id} size="sm" />
    </span>
  );
}
