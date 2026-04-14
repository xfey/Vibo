import { randomUUID } from 'node:crypto';
import { rm } from 'node:fs/promises';

import { Notification, type WebContents, webContents } from 'electron';
import type { IPty } from 'node-pty';

import { focusWindowByWebContentsId } from '@main/app/windows';
import { tMain } from '@main/app/i18n';
import { ipcChannels } from '@main/ipc/channels';
import { RecentSessionsService } from '@main/services/recents/recent-sessions-service';
import type { TerminalEvent, TerminalSessionSnapshot } from '@shared/contracts/terminal';
import type { LaunchSpec } from '@shared/domain/launch';
import type { ProjectRef } from '@shared/domain/project';
import {
  isAgentTerminalKind,
  type TerminalSessionActivity,
  type TerminalSessionRecord,
} from '@shared/domain/terminal';

import { LocalPtyExecutor } from './local-pty-executor';
import { TerminalOutputBacklog } from './output-backlog';

const OUTPUT_FLUSH_INTERVAL_MS = 16;
const OUTPUT_TAIL_PREVIEW_CHARACTERS = 4000;
const MAX_TRACKED_INPUT_CHARACTERS = 4000;
const MAX_NOTIFICATION_BODY_CHARACTERS = 180;

interface SessionHandle {
  record: TerminalSessionRecord;
  project: ProjectRef;
  resumeMeta: LaunchSpec['resumeMeta'];
  process: IPty | null;
  webContentsId: number;
  outputBacklog: TerminalOutputBacklog;
  cleanupLocalPaths: string[];
  lastOutputSequence: number;
  pendingOutput: string;
  pendingUserInput: string;
  lastSubmittedUserInput: string | null;
  lastActivity: TerminalSessionActivity | null;
  flushTimer: NodeJS.Timeout | null;
}

function clampDimension(value: number): number {
  return Math.max(1, Math.floor(value));
}

function collapseWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function truncateForNotification(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1).trimEnd()}…`;
}

function isPrintableInputCharacter(value: string): boolean {
  return value >= ' ' && value !== '\u007f';
}

function skipEscapeSequence(value: string, startIndex: number): number {
  const nextCharacter = value[startIndex + 1];

  if (!nextCharacter) {
    return startIndex;
  }

  if (nextCharacter === ']') {
    for (let index = startIndex + 2; index < value.length; index += 1) {
      const character = value[index];

      if (character === '\u0007') {
        return index;
      }

      if (character === '\u001b' && value[index + 1] === '\\') {
        return Math.min(index + 1, value.length - 1);
      }
    }

    return value.length - 1;
  }

  if (nextCharacter === 'P' || nextCharacter === '^' || nextCharacter === '_') {
    for (let index = startIndex + 2; index < value.length; index += 1) {
      if (value[index] === '\u001b' && value[index + 1] === '\\') {
        return Math.min(index + 1, value.length - 1);
      }
    }

    return value.length - 1;
  }

  if (nextCharacter === '[') {
    for (let index = startIndex + 2; index < value.length; index += 1) {
      const codePoint = value.charCodeAt(index);

      if (codePoint >= 0x40 && codePoint <= 0x7e) {
        return index;
      }
    }

    return value.length - 1;
  }

  if (nextCharacter === 'O') {
    return Math.min(startIndex + 2, value.length - 1);
  }

  return Math.min(startIndex + 1, value.length - 1);
}

export class TerminalManager {
  private readonly sessions = new Map<string, SessionHandle>();
  private readonly sessionsByWindow = new Map<number, Set<string>>();
  private readonly trackedWindowIds = new Set<number>();
  private readonly activeNotifications = new Set<Notification>();

  constructor(
    private readonly executor: LocalPtyExecutor,
    private readonly recentSessionsService: RecentSessionsService,
  ) {}

  listSessionsForWindow(webContentsId: number): TerminalSessionRecord[] {
    const sessionIds = this.sessionsByWindow.get(webContentsId);

    if (!sessionIds) {
      return [];
    }

    return [...sessionIds]
      .map((sessionId) => this.sessions.get(sessionId)?.record)
      .filter((record): record is TerminalSessionRecord => Boolean(record))
      .sort((left, right) => left.startedAt - right.startedAt);
  }

  createSession(sender: WebContents, launchSpec: LaunchSpec): TerminalSessionRecord {
    this.trackWindowLifecycle(sender);

    const process = this.executor.execute(launchSpec);
    const sessionId = randomUUID();
    const record: TerminalSessionRecord = {
      id: sessionId,
      label: this.createSessionLabel(sender.id, launchSpec.displayLabel, launchSpec.kind),
      kind: launchSpec.kind,
      status: 'running',
      workingDirectory: launchSpec.workingDirectory,
      startedAt: Date.now(),
      processId: process.pid,
    };

    const handle: SessionHandle = {
      record,
      project: launchSpec.project,
      resumeMeta: launchSpec.resumeMeta,
      process,
      webContentsId: sender.id,
      outputBacklog: new TerminalOutputBacklog(),
      cleanupLocalPaths: [...(launchSpec.cleanupLocalPaths ?? [])],
      lastOutputSequence: 0,
      pendingOutput: '',
      pendingUserInput: '',
      lastSubmittedUserInput: null,
      lastActivity: null,
      flushTimer: null,
    };

    console.info('[terminal] create session', {
      sessionId,
      windowId: sender.id,
      kind: launchSpec.kind,
      workingDirectory: launchSpec.workingDirectory,
      command: launchSpec.spawn.command,
      args: launchSpec.spawn.args,
    });

    this.sessions.set(sessionId, handle);
    this.addSessionToWindow(sender.id, sessionId);

    process.onData((chunk) => {
      const currentHandle = this.sessions.get(sessionId);

      if (!currentHandle) {
        return;
      }

      currentHandle.outputBacklog.append(chunk);
      currentHandle.pendingOutput += chunk;
      currentHandle.lastOutputSequence += 1;
      this.sessions.set(sessionId, currentHandle);
      this.scheduleOutputFlush(sessionId);
    });

    process.onExit(({ exitCode }) => {
      const currentHandle = this.sessions.get(sessionId);

      if (!currentHandle) {
        return;
      }

      this.flushPendingOutput(sessionId);
      currentHandle.process = null;
      currentHandle.record = {
        ...currentHandle.record,
        status: exitCode === 0 ? 'exited' : 'failed',
        exitCode,
      };

      const outputTail = currentHandle.outputBacklog.readTail(OUTPUT_TAIL_PREVIEW_CHARACTERS);

      if (exitCode === 0) {
        console.info('[terminal] session exited', {
          sessionId,
          label: currentHandle.record.label,
          exitCode,
        });
      } else {
        console.warn('[terminal] session exited with failure', {
          sessionId,
          label: currentHandle.record.label,
          exitCode,
          outputTail,
        });
      }

      this.sessions.set(sessionId, currentHandle);
      this.cleanupLocalPaths(currentHandle);
      this.emitToWindow(sender.id, {
        type: 'session_updated',
        session: currentHandle.record,
      });
    });

    return record;
  }

  writeToSession(sessionId: string, data: string): void {
    const handle = this.sessions.get(sessionId);

    if (!handle?.process) {
      return;
    }

    this.trackSubmittedInput(handle, data);
    this.sessions.set(sessionId, handle);
    handle.process.write(data);
  }

  reportAgentActivity(sessionId: string, activity: TerminalSessionActivity): void {
    const handle = this.sessions.get(sessionId);

    if (!handle || !isAgentTerminalKind(handle.record.kind) || handle.record.status !== 'running') {
      return;
    }

    if (handle.lastActivity === activity) {
      return;
    }

    const previousActivity = handle.lastActivity;
    handle.lastActivity = activity;
    this.sessions.set(sessionId, handle);

    if (previousActivity === 'working' && activity === 'waiting_input') {
      void this.showCompletionNotification(sessionId, handle);
    }
  }

  resizeSession(sessionId: string, cols: number, rows: number): void {
    const handle = this.sessions.get(sessionId);

    if (!handle?.process) {
      return;
    }

    handle.process.resize(clampDimension(cols), clampDimension(rows));
  }

  renameSession(sessionId: string, label: string): TerminalSessionRecord | null {
    const handle = this.sessions.get(sessionId);
    const normalizedLabel = label.trim();

    if (!handle || normalizedLabel.length === 0) {
      return null;
    }

    handle.record = {
      ...handle.record,
      label: normalizedLabel,
    };

    this.sessions.set(sessionId, handle);
    this.emitToWindow(handle.webContentsId, {
      type: 'session_updated',
      session: handle.record,
    });

    return handle.record;
  }

  closeSession(sessionId: string): void {
    const handle = this.sessions.get(sessionId);

    if (!handle) {
      return;
    }

    this.clearOutputFlush(handle);
    this.sessions.delete(sessionId);
    this.sessionsByWindow.get(handle.webContentsId)?.delete(sessionId);

    try {
      handle.process?.kill();
    } catch (error) {
      console.warn(`Failed to terminate terminal session ${sessionId}.`, error);
    }

    this.cleanupLocalPaths(handle);

    this.emitToWindow(handle.webContentsId, {
      type: 'session_removed',
      sessionId,
    });
  }

  cleanupWindowSessions(webContentsId: number): void {
    const sessionIds = this.sessionsByWindow.get(webContentsId);

    if (!sessionIds) {
      return;
    }

    for (const sessionId of sessionIds) {
      const handle = this.sessions.get(sessionId);

      if (handle) {
        this.clearOutputFlush(handle);
        this.cleanupLocalPaths(handle);
      }

      try {
        handle?.process?.kill();
      } catch (error) {
        console.warn(`Failed to cleanup terminal session ${sessionId}.`, error);
      }

      if (handle) {
        this.cleanupLocalPaths(handle);
      }

      this.sessions.delete(sessionId);
    }

    this.sessionsByWindow.delete(webContentsId);
    this.trackedWindowIds.delete(webContentsId);
  }

  readSessionSnapshot(sessionId: string): TerminalSessionSnapshot | null {
    const handle = this.sessions.get(sessionId);

    if (!handle) {
      return null;
    }

    return handle.outputBacklog.readSnapshot(sessionId, handle.lastOutputSequence);
  }

  private trackSubmittedInput(handle: SessionHandle, data: string): void {
    let nextPendingInput = handle.pendingUserInput;

    for (let index = 0; index < data.length; index += 1) {
      const character = data[index];

      if (character === '\u001b') {
        index = skipEscapeSequence(data, index);
        continue;
      }

      if (character === '\r' || character === '\n') {
        const submittedInput = collapseWhitespace(nextPendingInput);

        if (submittedInput.length > 0) {
          handle.lastSubmittedUserInput = submittedInput;
        }

        nextPendingInput = '';

        if (character === '\r' && data[index + 1] === '\n') {
          index += 1;
        }

        continue;
      }

      if (character === '\u007f' || character === '\b') {
        nextPendingInput = nextPendingInput.slice(0, -1);
        continue;
      }

      if (character === '\u0015' || character === '\u0003') {
        nextPendingInput = '';
        continue;
      }

      if (!isPrintableInputCharacter(character)) {
        continue;
      }

      nextPendingInput += character;

      if (nextPendingInput.length > MAX_TRACKED_INPUT_CHARACTERS) {
        nextPendingInput = nextPendingInput.slice(-MAX_TRACKED_INPUT_CHARACTERS);
      }
    }

    handle.pendingUserInput = nextPendingInput;
  }

  private async showCompletionNotification(sessionId: string, handle: SessionHandle): Promise<void> {
    if (process.platform !== 'darwin' || !Notification.isSupported()) {
      return;
    }

    const notification = new Notification({
      title: tMain('app.notification.sessionCompleted', {
        label: handle.record.label,
      }),
      body: await this.getCompletionNotificationBody(handle),
    });

    const cleanup = () => {
      this.activeNotifications.delete(notification);
    };

    notification.on('click', () => {
      cleanup();
      this.focusSession(sessionId);
    });
    notification.on('close', cleanup);

    this.activeNotifications.add(notification);
    notification.show();
  }

  private async getCompletionNotificationBody(handle: SessionHandle): Promise<string> {
    const persistedUserMessage = await this.getPersistedLastUserMessage(handle);
    const preferredMessage =
      persistedUserMessage && this.shouldPreferPersistedUserMessage(handle.lastSubmittedUserInput)
        ? persistedUserMessage
        : handle.lastSubmittedUserInput ?? persistedUserMessage;

    if (preferredMessage) {
      const prefix = tMain('app.notification.commandCompletedPrefix');

      return `${prefix}${truncateForNotification(
        preferredMessage,
        Math.max(1, MAX_NOTIFICATION_BODY_CHARACTERS - prefix.length),
      )}`;
    }

    return tMain('app.notification.commandCompletedUnknown');
  }

  private shouldPreferPersistedUserMessage(lastSubmittedUserInput: string | null): boolean {
    if (!lastSubmittedUserInput) {
      return true;
    }

    const normalizedInput = collapseWhitespace(lastSubmittedUserInput);

    return normalizedInput.length <= 1 || normalizedInput === '$' || normalizedInput === '>';
  }

  private async getPersistedLastUserMessage(handle: SessionHandle): Promise<string | null> {
    if (!isAgentTerminalKind(handle.record.kind)) {
      return null;
    }

    try {
      return await this.recentSessionsService.findLatestUserMessage(handle.project, handle.record.kind, {
        sessionId:
          handle.resumeMeta?.source === handle.record.kind ? handle.resumeMeta.sessionId : undefined,
        startedAt: handle.record.startedAt,
      });
    } catch (error) {
      console.warn('[terminal] failed to resolve persisted user message', {
        sessionId: handle.record.id,
        kind: handle.record.kind,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  private focusSession(sessionId: string): void {
    const handle = this.sessions.get(sessionId);

    if (!handle) {
      return;
    }

    const browserWindow = focusWindowByWebContentsId(handle.webContentsId);

    if (!browserWindow) {
      return;
    }

    this.emitToWindow(handle.webContentsId, {
      type: 'session_focus_requested',
      sessionId,
    });
  }

  private createSessionLabel(
    webContentsId: number,
    baseLabel: string,
    kind: TerminalSessionRecord['kind'],
  ): string {
    const existingSessionCount = this.listSessionsForWindow(webContentsId).filter(
      (record) => record.kind === kind,
    ).length;

    return `${baseLabel} ${existingSessionCount + 1}`;
  }

  private addSessionToWindow(webContentsId: number, sessionId: string): void {
    const sessionIds = this.sessionsByWindow.get(webContentsId) ?? new Set<string>();

    sessionIds.add(sessionId);
    this.sessionsByWindow.set(webContentsId, sessionIds);
  }

  private scheduleOutputFlush(sessionId: string): void {
    const handle = this.sessions.get(sessionId);

    if (!handle || handle.flushTimer) {
      return;
    }

    handle.flushTimer = setTimeout(() => {
      this.flushPendingOutput(sessionId);
    }, OUTPUT_FLUSH_INTERVAL_MS);
    this.sessions.set(sessionId, handle);
  }

  private flushPendingOutput(sessionId: string): void {
    const handle = this.sessions.get(sessionId);

    if (!handle) {
      return;
    }

    this.clearOutputFlush(handle);

    if (handle.pendingOutput.length === 0) {
      return;
    }

    const chunk = handle.pendingOutput;
    const sequence = handle.lastOutputSequence;

    handle.pendingOutput = '';
    this.sessions.set(sessionId, handle);
    this.emitToWindow(handle.webContentsId, {
      type: 'data',
      sessionId,
      chunk,
      sequence,
    });
  }

  private clearOutputFlush(handle: SessionHandle): void {
    if (!handle.flushTimer) {
      return;
    }

    clearTimeout(handle.flushTimer);
    handle.flushTimer = null;
  }

  private emitToWindow(webContentsId: number, event: TerminalEvent): void {
    const target = webContents.fromId(webContentsId);

    if (!target || target.isDestroyed()) {
      return;
    }

    target.send(ipcChannels.terminalEvent, event);
  }

  private cleanupLocalPaths(handle: SessionHandle): void {
    const cleanupPaths = [...handle.cleanupLocalPaths];
    handle.cleanupLocalPaths = [];

    for (const cleanupPath of cleanupPaths) {
      void rm(cleanupPath, {
        force: true,
        recursive: true,
      }).catch((error) => {
        console.warn(`[terminal] failed to cleanup runtime path ${cleanupPath}`, error);
      });
    }
  }

  private trackWindowLifecycle(sender: WebContents): void {
    if (this.trackedWindowIds.has(sender.id)) {
      return;
    }

    this.trackedWindowIds.add(sender.id);
    sender.once('destroyed', () => {
      this.cleanupWindowSessions(sender.id);
    });
  }
}
