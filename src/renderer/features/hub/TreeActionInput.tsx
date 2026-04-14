import type { FormEvent, ReactElement } from 'react';
import { useEffect, useRef } from 'react';

import { tRenderer } from '@renderer/app/i18n';

interface TreeActionInputProps {
  title: string;
  scopeLabel: string;
  submitLabel: string;
  value: string;
  error: string | null;
  isSubmitting: boolean;
  onChange: (nextValue: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}

export function TreeActionInput({
  title,
  scopeLabel,
  submitLabel,
  value,
  error,
  isSubmitting,
  onChange,
  onSubmit,
  onCancel,
}: TreeActionInputProps): ReactElement {
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    onSubmit();
  }

  return (
    <form className="hub-tree-action-form" onSubmit={handleSubmit}>
      <div className="hub-tree-action-copy">
        <p className="hub-tree-action-title">{title}</p>
        <p className="hub-tree-action-scope">{scopeLabel}</p>
      </div>

      <div className="hub-tree-action-controls">
        <input
          ref={inputRef}
          className="hub-tree-action-input"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={isSubmitting}
        />

        <div className="hub-tree-action-buttons">
          <button
            type="button"
            className="secondary-button"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            {tRenderer('common.actions.cancel')}
          </button>

          <button type="submit" className="primary-button" disabled={isSubmitting}>
            {submitLabel}
          </button>
        </div>
      </div>

      {error ? <p className="hub-tree-action-error">{error}</p> : null}
    </form>
  );
}
