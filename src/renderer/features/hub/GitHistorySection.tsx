import type { ReactElement, UIEvent } from 'react';

import type { ProjectGitData } from '@shared/contracts/git';
import type { GitCommitFileRecord, GitCommitRecord } from '@shared/domain/git';
import { formatGitCommitDate } from '@shared/i18n';

import { getRendererLocale, tRenderer } from '@renderer/app/i18n';

interface GitHistorySectionProps {
  data: ProjectGitData | null;
  isLoading: boolean;
  isLoadingMore: boolean;
  loadError: string | null;
  expandedCommitHash: string | null;
  commitFilesByHash: Record<string, GitCommitFileRecord[]>;
  commitFilesLoadErrors: Record<string, string | undefined>;
  loadingCommitHashes: ReadonlySet<string>;
  selectedDiffKey: string | null;
  onToggleCommit: (commit: GitCommitRecord) => void;
  onSelectFile: (commit: GitCommitRecord, file: GitCommitFileRecord) => void;
  onLoadMore: () => void;
}

function formatCommitDate(unixSeconds: number): string {
  return formatGitCommitDate(getRendererLocale(), unixSeconds);
}

function getStateCopy(data: ProjectGitData | null): {
  title: string;
  detail: string;
} | null {
  if (!data) {
    return null;
  }

  switch (data.state) {
    case 'git_unavailable':
      return {
        title: tRenderer('hub.git.state.gitUnavailableTitle'),
        detail: data.reason ?? tRenderer('hub.git.state.gitUnavailableDetail'),
      };
    case 'not_repository':
      return {
        title: tRenderer('hub.git.state.notRepositoryTitle'),
        detail: data.reason ?? tRenderer('hub.git.state.notRepositoryDetail'),
      };
    case 'empty_repository':
      return {
        title: tRenderer('hub.git.state.emptyRepositoryTitle'),
        detail: data.reason ?? tRenderer('hub.git.state.emptyRepositoryDetail'),
      };
    case 'ready':
      if (data.commits.length === 0) {
        return {
          title: tRenderer('hub.git.state.emptyScopeTitle'),
          detail:
            data.scopePath.length > 0
              ? tRenderer('hub.git.state.scopeLimitedDetail', {
                  path: data.scopePath,
                })
              : tRenderer('hub.git.state.emptyScopeDetail'),
        };
      }

      return null;
    default:
      return null;
  }
}

function getVisibleRefName(commit: GitCommitRecord): string | null {
  if (commit.refNames.length === 0) {
    return null;
  }

  return commit.refNames.find((refName) => refName.includes('HEAD')) ?? commit.refNames[0];
}

function getCommitMeta(commit: GitCommitRecord): string {
  return `(${commit.hash.slice(0, 7)}, ${formatCommitDate(commit.committedAt)})`;
}

function getGitFileStatusShortLabel(file: GitCommitFileRecord): string {
  switch (file.status) {
    case 'added':
      return 'A';
    case 'modified':
      return 'M';
    case 'deleted':
      return 'D';
    case 'renamed':
      return 'R';
    case 'copied':
      return 'C';
    case 'type_changed':
      return 'T';
    case 'unmerged':
      return 'U';
    default:
      return '?';
  }
}

function getGitFileDisplayPath(file: GitCommitFileRecord): string {
  if (file.previousPath && file.previousPath !== file.path) {
    return `${file.previousPath} -> ${file.path}`;
  }

  return file.path;
}

export function GitHistorySection({
  data,
  isLoading,
  isLoadingMore,
  loadError,
  expandedCommitHash,
  commitFilesByHash,
  commitFilesLoadErrors,
  loadingCommitHashes,
  selectedDiffKey,
  onToggleCommit,
  onSelectFile,
  onLoadMore,
}: GitHistorySectionProps): ReactElement {
  const headerLabel =
    data?.branchName ??
    (data?.isDetachedHead ? tRenderer('hub.git.detachedHead') : tRenderer('hub.git'));
  const stateCopy = getStateCopy(data);

  function handleScroll(event: UIEvent<HTMLDivElement>): void {
    if (!data || data.state !== 'ready' || !data.hasMore || isLoading || isLoadingMore) {
      return;
    }

    const remainingDistance =
      event.currentTarget.scrollHeight -
      event.currentTarget.scrollTop -
      event.currentTarget.clientHeight;

    if (remainingDistance <= 24) {
      onLoadMore();
    }
  }

  return (
    <section className="hub-git-section">
      <header className="hub-sidebar-header hub-git-header">
        <div className="hub-sidebar-header-main">
          <p className="sidebar-section-title">{tRenderer('hub.git')}</p>
          <span className="hub-git-branch-chip">{headerLabel}</span>
        </div>
        {data?.scopePath ? (
          <p className="hub-git-scope-copy">
            {tRenderer('hub.gitScope', {
              path: data.scopePath,
            })}
          </p>
        ) : null}
      </header>

      <div className="hub-git-body" onScroll={handleScroll}>
        {isLoading ? (
          <div className="hub-git-state">
            <p className="hub-git-state-title">{tRenderer('hub.git.loadingTitle')}</p>
            <p className="hub-git-state-copy">{tRenderer('hub.git.loadingCopy')}</p>
          </div>
        ) : loadError ? (
          <div className="hub-git-state hub-git-state-error">
            <p className="hub-git-state-title">{tRenderer('hub.git.loadFailedTitle')}</p>
            <p className="hub-git-state-copy">{loadError}</p>
          </div>
        ) : stateCopy ? (
          <div className="hub-git-state">
            <p className="hub-git-state-title">{stateCopy.title}</p>
            <p className="hub-git-state-copy">{stateCopy.detail}</p>
          </div>
        ) : (
          <div className="hub-git-list">
            {data?.commits.map((commit, commitIndex) => {
              const visibleRefName = getVisibleRefName(commit);
              const isExpanded = expandedCommitHash === commit.hash;
              const commitFiles = commitFilesByHash[commit.hash] ?? [];
              const commitFilesLoadError = commitFilesLoadErrors[commit.hash] ?? null;
              const isCommitFilesLoading = loadingCommitHashes.has(commit.hash);
              const isFirstCommit = commitIndex === 0;
              const isLastCommit = commitIndex === data.commits.length - 1;

              return (
                <article
                  key={commit.hash}
                  className={`hub-git-commit ${isFirstCommit ? 'hub-git-commit-first' : ''} ${isLastCommit ? 'hub-git-commit-last' : ''}`}
                >
                  <div className="hub-git-graph" aria-hidden="true">
                    <span className="hub-git-graph-line hub-git-graph-line-top" />
                    <span className="hub-git-graph-dot" />
                    <span className="hub-git-graph-line hub-git-graph-line-bottom" />
                  </div>

                  <button
                    type="button"
                    className={`hub-git-commit-button ${isExpanded ? 'hub-git-commit-button-expanded' : ''}`}
                    onClick={() => {
                      onToggleCommit(commit);
                    }}
                  >
                    <div className="hub-git-commit-main" title={commit.subject}>
                      <p className="hub-git-entry-subject">{commit.subject}</p>
                      {visibleRefName ? (
                        <span className="hub-git-entry-ref" title={visibleRefName}>
                          {visibleRefName}
                        </span>
                      ) : null}
                    </div>
                    <span className="hub-git-entry-meta">{getCommitMeta(commit)}</span>
                  </button>

                  {isExpanded ? (
                    <div className="hub-git-commit-files">
                      {isCommitFilesLoading ? (
                        <p className="hub-git-inline-note">
                          {tRenderer('hub.git.commitFilesLoading')}
                        </p>
                      ) : commitFilesLoadError ? (
                        <p className="hub-git-inline-note hub-git-inline-note-error">
                          {commitFilesLoadError}
                        </p>
                      ) : commitFiles.length === 0 ? (
                        <p className="hub-git-inline-note">
                          {tRenderer('hub.git.commitFilesEmpty')}
                        </p>
                      ) : (
                        commitFiles.map((file) => {
                          const diffKey = `${commit.hash}:${file.path}`;

                          return (
                            <button
                              key={diffKey}
                              type="button"
                              className={`hub-git-file-button ${selectedDiffKey === diffKey ? 'hub-git-file-button-selected' : ''}`}
                              onClick={() => {
                                onSelectFile(commit, file);
                              }}
                              title={getGitFileDisplayPath(file)}
                            >
                              <span className={`hub-git-file-status hub-git-file-status-${file.status}`}>
                                {getGitFileStatusShortLabel(file)}
                              </span>
                              <span className="hub-git-file-path">{getGitFileDisplayPath(file)}</span>
                            </button>
                          );
                        })
                      )}
                    </div>
                  ) : null}
                </article>
              );
            })}
            {isLoadingMore ? (
              <p className="hub-git-inline-note">{tRenderer('hub.git.loadingMore')}</p>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}
