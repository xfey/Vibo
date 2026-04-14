import type { ReactElement } from 'react';

import type { ProjectGitDiffPreview } from '@shared/contracts/git';
import type { GitCommitFileRecord, GitCommitRecord } from '@shared/domain/git';

import { tRenderer } from '@renderer/app/i18n';

interface GitDiffPreviewPaneProps {
  commit: GitCommitRecord;
  file: GitCommitFileRecord;
  diffPreview: ProjectGitDiffPreview | null;
  isLoading: boolean;
  loadError: string | null;
  onClose: () => void;
}

function getGitFileDisplayPath(file: GitCommitFileRecord): string {
  if (file.previousPath && file.previousPath !== file.path) {
    return `${file.previousPath} -> ${file.path}`;
  }

  return file.path;
}

function getGitFileStatusLabel(file: GitCommitFileRecord): string {
  switch (file.status) {
    case 'added':
      return tRenderer('hub.diff.status.added');
    case 'modified':
      return tRenderer('hub.diff.status.modified');
    case 'deleted':
      return tRenderer('hub.diff.status.deleted');
    case 'renamed':
      return tRenderer('hub.diff.status.renamed');
    case 'copied':
      return tRenderer('hub.diff.status.copied');
    case 'type_changed':
      return tRenderer('hub.diff.status.typeChanged');
    case 'unmerged':
      return tRenderer('hub.diff.status.unmerged');
    default:
      return tRenderer('hub.diff.status.changed');
  }
}

function getDiffLineTone(line: string): string {
  if (
    line.startsWith('diff --git') ||
    line.startsWith('index ') ||
    line.startsWith('--- ') ||
    line.startsWith('+++ ') ||
    line.startsWith('new file mode') ||
    line.startsWith('deleted file mode') ||
    line.startsWith('similarity index') ||
    line.startsWith('rename from ') ||
    line.startsWith('rename to ') ||
    line.startsWith('Binary files ') ||
    line.startsWith('GIT binary patch')
  ) {
    return 'meta';
  }

  if (line.startsWith('@@')) {
    return 'hunk';
  }

  if (line.startsWith('+')) {
    return 'add';
  }

  if (line.startsWith('-')) {
    return 'delete';
  }

  return 'context';
}

export function GitDiffPreviewPane({
  commit,
  file,
  diffPreview,
  isLoading,
  loadError,
  onClose,
}: GitDiffPreviewPaneProps): ReactElement {
  const fileDisplayPath = getGitFileDisplayPath(file);
  const diffLines = diffPreview?.patch.split('\n') ?? [];

  return (
    <section className="hub-preview-shell hub-diff-preview-shell">
      <div className="hub-diff-preview-body">
        <header className="hub-diff-header">
          <div className="hub-diff-header-copy">
            <p className="hub-diff-kicker">{tRenderer('hub.diff.kicker')}</p>
            <h3 className="hub-diff-title" title={fileDisplayPath}>
              {fileDisplayPath}
            </h3>
            <p className="hub-diff-meta">
              {getGitFileStatusLabel(file)} · {commit.shortHash} · {commit.subject}
            </p>
          </div>

          <button type="button" className="secondary-button" onClick={onClose}>
            {tRenderer('hub.diff.close')}
          </button>
        </header>

        <div className="hub-preview-content">
          {isLoading ? (
            <article className="hub-preview-message hub-preview-message-centered">
              <div className="hub-preview-message-stack">
                <h3 className="hub-preview-message-title">{tRenderer('hub.diff.loadingTitle')}</h3>
                <p className="body-copy">{tRenderer('hub.diff.loadingDetail')}</p>
              </div>
            </article>
          ) : loadError ? (
            <article className="hub-preview-message hub-preview-message-centered">
              <div className="hub-preview-message-stack">
                <h3 className="hub-preview-message-title">{tRenderer('hub.diff.loadFailedTitle')}</h3>
                <p className="body-copy">{loadError}</p>
              </div>
            </article>
          ) : !diffPreview || diffPreview.patch.trim().length === 0 ? (
            <article className="hub-preview-message hub-preview-message-centered">
              <div className="hub-preview-message-stack">
                <h3 className="hub-preview-message-title">{tRenderer('hub.diff.emptyTitle')}</h3>
                <p className="body-copy">{tRenderer('hub.diff.emptyDetail')}</p>
              </div>
            </article>
          ) : (
            <article className="hub-diff-surface">
              <div className="hub-diff-scroll">
                <div className="hub-diff-code">
                  {diffLines.map((line, index) => (
                    <div
                      key={`${index}:${line}`}
                      className={`hub-diff-line hub-diff-line-${getDiffLineTone(line)}`}
                    >
                      {line.length > 0 ? line : ' '}
                    </div>
                  ))}
                </div>
              </div>
            </article>
          )}
        </div>
      </div>
    </section>
  );
}
