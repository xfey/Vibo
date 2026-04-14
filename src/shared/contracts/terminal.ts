import type {
  TerminalSessionActivity,
  TerminalSessionRecord,
} from '@shared/domain/terminal';

export interface WriteTerminalInputRequest {
  sessionId: string;
  data: string;
}

export interface ResizeTerminalRequest {
  sessionId: string;
  cols: number;
  rows: number;
}

export interface RenameTerminalSessionRequest {
  sessionId: string;
  label: string;
}

export interface ReportTerminalAgentActivityRequest {
  sessionId: string;
  activity: TerminalSessionActivity;
}

export interface GetTerminalSessionSnapshotRequest {
  sessionId: string;
}

export interface TerminalSessionSnapshot {
  sessionId: string;
  output: string;
  lastSequence: number;
  truncated: boolean;
}

export type TerminalEvent =
  | {
      type: 'data';
      sessionId: string;
      chunk: string;
      sequence: number;
    }
  | {
      type: 'session_updated';
      session: TerminalSessionRecord;
    }
  | {
      type: 'session_removed';
      sessionId: string;
    }
  | {
      type: 'session_focus_requested';
      sessionId: string;
    };
