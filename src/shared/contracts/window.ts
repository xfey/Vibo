import type { ProjectRef } from '@shared/domain/project';

export type WindowContext =
  | {
      kind: 'launcher';
    }
  | {
      kind: 'settings';
    }
  | {
      kind: 'project';
      project: ProjectRef;
    };
