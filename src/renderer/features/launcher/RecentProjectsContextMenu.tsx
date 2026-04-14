import type { MouseEvent, ReactElement } from 'react';

import { tRenderer } from '@renderer/app/i18n';

interface RecentProjectsContextMenuProps {
  x: number;
  y: number;
  canReveal: boolean;
  onReveal: () => void;
  onRemove: () => void;
  onClose: () => void;
}

export function RecentProjectsContextMenu({
  x,
  y,
  canReveal,
  onReveal,
  onRemove,
  onClose,
}: RecentProjectsContextMenuProps): ReactElement {
  function stopPropagation(event: MouseEvent<HTMLElement>): void {
    event.preventDefault();
    event.stopPropagation();
  }

  return (
    <div
      className="hub-context-menu-backdrop"
      onClick={onClose}
      onContextMenu={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div
        className="hub-context-menu"
        style={{ top: `${y}px`, left: `${x}px` }}
        onClick={stopPropagation}
        onContextMenu={stopPropagation}
      >
        {canReveal ? (
          <button className="hub-context-menu-item" onClick={onReveal}>
            {tRenderer('common.actions.revealInFinder')}
          </button>
        ) : null}
        <button className="hub-context-menu-item hub-context-menu-item-danger" onClick={onRemove}>
          {tRenderer('common.actions.removeFromRecents')}
        </button>
      </div>
    </div>
  );
}
