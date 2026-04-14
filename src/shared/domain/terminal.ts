import type { LaunchSpec } from './launch';

export type TerminalSessionStatus = 'idle' | 'starting' | 'running' | 'exited' | 'failed';
export type TerminalSessionActivity = 'working' | 'waiting_input';

const TERMINAL_SESSION_ACTIVITY_PAYLOAD_PREFIX = 'vibo-agent-activity:';

export const TERMINAL_SESSION_ACTIVITY_OSC = 9001;

export interface TerminalSessionRecord {
  id: string;
  label: string;
  kind: LaunchSpec['kind'];
  status: TerminalSessionStatus;
  workingDirectory: string;
  startedAt: number;
  processId?: number;
  exitCode?: number | null;
  error?: string;
}

export function isAgentTerminalKind(
  kind: TerminalSessionRecord['kind'],
): kind is 'codex' | 'claude_code' | 'opencode' {
  return kind === 'codex' || kind === 'claude_code' || kind === 'opencode';
}

export function createTerminalSessionActivityPayload(activity: TerminalSessionActivity): string {
  return `${TERMINAL_SESSION_ACTIVITY_PAYLOAD_PREFIX}${activity}`;
}

export function parseTerminalSessionActivityPayload(
  value: string,
): TerminalSessionActivity | null {
  if (!value.startsWith(TERMINAL_SESSION_ACTIVITY_PAYLOAD_PREFIX)) {
    return null;
  }

  const activity = value.slice(TERMINAL_SESSION_ACTIVITY_PAYLOAD_PREFIX.length);

  return activity === 'working' || activity === 'waiting_input' ? activity : null;
}
