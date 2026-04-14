import { createHash } from 'node:crypto';
import { readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';

import { parseSkillFrontmatter } from './skill-frontmatter';

export interface SkillDirectoryMetadata {
  originalName: string;
  description: string;
  license: string | null;
  compatibility: string | null;
  homepage: string | null;
  allowedTools: string[];
  metadataRaw: unknown;
  extraFrontmatterRaw: Record<string, unknown>;
}

function normalizeOptionalString(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmedValue = value.trim();
    return trimmedValue.length > 0 ? trimmedValue : null;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  return null;
}

function normalizeRequiredString(value: unknown, fallbackValue: string): string {
  return normalizeOptionalString(value) ?? fallbackValue;
}

function normalizeAllowedTools(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((entry) => normalizeOptionalString(entry))
      .filter((entry): entry is string => entry !== null);
  }

  const normalizedValue = normalizeOptionalString(value);

  return normalizedValue ? [normalizedValue] : [];
}

export function createShortHash(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 8);
}

export async function pathExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function normalizePath(filePath: string): Promise<string> {
  try {
    return await realpath(filePath);
  } catch {
    return path.resolve(filePath);
  }
}

export async function readSkillDirectoryMetadata(
  directoryPath: string,
): Promise<SkillDirectoryMetadata> {
  const skillMarkdown = await readFile(path.join(directoryPath, 'SKILL.md'), 'utf8');
  const parsedFrontmatter = parseSkillFrontmatter(skillMarkdown);
  const attributes = parsedFrontmatter.attributes;

  return {
    originalName: normalizeRequiredString(attributes.name, path.basename(directoryPath)),
    description: normalizeOptionalString(attributes.description) ?? '',
    license: normalizeOptionalString(attributes.license),
    compatibility: normalizeOptionalString(attributes.compatibility),
    homepage: normalizeOptionalString(attributes.homepage),
    allowedTools: normalizeAllowedTools(attributes['allowed-tools'] ?? attributes.allowed_tools),
    metadataRaw: attributes.metadata ?? null,
    extraFrontmatterRaw: Object.fromEntries(
      Object.entries(attributes).filter(
        ([key]) =>
          ![
            'name',
            'description',
            'license',
            'compatibility',
            'homepage',
            'allowed-tools',
            'allowed_tools',
            'metadata',
          ].includes(key),
      ),
    ),
  };
}
