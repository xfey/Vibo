import type { MouseEvent, ReactElement } from 'react';

export interface TreeContextMenuItem {
  key: string;
  label: string;
  danger?: boolean;
}

interface TreeContextMenuProps {
  x: number;
  y: number;
  items: TreeContextMenuItem[];
  onSelect: (key: string) => void;
  onClose: () => void;
}

export function TreeContextMenu({
  x,
  y,
  items,
  onSelect,
  onClose,
}: TreeContextMenuProps): ReactElement {
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
        {items.map((item) => (
          <button
            key={item.key}
            className={`hub-context-menu-item ${item.danger ? 'hub-context-menu-item-danger' : ''}`}
            onClick={() => onSelect(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}
