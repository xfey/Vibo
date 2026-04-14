export const PROJECT_DRAFT_TAB_ID = 'draft';
export const PROJECT_VIBO_DIRECTORY_RELATIVE_PATH = '.vibo';
export const PROJECT_DRAFT_FILE_NAME = 'draft.md';
export const PROJECT_DRAFT_RELATIVE_PATH = `${PROJECT_VIBO_DIRECTORY_RELATIVE_PATH}/${PROJECT_DRAFT_FILE_NAME}`;

export function isProjectDraftRelativePath(relativePath: string): boolean {
  return relativePath === PROJECT_DRAFT_RELATIVE_PATH;
}
