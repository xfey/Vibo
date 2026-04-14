import type { WorkspaceTreeEntry, WorkspaceUnsupportedFileContent } from '@shared/contracts/workspace';
import { tMain } from '@main/app/i18n';

const directoryNameCollator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base',
});

export const MAX_TEXT_FILE_SIZE_BYTES = 512 * 1024;

export function compareTreeEntries(left: WorkspaceTreeEntry, right: WorkspaceTreeEntry): number {
  if (left.kind !== right.kind) {
    return left.kind === 'directory' ? -1 : 1;
  }

  return directoryNameCollator.compare(left.name, right.name);
}

export function normalizeEntryName(name: string): string {
  const normalizedName = name.trim();

  if (normalizedName.length === 0) {
    throw new Error(tMain('workspace.nameEmpty'));
  }

  if (normalizedName === '.' || normalizedName === '..') {
    throw new Error(tMain('workspace.nameInvalid'));
  }

  if (normalizedName.includes('/') || normalizedName.includes('\\')) {
    throw new Error(tMain('workspace.nameContainsSeparator'));
  }

  return normalizedName;
}

function trimTerminalLinkText(rawText: string): string {
  return rawText
    .trim()
    .replace(/^[([{'"`<]+/, '')
    .replace(/[)\]}'"`>,]+$/, '')
    .replace(/[.,;]+$/, '')
    .replace(/:+$/, '');
}

export function parseTerminalWorkspaceLink(rawText: string): {
  pathText: string;
  line: number | null;
  column: number | null;
} | null {
  const normalizedText = trimTerminalLinkText(rawText);

  if (normalizedText.length === 0) {
    return null;
  }

  const match = /^(.*?)(?::(\d+))?(?::(\d+))?$/.exec(normalizedText);

  if (!match) {
    return null;
  }

  const [, pathText, lineText, columnText] = match;

  if (!pathText || pathText.endsWith('/')) {
    return null;
  }

  return {
    pathText,
    line: lineText ? Number.parseInt(lineText, 10) : null,
    column: columnText ? Number.parseInt(columnText, 10) : null,
  };
}

export function isMissingFileError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'ENOENT'
  );
}

export function createUnsupportedContent(
  relativePath: string,
  issueCode: WorkspaceUnsupportedFileContent['issueCode'],
  title: string,
  message: string,
  byteSize: number | null,
): WorkspaceUnsupportedFileContent {
  return {
    kind: 'unsupported',
    relativePath,
    byteSize,
    issueCode,
    title,
    message,
  };
}
