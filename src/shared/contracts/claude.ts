import type { ProjectHomeSessionCard } from '@shared/domain/session';

export interface ClaudeCodeAvailability {
  available: boolean;
  reason?: string;
}

export interface ClaudeCodeProjectHomeData {
  availability: ClaudeCodeAvailability;
  recentSessionCards: ProjectHomeSessionCard[];
}

export interface ResumeClaudeCodeSessionRequest {
  sessionId: string;
}
