import type { ReactElement } from 'react';

import type { WorkspaceTreeEntry } from '@shared/contracts/workspace';
import type { AppIconTheme } from '@shared/domain/config';

import { FileEntryIcon } from '@renderer/icons/file-icons';

interface FileTreeProps {
  entriesByParent: Record<string, WorkspaceTreeEntry[]>;
  expandedDirectories: ReadonlySet<string>;
  loadingDirectories: ReadonlySet<string>;
  iconTheme: AppIconTheme;
  activeContextPath: string | null;
  selectedFilePath: string | null;
  onToggleDirectory: (relativePath: string) => void;
  onSelectFile: (relativePath: string) => void;
  onPinFile: (relativePath: string) => void;
  onOpenContextMenu: (
    relativePath: string,
    kind: WorkspaceTreeEntry['kind'],
    x: number,
    y: number,
  ) => void;
}

interface FileTreeBranchProps extends FileTreeProps {
  depth: number;
  parentRelativePath: string;
}

function FileTreeBranch({
  entriesByParent,
  expandedDirectories,
  loadingDirectories,
  iconTheme,
  activeContextPath,
  selectedFilePath,
  onToggleDirectory,
  onSelectFile,
  onPinFile,
  onOpenContextMenu,
  depth,
  parentRelativePath,
}: FileTreeBranchProps): ReactElement | null {
  const entries = entriesByParent[parentRelativePath] ?? [];

  if (entries.length === 0) {
    return null;
  }

  return (
    <div className="hub-tree-branch">
      {entries.map((entry) => {
        const isDirectory = entry.kind === 'directory';
        const isExpanded = expandedDirectories.has(entry.relativePath);
        const isLoading = loadingDirectories.has(entry.relativePath);
        const isSelected = (activeContextPath ?? selectedFilePath) === entry.relativePath;

        return (
          <div key={entry.relativePath}>
            <div
              className={`hub-tree-row-shell ${isSelected ? 'hub-tree-row-shell-selected' : ''}`}
              onContextMenu={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onOpenContextMenu(entry.relativePath, entry.kind, event.clientX, event.clientY);
              }}
            >
              <button
                className="hub-tree-row"
                onClick={() =>
                  isDirectory ? onToggleDirectory(entry.relativePath) : onSelectFile(entry.relativePath)
                }
                onDoubleClick={(event) => {
                  if (isDirectory) {
                    return;
                  }

                  event.preventDefault();
                  onPinFile(entry.relativePath);
                }}
                style={{ paddingLeft: `${10 + depth * 12}px` }}
                title={entry.relativePath}
              >
                <span
                  className={`hub-tree-chevron ${isDirectory ? '' : 'hub-tree-chevron-placeholder'} ${isExpanded ? 'hub-tree-chevron-expanded' : ''}`}
                  aria-hidden="true"
                />
                <FileEntryIcon
                  entryKind={entry.kind}
                  entryName={entry.name}
                  iconTheme={iconTheme}
                  isOpen={isDirectory && isExpanded}
                />
                <span className={`hub-tree-name hub-tree-name-${entry.kind}`}>{entry.name}</span>
                {isLoading ? <span className="hub-tree-meta">...</span> : null}
              </button>
            </div>

            {isDirectory && isExpanded ? (
              <FileTreeBranch
                entriesByParent={entriesByParent}
                expandedDirectories={expandedDirectories}
                loadingDirectories={loadingDirectories}
                iconTheme={iconTheme}
                activeContextPath={activeContextPath}
                selectedFilePath={selectedFilePath}
                onToggleDirectory={onToggleDirectory}
                onSelectFile={onSelectFile}
                onPinFile={onPinFile}
                onOpenContextMenu={onOpenContextMenu}
                depth={depth + 1}
                parentRelativePath={entry.relativePath}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function FileTree(props: FileTreeProps): ReactElement {
  return <FileTreeBranch {...props} depth={0} parentRelativePath="" />;
}
