import type { ProjectRef } from './project';

export type LaunchTarget =
  | {
      kind: 'agent';
      agent: 'codex' | 'claude_code' | 'opencode';
    }
  | {
      kind: 'shell_profile';
      profile: 'default_shell';
    };

export interface LaunchSpec {
  kind: 'codex' | 'claude_code' | 'opencode' | 'shell';
  spawn: {
    transport: 'local_pty';
    command: string;
    args: string[];
    envOverrides: Record<string, string>;
    cwd: string;
  };
  project: ProjectRef;
  workingDirectory: string;
  displayLabel: string;
  iconKind: 'codex' | 'claude_code' | 'opencode' | 'shell';
  resumeMeta?: {
    source: 'codex' | 'claude_code' | 'opencode';
    sessionId: string;
  };
  cleanupLocalPaths?: string[];
  capabilities: {
    supportsResume: boolean;
    supportsStatusProbe: boolean;
  };
}
