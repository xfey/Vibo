import { realpath } from 'node:fs/promises';
import path from 'node:path';

import { isLocalProject, type ProjectRef } from '@shared/domain/project';
import type { ProjectHomeSessionCard, RecentSessionRecord } from '@shared/domain/session';
import { formatProjectHomeSessionSubtitle } from '@shared/i18n';
import { getMainLocale } from '@main/app/i18n';

import { ClaudeRecentSessionProvider } from './claude-recent-session-provider';
import { CodexRecentSessionProvider } from './codex-recent-session-provider';
import { OpenCodeRecentSessionProvider } from './opencode-recent-session-provider';

function padNumber(value: number): string {
  return value.toString().padStart(2, '0');
}

async function normalizeProjectPath(projectPath: string): Promise<string> {
  try {
    return await realpath(projectPath);
  } catch {
    return path.resolve(projectPath);
  }
}

function normalizeRemoteProjectPath(projectPath: string): string {
  const normalizedPath = path.posix.normalize(projectPath.trim());

  if (normalizedPath === '.') {
    return '/';
  }

  return normalizedPath.length > 1
    ? normalizedPath.replace(/\/+$/u, '')
    : normalizedPath;
}

function formatTimestamp(unixSeconds: number): string {
  const date = new Date(unixSeconds * 1000);

  return `${date.getFullYear()}-${padNumber(date.getMonth() + 1)}-${padNumber(date.getDate())} ${padNumber(date.getHours())}:${padNumber(date.getMinutes())}`;
}

function getStartOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function formatRecentUpdateLabel(unixSeconds: number, now = new Date()): string {
  const targetDate = new Date(unixSeconds * 1000);
  const dayDifference = Math.round(
    (getStartOfDay(now) - getStartOfDay(targetDate)) / (24 * 60 * 60 * 1000),
  );

  if (dayDifference === 0) {
    return `今天 ${padNumber(targetDate.getHours())}:${padNumber(targetDate.getMinutes())}`;
  }

  if (dayDifference === 1) {
    return `昨天 ${padNumber(targetDate.getHours())}:${padNumber(targetDate.getMinutes())}`;
  }

  return formatTimestamp(unixSeconds);
}

function toProjectHomeCard(session: RecentSessionRecord): ProjectHomeSessionCard {
  return {
    id: `${session.agent}:${session.sessionId}`,
    agent: session.agent,
    title: session.lastUserMessage,
    subtitle: formatProjectHomeSessionSubtitle(getMainLocale(), session.updatedAt),
    updatedAt: session.updatedAt,
    sessionId: session.sessionId,
  };
}

export class RecentSessionsService {
  constructor(
    private readonly codexRecentSessionProvider: CodexRecentSessionProvider,
    private readonly claudeRecentSessionProvider: ClaudeRecentSessionProvider,
    private readonly openCodeRecentSessionProvider: OpenCodeRecentSessionProvider,
  ) {}

  async listCodexCardsForProject(project: ProjectRef): Promise<ProjectHomeSessionCard[]> {
    const sessions = await this.listCodexSessionsForProject(project);
    return sessions.map(toProjectHomeCard);
  }

  async listClaudeCardsForProject(project: ProjectRef): Promise<ProjectHomeSessionCard[]> {
    const sessions = await this.listClaudeSessionsForProject(project);
    return sessions.map(toProjectHomeCard);
  }

  async listOpenCodeCardsForProject(project: ProjectRef): Promise<ProjectHomeSessionCard[]> {
    const sessions = await this.listOpenCodeSessionsForProject(project);
    return sessions.map(toProjectHomeCard);
  }

  async listCodexSessionsForProject(project: ProjectRef): Promise<RecentSessionRecord[]> {
    return this.listSessionsForProject(project, await this.codexRecentSessionProvider.listSessions(project));
  }

  async listClaudeSessionsForProject(project: ProjectRef): Promise<RecentSessionRecord[]> {
    return this.listSessionsForProject(
      project,
      await this.claudeRecentSessionProvider.listSessions(project),
    );
  }

  async listOpenCodeSessionsForProject(project: ProjectRef): Promise<RecentSessionRecord[]> {
    return this.listSessionsForProject(
      project,
      await this.openCodeRecentSessionProvider.listSessions(project),
    );
  }

  async findLatestUserMessage(
    project: ProjectRef,
    agent: RecentSessionRecord['agent'],
    options?: {
      sessionId?: string;
      startedAt?: number;
    },
  ): Promise<string | null> {
    const sessions =
      agent === 'codex'
        ? await this.listCodexSessionsForProject(project)
        : agent === 'claude_code'
          ? await this.listClaudeSessionsForProject(project)
          : await this.listOpenCodeSessionsForProject(project);

    if (options?.sessionId) {
      const exactSession = sessions.find((session) => session.sessionId === options.sessionId);

      if (exactSession) {
        return exactSession.lastUserMessage;
      }
    }

    if (typeof options?.startedAt === 'number') {
      const startedAt = options.startedAt;
      const matchingRecentSession = sessions
        .filter((session) => session.updatedAt * 1000 >= startedAt - 60_000)
        .sort((left, right) => right.updatedAt - left.updatedAt)[0];

      if (matchingRecentSession) {
        return matchingRecentSession.lastUserMessage;
      }
    }

    return sessions[0]?.lastUserMessage ?? null;
  }

  private async listSessionsForProject(
    project: ProjectRef,
    sessions: RecentSessionRecord[],
  ): Promise<RecentSessionRecord[]> {
    const normalizedRemoteProjectPath = isLocalProject(project)
      ? null
      : normalizeRemoteProjectPath(project.locator.remotePath);
    const matchingSessions = isLocalProject(project)
      ? await this.filterLocalSessions(project, sessions)
      : sessions.filter(
          (session) => normalizeRemoteProjectPath(session.projectPath) === normalizedRemoteProjectPath,
        );

    return matchingSessions.sort((left, right) => right.updatedAt - left.updatedAt);
  }

  private async filterLocalSessions(
    project: Extract<ProjectRef, { kind: 'local' }>,
    sessions: RecentSessionRecord[],
  ): Promise<RecentSessionRecord[]> {
    const normalizedProjectPath = await normalizeProjectPath(project.locator.path);
    const matchingSessions: RecentSessionRecord[] = [];

    for (const session of sessions) {
      const normalizedSessionPath = await normalizeProjectPath(session.projectPath);

      if (normalizedSessionPath === normalizedProjectPath) {
        matchingSessions.push(session);
      }
    }

    return matchingSessions;
  }
}
