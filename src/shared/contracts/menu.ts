export type MenuCommand =
  | 'project.new-primary-session'
  | 'project.new-codex-session'
  | 'project.new-claude-code-session'
  | 'project.new-opencode-session'
  | 'project.new-shell-session'
  | 'workspace.save-active-file'
  | 'workspace.close-active-tab'
  | 'workspace.find'
  | 'workspace.find-next'
  | 'workspace.find-previous'
  | 'workspace.replace'
  | 'workspace.go-to-line'
  | 'workspace.toggle-comment'
  | 'workspace.toggle-word-wrap';

export type WorkspaceEditorMenuCommand = Extract<
  MenuCommand,
  | 'workspace.find'
  | 'workspace.find-next'
  | 'workspace.find-previous'
  | 'workspace.replace'
  | 'workspace.go-to-line'
  | 'workspace.toggle-comment'
>;

export function isWorkspaceEditorMenuCommand(
  command: MenuCommand,
): command is WorkspaceEditorMenuCommand {
  return (
    command === 'workspace.find' ||
    command === 'workspace.find-next' ||
    command === 'workspace.find-previous' ||
    command === 'workspace.replace' ||
    command === 'workspace.go-to-line' ||
    command === 'workspace.toggle-comment'
  );
}
