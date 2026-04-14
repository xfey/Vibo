import { parse, stringify } from 'yaml';

const FRONTMATTER_BOUNDARY = '---';

export interface ParsedSkillFrontmatter {
  attributes: Record<string, unknown>;
  body: string;
  hasFrontmatter: boolean;
}

function splitFrontmatter(markdown: string): ParsedSkillFrontmatter {
  const normalizedMarkdown = markdown.replace(/^\uFEFF/, '');

  if (!normalizedMarkdown.startsWith(`${FRONTMATTER_BOUNDARY}\n`)) {
    return {
      attributes: {},
      body: normalizedMarkdown,
      hasFrontmatter: false,
    };
  }

  const closingMatch = normalizedMarkdown.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);

  if (!closingMatch) {
    return {
      attributes: {},
      body: normalizedMarkdown,
      hasFrontmatter: false,
    };
  }

  const parsed = parse(closingMatch[1]);

  if (parsed !== null && (typeof parsed !== 'object' || Array.isArray(parsed))) {
    throw new Error('Skill frontmatter must be a mapping object.');
  }

  return {
    attributes: (parsed as Record<string, unknown> | null) ?? {},
    body: normalizedMarkdown.slice(closingMatch[0].length),
    hasFrontmatter: true,
  };
}

export function parseSkillFrontmatter(markdown: string): ParsedSkillFrontmatter {
  return splitFrontmatter(markdown);
}
