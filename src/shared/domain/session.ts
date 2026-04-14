export interface RecentSessionRecord {
  agent: 'codex' | 'claude_code' | 'opencode';
  sessionId: string;
  projectPath: string;
  createdAt: number;
  updatedAt: number;
  lastUserMessage: string;
  resumeKind: 'native_resume';
}

export interface ProjectHomeSessionCard {
  id: string;
  agent: RecentSessionRecord['agent'];
  title: string;
  subtitle: string;
  updatedAt: number;
  sessionId: string;
}
