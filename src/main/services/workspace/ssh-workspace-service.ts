import path from 'node:path';

import type {
  ResolvedTerminalWorkspaceLink,
  WorkspaceEntryKind,
  WorkspaceFileContent,
  WorkspaceTreeEntry,
} from '@shared/contracts/workspace';
import type { ProjectRef, SshProjectRef } from '@shared/domain/project';

import { joinPosixCommand, SshCommandRunner } from '@main/services/ssh/ssh-command-runner';

import type { WorkspaceService } from './workspace-service';
import {
  compareTreeEntries,
  createUnsupportedContent,
  MAX_TEXT_FILE_SIZE_BYTES,
  normalizeEntryName,
  parseTerminalWorkspaceLink,
} from './workspace-utils';
import { tMain } from '@main/app/i18n';

const READ_PAYLOAD_MARKER = '__VIBO_REMOTE_FILE_PAYLOAD__';
const IMAGE_FILE_EXTENSIONS = new Set([
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.bmp',
  '.avif',
  '.ico',
]);

function ensureSshProject(project: ProjectRef): SshProjectRef {
  if (project.kind !== 'ssh') {
    throw new Error(tMain('workspace.notSshProject'));
  }

  return project;
}

function ensureRemotePathInsideProject(projectRoot: string, targetPath: string): void {
  if (projectRoot === '/') {
    if (targetPath.startsWith('/')) {
      return;
    }
  } else if (targetPath === projectRoot || targetPath.startsWith(`${projectRoot}/`)) {
    return;
  }

  throw new Error(tMain('workspace.targetOutsideProject'));
}

function toUiRelativePath(projectRoot: string, targetPath: string): string {
  return path.posix.relative(projectRoot, targetPath);
}

function resolveProjectPath(project: SshProjectRef, relativePath: string): string {
  const normalizedRelativePath = relativePath.trim();
  const targetPath = path.posix.resolve(
    project.locator.remotePath,
    normalizedRelativePath.length > 0 ? normalizedRelativePath : '.',
  );

  ensureRemotePathInsideProject(project.locator.remotePath, targetPath);
  return targetPath;
}

function toWorkspaceTreeEntry(
  projectRoot: string,
  absolutePath: string,
  kind: WorkspaceEntryKind,
): WorkspaceTreeEntry {
  return {
    name: path.posix.basename(absolutePath),
    relativePath: toUiRelativePath(projectRoot, absolutePath),
    kind,
  };
}

function toKindFromFindType(typeMarker: string): WorkspaceEntryKind {
  return typeMarker === 'd' ? 'directory' : 'file';
}

function parseNullSeparatedPairs(stdout: Buffer): string[] {
  return stdout
    .toString('utf8')
    .split('\0')
    .filter((item) => item.length > 0);
}

function isImageFile(relativePath: string): boolean {
  return IMAGE_FILE_EXTENSIONS.has(path.posix.extname(relativePath).toLowerCase());
}

export class SshWorkspaceService implements WorkspaceService {
  constructor(private readonly sshCommandRunner: SshCommandRunner) {}

  async listDirectory(project: ProjectRef, relativePath: string): Promise<WorkspaceTreeEntry[]> {
    const sshProject = ensureSshProject(project);
    const absoluteDirectoryPath = resolveProjectPath(sshProject, relativePath);
    const output = await this.sshCommandRunner.runScript(
      sshProject.locator.host,
      [
        'set -eu',
        'target=$1',
        'if [ ! -d "$target" ]; then',
        `  printf '%s\\n' ${JSON.stringify(tMain('workspace.remotePathNotDirectory'))} >&2`,
        '  exit 1',
        'fi',
        "find \"$target\" -mindepth 1 -maxdepth 1 -printf '%P\\0%y\\0'",
      ].join('\n'),
      [absoluteDirectoryPath],
    );
    const items = parseNullSeparatedPairs(output.stdout);
    const entries: WorkspaceTreeEntry[] = [];

    for (let index = 0; index < items.length; index += 2) {
      const name = items[index];
      const typeMarker = items[index + 1];

      if (!name || !typeMarker) {
        continue;
      }

      entries.push({
        name,
        relativePath: toUiRelativePath(sshProject.locator.remotePath, path.posix.join(absoluteDirectoryPath, name)),
        kind: toKindFromFindType(typeMarker),
      });
    }

    return entries.sort(compareTreeEntries);
  }

  async createEntry(
    project: ProjectRef,
    parentRelativePath: string,
    name: string,
    kind: WorkspaceEntryKind,
  ): Promise<WorkspaceTreeEntry> {
    const sshProject = ensureSshProject(project);
    const absoluteParentPath = resolveProjectPath(sshProject, parentRelativePath);
    const normalizedName = normalizeEntryName(name);
    const absoluteTargetPath = path.posix.join(absoluteParentPath, normalizedName);

    ensureRemotePathInsideProject(sshProject.locator.remotePath, absoluteTargetPath);

    await this.sshCommandRunner.runScript(
      sshProject.locator.host,
      [
        'set -eu',
        'parent=$1',
        'target=$2',
        'entry_kind=$3',
        'if [ ! -d "$parent" ]; then',
        `  printf '%s\\n' ${JSON.stringify(tMain('workspace.notCreatableDirectory'))} >&2`,
        '  exit 1',
        'fi',
        'if [ -e "$target" ] || [ -L "$target" ]; then',
        `  printf '%s\\n' ${JSON.stringify(tMain('workspace.entryAlreadyExists'))} >&2`,
        '  exit 1',
        'fi',
        'if [ "$entry_kind" = directory ]; then',
        '  mkdir -- "$target"',
        'else',
        '  : > "$target"',
        'fi',
      ].join('\n'),
      [absoluteParentPath, absoluteTargetPath, kind],
    );

    return toWorkspaceTreeEntry(sshProject.locator.remotePath, absoluteTargetPath, kind);
  }

  async readFileContent(project: ProjectRef, relativePath: string): Promise<WorkspaceFileContent> {
    const sshProject = ensureSshProject(project);
    const absoluteFilePath = resolveProjectPath(sshProject, relativePath);
    const output = await this.sshCommandRunner.runScriptText(
      sshProject.locator.host,
      [
        'set -eu',
        'target=$1',
        'if [ ! -e "$target" ] && [ ! -L "$target" ]; then',
        `  printf '%s\\n' ${JSON.stringify(tMain('workspace.remoteTargetMissing'))} >&2`,
        '  exit 1',
        'fi',
        'if [ ! -f "$target" ]; then',
        "  printf 'kind=not_a_file\\n'",
        '  exit 0',
        'fi',
        "size=$(wc -c < \"$target\" | tr -d '[:space:]')",
        "printf 'size=%s\\n' \"$size\"",
        `if [ "$size" -gt "${MAX_TEXT_FILE_SIZE_BYTES}" ]; then`,
        "  printf 'kind=file_too_large\\n'",
        '  exit 0',
        'fi',
        "printf 'kind=text_candidate\\n'",
        `printf '${READ_PAYLOAD_MARKER}\\n'`,
        "base64 < \"$target\" | tr -d '\\n'",
      ].join('\n'),
      [absoluteFilePath],
    );
    const markerIndex = output.indexOf(`${READ_PAYLOAD_MARKER}\n`);
    const headerText = markerIndex === -1 ? output : output.slice(0, markerIndex);
    const payload = markerIndex === -1 ? '' : output.slice(markerIndex + READ_PAYLOAD_MARKER.length + 1);
    const metadata = new Map<string, string>();

    for (const line of headerText.split(/\r?\n/u)) {
      const separatorIndex = line.indexOf('=');

      if (separatorIndex <= 0) {
        continue;
      }

      metadata.set(line.slice(0, separatorIndex), line.slice(separatorIndex + 1));
    }

    const byteSize = Number.parseInt(metadata.get('size') ?? '', 10);
    const normalizedByteSize = Number.isFinite(byteSize) ? byteSize : null;
    const kind = metadata.get('kind');

    if (kind === 'not_a_file') {
      return createUnsupportedContent(
        relativePath,
        'not_a_file',
        tMain('workspace.notPreviewableTitle'),
        tMain('workspace.notPreviewableMessage'),
        normalizedByteSize,
      );
    }

    if (kind === 'file_too_large') {
      return createUnsupportedContent(
        relativePath,
        'file_too_large',
        tMain('workspace.fileTooLargeTitle'),
        tMain('workspace.fileTooLargeMessage'),
        normalizedByteSize,
      );
    }

    let buffer: Buffer;

    try {
      buffer = Buffer.from(payload.trim(), 'base64');
    } catch {
      return createUnsupportedContent(
        relativePath,
        'read_failed',
        '文件读取失败',
        '远程文件内容无法解码。',
        normalizedByteSize,
      );
    }

    if (isImageFile(relativePath)) {
      return createUnsupportedContent(
        relativePath,
        'image_decode_failed',
        '暂不支持图片预览',
        'SSH 项目当前仅支持文本文件预览，图片预览稍后补齐。',
        normalizedByteSize,
      );
    }

    if (buffer.includes(0)) {
      return createUnsupportedContent(
        relativePath,
        'binary_file',
        '当前文件暂不可预览',
        '当前阶段仅支持文本文件预览。',
        normalizedByteSize,
      );
    }

    return {
      kind: 'text',
      relativePath,
      byteSize: normalizedByteSize ?? buffer.byteLength,
      content: buffer.toString('utf8'),
    };
  }

  async writeFileContent(project: ProjectRef, relativePath: string, content: string): Promise<void> {
    const sshProject = ensureSshProject(project);
    const absoluteFilePath = resolveProjectPath(sshProject, relativePath);

    await this.sshCommandRunner.run(
      sshProject.locator.host,
      joinPosixCommand('sh', [
        '-c',
        [
          'set -eu',
          'target=$1',
          'if [ ! -f "$target" ]; then',
          "  printf '%s\\n' '当前仅支持直接保存文本文件。' >&2",
          '  exit 1',
          'fi',
          'tmp="${target}.vibo-write.$$"',
          "trap 'rm -f -- \"$tmp\"' EXIT HUP INT TERM",
          'cat > "$tmp"',
          'mv -- "$tmp" "$target"',
          'trap - EXIT HUP INT TERM',
        ].join('\n'),
        'vibo-write',
        absoluteFilePath,
      ]),
      {
        stdin: content,
      },
    );
  }

  async renameEntry(
    project: ProjectRef,
    relativePath: string,
    nextName: string,
  ): Promise<WorkspaceTreeEntry> {
    const sshProject = ensureSshProject(project);
    const absolutePath = resolveProjectPath(sshProject, relativePath);
    const normalizedName = normalizeEntryName(nextName);
    const absoluteNextPath = path.posix.join(path.posix.dirname(absolutePath), normalizedName);

    ensureRemotePathInsideProject(sshProject.locator.remotePath, absoluteNextPath);

    const output = await this.sshCommandRunner.runScriptText(
      sshProject.locator.host,
      [
        'set -eu',
        'source_path=$1',
        'target_path=$2',
        'if [ ! -e "$source_path" ] && [ ! -L "$source_path" ]; then',
        "  printf '%s\\n' '找不到待重命名的文件或文件夹。' >&2",
        '  exit 1',
        'fi',
        'if [ -d "$source_path" ] && [ ! -L "$source_path" ]; then',
        "  entry_kind='directory'",
        'else',
        "  entry_kind='file'",
        'fi',
        'if [ "$source_path" = "$target_path" ]; then',
        "  printf '%s\\n' \"$entry_kind\"",
        '  exit 0',
        'fi',
        'if [ -e "$target_path" ] || [ -L "$target_path" ]; then',
        "  printf '%s\\n' '同级已存在同名文件或文件夹。' >&2",
        '  exit 1',
        'fi',
        'mv -- "$source_path" "$target_path"',
        "printf '%s\\n' \"$entry_kind\"",
      ].join('\n'),
      [absolutePath, absoluteNextPath],
    );
    const entryKind = output.trim() === 'directory' ? 'directory' : 'file';

    return toWorkspaceTreeEntry(sshProject.locator.remotePath, absoluteNextPath, entryKind);
  }

  async deleteEntry(project: ProjectRef, relativePath: string): Promise<void> {
    const sshProject = ensureSshProject(project);
    const absolutePath = resolveProjectPath(sshProject, relativePath);

    await this.sshCommandRunner.runScript(
      sshProject.locator.host,
      [
        'set -eu',
        'target=$1',
        'if [ ! -e "$target" ] && [ ! -L "$target" ]; then',
        "  printf '%s\\n' '找不到待删除的文件或文件夹。' >&2",
        '  exit 1',
        'fi',
        'rm -rf -- "$target"',
      ].join('\n'),
      [absolutePath],
    );
  }

  async resolveTerminalLink(
    project: ProjectRef,
    rawText: string,
  ): Promise<ResolvedTerminalWorkspaceLink | null> {
    const sshProject = ensureSshProject(project);
    const parsedLink = parseTerminalWorkspaceLink(rawText);

    if (!parsedLink) {
      return null;
    }

    let absolutePath: string;

    try {
      absolutePath = resolveProjectPath(sshProject, parsedLink.pathText);
    } catch {
      return null;
    }

    const output = await this.sshCommandRunner.runScriptText(
      sshProject.locator.host,
      [
        'set -eu',
        'target=$1',
        'if [ -f "$target" ]; then',
        "  printf '%s\\n' 'file'",
        'else',
        "  printf '%s\\n' 'missing'",
        'fi',
      ].join('\n'),
      [absolutePath],
    );

    if (output.trim() !== 'file') {
      return null;
    }

    return {
      relativePath: toUiRelativePath(sshProject.locator.remotePath, absolutePath),
      line: parsedLink.line,
      column: parsedLink.column,
    };
  }

  async revealEntry(): Promise<void> {
    throw new Error('SSH 项目当前不支持在系统文件管理器中定位远程文件。');
  }
}
