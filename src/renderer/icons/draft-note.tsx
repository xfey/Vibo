import type { ReactElement } from 'react';

interface DraftNoteIconProps {
  size?: 'sm' | 'md';
  className?: string;
}

export function DraftNoteIcon({
  size = 'md',
  className,
}: DraftNoteIconProps): ReactElement {
  return (
    <span
      className={['draft-note-icon', `draft-note-icon-${size}`, className].filter(Boolean).join(' ')}
      aria-hidden="true"
    >
      <svg viewBox="0 0 16 16" fill="none">
        <path
          d="M4.25 2.75h5.1L11.75 5.2v7.05a1 1 0 0 1-1 1h-6.5a1 1 0 0 1-1-1v-8.5a1 1 0 0 1 1-1Z"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
        <path
          d="M9.25 2.75v2.1a.4.4 0 0 0 .4.4h2.1"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M5.45 7.2h4.9M5.45 9.15h4.9M5.45 11.1h3.15"
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}
