import type { ProjectHomeSessionCard } from '@shared/domain/session';

export interface CodexAvailability {
  available: boolean;
  reason?: string;
}

export interface CodexProjectHomeData {
  availability: CodexAvailability;
  recentSessionCards: ProjectHomeSessionCard[];
}

export interface ResumeCodexSessionRequest {
  sessionId: string;
}
