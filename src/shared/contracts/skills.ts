import type {
  GlobalSkillRecord,
  ProjectSkillRecord,
  SkillAgentId,
} from '@shared/domain/skill';

export interface SkillOperationError {
  sourcePath: string;
  message: string;
}

export interface GlobalSkillsResponse {
  items: GlobalSkillRecord[];
  errors: SkillOperationError[];
}

export interface ProjectSkillsAgentData {
  globalSkills: GlobalSkillRecord[];
  projectSkills: ProjectSkillRecord[];
}

export interface ProjectSkillsData {
  agents: Record<SkillAgentId, ProjectSkillsAgentData>;
  errors: SkillOperationError[];
}
