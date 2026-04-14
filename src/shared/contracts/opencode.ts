import type { ProjectHomeSessionCard } from '@shared/domain/session';

export interface OpenCodeAvailability {
  available: boolean;
  reason?: string;
}

export interface OpenCodeProjectHomeData {
  availability: OpenCodeAvailability;
  recentSessionCards: ProjectHomeSessionCard[];
}

export interface ResumeOpenCodeSessionRequest {
  sessionId: string;
}
