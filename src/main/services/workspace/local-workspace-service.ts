import { mkdir, readdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { nativeImage, shell } from 'electron';

import type {
  ResolvedTerminalWorkspaceLink,
  WorkspaceEntryKind,
  WorkspaceFileContent,
  WorkspaceImageFileContent,
  WorkspaceTreeEntry,
} from '@shared/contracts/workspace';
import { getLocalProjectRoot, type ProjectRef } from '@shared/domain/project';
import type { WorkspaceService } from './workspace-service';
import {
  compareTreeEntries,
  createUnsupportedContent,
  isMissingFileError,
  MAX_TEXT_FILE_SIZE_BYTES,
  normalizeEntryName,
  parseTerminalWorkspaceLink,
} from './workspace-utils';
import { tMain } from '@main/app/i18n';

const MAX_IMAGE_FILE_SIZE_BYTES = 8 * 1024 * 1024;
const IMAGE_MEDIA_TYPE_BY_EXTENSION: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
};

function toUiRelativePath(projectRoot: string, targetPath: string): string {
  return path.relative(projectRoot, targetPath).split(path.sep).join('/');
}

function ensurePathInsideProject(projectRoot: string, targetPath: string): void {
  if (targetPath === projectRoot || targetPath.startsWith(`${projectRoot}${path.sep}`)) {
    return;
  }

  throw new Error(tMain('workspace.targetOutsideProject'));
}

function resolveProjectPath(project: ProjectRef, relativePath: string): string {
  const projectRoot = getLocalProjectRoot(project);
  const normalizedRelativePath = relativePath.trim();
  const targetPath = path.resolve(projectRoot, normalizedRelativePath.length > 0 ? normalizedRelativePath : '.');

  ensurePathInsideProject(projectRoot, targetPath);
  return targetPath;
}

function toWorkspaceTreeEntry(
  projectRoot: string,
  absolutePath: string,
  kind: WorkspaceEntryKind,
): WorkspaceTreeEntry {
  return {
    name: path.basename(absolutePath),
    relativePath: toUiRelativePath(projectRoot, absolutePath),
    kind,
  };
}

function getImageMediaType(absoluteFilePath: string): string | null {
  return IMAGE_MEDIA_TYPE_BY_EXTENSION[path.extname(absoluteFilePath).toLowerCase()] ?? null;
}

function toImagePreviewContent(
  relativePath: string,
  mediaType: string,
  buffer: Buffer,
): WorkspaceImageFileContent | null {
  const previewImage = nativeImage.createFromBuffer(buffer);
  const { width, height } = previewImage.getSize();

  if (previewImage.isEmpty() || width <= 0 || height <= 0) {
    return null;
  }

  return {
    kind: 'image',
    relativePath,
    byteSize: buffer.byteLength,
    mediaType,
    width,
    height,
    dataUrl: `data:${mediaType};base64,${buffer.toString('base64')}`,
  };
}

export class LocalWorkspaceService implements WorkspaceService {
  async listDirectory(project: ProjectRef, relativePath: string): Promise<WorkspaceTreeEntry[]> {
    const projectRoot = getLocalProjectRoot(project);
    const absoluteDirectoryPath = resolveProjectPath(project, relativePath);
    const directoryEntries = await readdir(absoluteDirectoryPath, {
      withFileTypes: true,
    });

    return directoryEntries
      .map((entry) => {
        const absoluteEntryPath = path.join(absoluteDirectoryPath, entry.name);

        return {
          name: entry.name,
          relativePath: toUiRelativePath(projectRoot, absoluteEntryPath),
          kind: entry.isDirectory() ? 'directory' : 'file',
        } satisfies WorkspaceTreeEntry;
      })
      .sort(compareTreeEntries);
  }

  async createEntry(
    project: ProjectRef,
    parentRelativePath: string,
    name: string,
    kind: WorkspaceEntryKind,
  ): Promise<WorkspaceTreeEntry> {
    const projectRoot = getLocalProjectRoot(project);
    const absoluteParentPath = resolveProjectPath(project, parentRelativePath);
    const parentStat = await stat(absoluteParentPath);

    if (!parentStat.isDirectory()) {
      throw new Error(tMain('workspace.notCreatableDirectory'));
    }

    const normalizedName = normalizeEntryName(name);
    const absoluteTargetPath = path.join(absoluteParentPath, normalizedName);

    if (kind === 'directory') {
      await mkdir(absoluteTargetPath);
    } else {
      await writeFile(absoluteTargetPath, '', {
        encoding: 'utf8',
        flag: 'wx',
      });
    }

    return toWorkspaceTreeEntry(projectRoot, absoluteTargetPath, kind);
  }

  async readFileContent(project: ProjectRef, relativePath: string): Promise<WorkspaceFileContent> {
    const absoluteFilePath = resolveProjectPath(project, relativePath);
    const fileStat = await stat(absoluteFilePath);
    const imageMediaType = getImageMediaType(absoluteFilePath);

    if (!fileStat.isFile()) {
      return createUnsupportedContent(
        relativePath,
        'not_a_file',
        tMain('workspace.notPreviewableTitle'),
        tMain('workspace.notPreviewableMessage'),
        null,
      );
    }

    if (imageMediaType) {
      if (fileStat.size > MAX_IMAGE_FILE_SIZE_BYTES) {
        return createUnsupportedContent(
          relativePath,
          'image_too_large',
          tMain('workspace.imageTooLargeTitle'),
          tMain('workspace.imageTooLargeMessage'),
          fileStat.size,
        );
      }

      const buffer = await readFile(absoluteFilePath);
      const imagePreview = toImagePreviewContent(relativePath, imageMediaType, buffer);

      if (imagePreview) {
        return imagePreview;
      }

      return createUnsupportedContent(
        relativePath,
        'image_decode_failed',
        tMain('workspace.imageDecodeFailedTitle'),
        tMain('workspace.imageDecodeFailedMessage'),
        fileStat.size,
      );
    }

    if (fileStat.size > MAX_TEXT_FILE_SIZE_BYTES) {
      return createUnsupportedContent(
        relativePath,
        'file_too_large',
        tMain('workspace.fileTooLargeTitle'),
        tMain('workspace.fileTooLargeMessage'),
        fileStat.size,
      );
    }

    const buffer = await readFile(absoluteFilePath);

    if (buffer.includes(0)) {
      return createUnsupportedContent(
        relativePath,
        'binary_file',
        tMain('workspace.binaryFileTitle'),
        tMain('workspace.binaryFileMessage'),
        fileStat.size,
      );
    }

    return {
      kind: 'text',
      relativePath,
      byteSize: fileStat.size,
      content: buffer.toString('utf8'),
    };
  }

  async writeFileContent(project: ProjectRef, relativePath: string, content: string): Promise<void> {
    const absoluteFilePath = resolveProjectPath(project, relativePath);
    const fileStat = await stat(absoluteFilePath);

    if (!fileStat.isFile()) {
      throw new Error(tMain('workspace.saveTextOnly'));
    }

    await writeFile(absoluteFilePath, content, 'utf8');
  }

  async renameEntry(
    project: ProjectRef,
    relativePath: string,
    nextName: string,
  ): Promise<WorkspaceTreeEntry> {
    const projectRoot = getLocalProjectRoot(project);
    const absolutePath = resolveProjectPath(project, relativePath);
    const normalizedName = normalizeEntryName(nextName);
    const entryStat = await stat(absolutePath);
    const absoluteNextPath = path.join(path.dirname(absolutePath), normalizedName);

    ensurePathInsideProject(projectRoot, absoluteNextPath);

    if (absoluteNextPath === absolutePath) {
      return toWorkspaceTreeEntry(
        projectRoot,
        absolutePath,
        entryStat.isDirectory() ? 'directory' : 'file',
      );
    }

    try {
      await stat(absoluteNextPath);
      throw new Error('同级已存在同名文件或文件夹。');
    } catch (error) {
      if (!isMissingFileError(error)) {
        throw error;
      }
    }

    await rename(absolutePath, absoluteNextPath);

    return toWorkspaceTreeEntry(
      projectRoot,
      absoluteNextPath,
      entryStat.isDirectory() ? 'directory' : 'file',
    );
  }

  async deleteEntry(project: ProjectRef, relativePath: string): Promise<void> {
    const absolutePath = resolveProjectPath(project, relativePath);
    await shell.trashItem(absolutePath);
  }

  async resolveTerminalLink(
    project: ProjectRef,
    rawText: string,
  ): Promise<ResolvedTerminalWorkspaceLink | null> {
    const projectRoot = getLocalProjectRoot(project);
    const parsedLink = parseTerminalWorkspaceLink(rawText);

    if (!parsedLink) {
      return null;
    }

    let absolutePath: string;

    try {
      absolutePath = resolveProjectPath(project, parsedLink.pathText);
    } catch {
      return null;
    }

    try {
      const targetStat = await stat(absolutePath);

      if (!targetStat.isFile()) {
        return null;
      }
    } catch (error) {
      if (isMissingFileError(error)) {
        return null;
      }

      throw error;
    }

    return {
      relativePath: toUiRelativePath(projectRoot, absolutePath),
      line: parsedLink.line,
      column: parsedLink.column,
    };
  }

  async revealEntry(project: ProjectRef, relativePath: string): Promise<void> {
    const absolutePath = resolveProjectPath(project, relativePath);
    shell.showItemInFolder(absolutePath);
  }
}
