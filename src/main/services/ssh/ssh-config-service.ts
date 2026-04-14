import { readFile, readdir } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';

import type { SshHostOption } from '@shared/contracts/project';

interface ParsedDirective {
  key: string;
  value: string;
}

interface SshHostMetadata {
  hostname?: string;
  user?: string;
  port?: number;
}

function expandHomePath(filePath: string): string {
  if (filePath === '~') {
    return homedir();
  }

  if (filePath.startsWith('~/')) {
    return path.join(homedir(), filePath.slice(2));
  }

  return filePath;
}

function isWildcardSegment(segment: string): boolean {
  return segment.includes('*') || segment.includes('?');
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildWildcardRegExp(pattern: string): RegExp {
  let source = '';

  for (const character of pattern) {
    if (character === '*') {
      source += '.*';
      continue;
    }

    if (character === '?') {
      source += '.';
      continue;
    }

    source += escapeRegExp(character);
  }

  return new RegExp(`^${source}$`);
}

async function expandIncludePattern(
  rawPattern: string,
  baseDirectoryPath: string,
): Promise<string[]> {
  const normalizedPatternPath = expandHomePath(rawPattern);
  const absolutePatternPath = path.isAbsolute(normalizedPatternPath)
    ? normalizedPatternPath
    : path.resolve(baseDirectoryPath, normalizedPatternPath);
  const pathSegments = absolutePatternPath.split(path.sep).filter((segment) => segment.length > 0);
  const initialPaths = absolutePatternPath.startsWith(path.sep) ? [path.sep] : ['.'];
  let candidatePaths = initialPaths;

  for (const segment of pathSegments) {
    if (!isWildcardSegment(segment)) {
      candidatePaths = candidatePaths.map((candidatePath) => path.join(candidatePath, segment));
      continue;
    }

    const matcher = buildWildcardRegExp(segment);
    const nextPaths: string[] = [];

    for (const candidatePath of candidatePaths) {
      try {
        const entries = await readdir(candidatePath, {
          withFileTypes: true,
        });

        for (const entry of entries) {
          if (matcher.test(entry.name)) {
            nextPaths.push(path.join(candidatePath, entry.name));
          }
        }
      } catch {
        // Ignore unreadable include directories and continue with other branches.
      }
    }

    candidatePaths = nextPaths;
  }

  return candidatePaths.sort((left, right) => left.localeCompare(right));
}

function stripInlineComment(line: string): string {
  let result = '';
  let activeQuote: '"' | "'" | null = null;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];

    if ((character === '"' || character === "'") && (index === 0 || line[index - 1] !== '\\')) {
      activeQuote = activeQuote === character ? null : activeQuote ?? character;
      result += character;
      continue;
    }

    if (character === '#' && activeQuote === null) {
      break;
    }

    result += character;
  }

  return result.trim();
}

function parseDirectiveLine(rawLine: string): ParsedDirective | null {
  const line = stripInlineComment(rawLine);

  if (line.length === 0) {
    return null;
  }

  let separatorIndex = line.search(/[\s=]/u);

  if (separatorIndex === -1) {
    return null;
  }

  const key = line.slice(0, separatorIndex).trim().toLowerCase();
  let value = line.slice(separatorIndex).trim();

  if (value.startsWith('=')) {
    value = value.slice(1).trim();
  }

  if (value.length === 0) {
    return null;
  }

  return {
    key,
    value,
  };
}

function parseHostAliases(rawValue: string): string[] {
  return rawValue
    .split(/\s+/u)
    .map((alias) => alias.trim())
    .filter((alias) => alias.length > 0);
}

function isConcreteHostAlias(alias: string): boolean {
  return !alias.startsWith('!') && !alias.includes('*') && !alias.includes('?');
}

function normalizeHostOption(alias: string, metadata: SshHostMetadata): SshHostOption {
  return {
    alias,
    hostname: metadata.hostname,
    user: metadata.user,
    port: metadata.port,
  };
}

function mergeHostMetadata(
  currentMetadata: SshHostMetadata,
  key: string,
  value: string,
): SshHostMetadata {
  switch (key) {
    case 'hostname':
      return currentMetadata.hostname
        ? currentMetadata
        : {
            ...currentMetadata,
            hostname: value,
          };
    case 'user':
      return currentMetadata.user
        ? currentMetadata
        : {
            ...currentMetadata,
            user: value,
          };
    case 'port': {
      if (currentMetadata.port !== undefined) {
        return currentMetadata;
      }

      const parsedPort = Number.parseInt(value, 10);

      return Number.isFinite(parsedPort)
        ? {
            ...currentMetadata,
            port: parsedPort,
          }
        : currentMetadata;
    }
    default:
      return currentMetadata;
  }
}

export class SshConfigService {
  private readonly rootConfigPath = path.join(homedir(), '.ssh', 'config');

  async listHostOptions(): Promise<SshHostOption[]> {
    const hostOptions = new Map<string, SshHostOption>();
    await this.collectHostOptionsFromConfig(this.rootConfigPath, hostOptions, new Set());

    return [...hostOptions.values()].sort((left, right) =>
      left.alias.localeCompare(right.alias, undefined, {
        sensitivity: 'base',
      }),
    );
  }

  private async collectHostOptionsFromConfig(
    configPath: string,
    hostOptions: Map<string, SshHostOption>,
    visitedPaths: Set<string>,
  ): Promise<void> {
    const normalizedConfigPath = expandHomePath(configPath);

    if (visitedPaths.has(normalizedConfigPath)) {
      return;
    }

    visitedPaths.add(normalizedConfigPath);

    let fileContents: string;

    try {
      fileContents = await readFile(normalizedConfigPath, 'utf8');
    } catch {
      return;
    }

    const configDirectoryPath = path.dirname(normalizedConfigPath);
    let currentAliases: string[] = [];
    let currentMetadata: SshHostMetadata = {};

    function flushCurrentHostBlock(): void {
      for (const alias of currentAliases) {
        if (!isConcreteHostAlias(alias) || hostOptions.has(alias)) {
          continue;
        }

        hostOptions.set(alias, normalizeHostOption(alias, currentMetadata));
      }
    }

    for (const line of fileContents.split(/\r?\n/u)) {
      const directive = parseDirectiveLine(line);

      if (!directive) {
        continue;
      }

      if (directive.key === 'include') {
        const includePatterns = directive.value.split(/\s+/u).filter(Boolean);

        for (const includePattern of includePatterns) {
          const matchedConfigPaths = await expandIncludePattern(includePattern, configDirectoryPath);

          for (const matchedConfigPath of matchedConfigPaths) {
            await this.collectHostOptionsFromConfig(matchedConfigPath, hostOptions, visitedPaths);
          }
        }

        continue;
      }

      if (directive.key === 'host') {
        flushCurrentHostBlock();
        currentAliases = parseHostAliases(directive.value);
        currentMetadata = {};
        continue;
      }

      if (directive.key === 'match') {
        flushCurrentHostBlock();
        currentAliases = [];
        currentMetadata = {};
        continue;
      }

      if (currentAliases.length === 0) {
        continue;
      }

      currentMetadata = mergeHostMetadata(currentMetadata, directive.key, directive.value);
    }

    flushCurrentHostBlock();
  }
}
