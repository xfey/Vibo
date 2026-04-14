import type { ReactElement, RefObject } from 'react';
import { useEffect, useMemo, useRef } from 'react';

import { toggleComment } from '@codemirror/commands';
import { basicSetup } from 'codemirror';
import { Compartment, EditorState, type Extension } from '@codemirror/state';
import {
  HighlightStyle,
  LanguageDescription,
  syntaxHighlighting,
} from '@codemirror/language';
import { languages } from '@codemirror/language-data';
import { EditorView, keymap } from '@codemirror/view';
import { findNext, findPrevious, search } from '@codemirror/search';
import { tags as t } from '@lezer/highlight';

import type { WorkspaceEditorMenuCommand } from '@shared/contracts/menu';
import type {
  WorkspaceFileContent,
  WorkspaceUnsupportedFileContent,
} from '@shared/contracts/workspace';

import { tRenderer } from '@renderer/app/i18n';

import {
  createHubSearchPanel,
  gotoLinePanelExtension,
  openHubGotoLine,
  openHubReplacePanel,
  openHubSearchPanel,
} from './codemirror-search-panel';

interface FilePreviewPaneProps {
  filePath: string;
  menuCommandEvent: {
    id: number;
    command: WorkspaceEditorMenuCommand;
  } | null;
  fileContent: WorkspaceFileContent | null;
  draftContent: string;
  isWordWrapEnabled: boolean;
  isLoading: boolean;
  isSaving: boolean;
  saveError: string | null;
  onChange: (nextContent: string) => void;
  onSave: () => void | Promise<void>;
  onToggleWordWrap: () => void;
}

const hubEditorTheme = EditorView.theme(
  {
    '&': {
      height: '100%',
      backgroundColor: 'transparent',
      color: 'var(--text-primary)',
      fontSize: 'var(--font-size-mono)',
    },
    '&.cm-focused': {
      outline: 'none',
    },
    '.cm-scroller': {
      overflow: 'auto',
      scrollbarGutter: 'stable',
      fontFamily: 'var(--font-family-mono)',
      lineHeight: '1.7',
    },
    '.cm-content': {
      padding: '10px 0 14px',
      caretColor: 'var(--accent)',
    },
    '.cm-line': {
      padding: '0 16px 0 0',
    },
    '.cm-gutters': {
      minWidth: '58px',
      padding: '0 0 0 6px',
      marginRight: '0',
      border: 'none',
      backgroundColor: 'transparent',
      color: 'var(--text-muted)',
    },
    '.cm-gutter': {
      backgroundColor: 'transparent',
    },
    '.cm-lineNumbers .cm-gutterElement': {
      minWidth: '100%',
      width: '100%',
      boxSizing: 'border-box',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-end',
      padding: '0 6px 0 10px',
      fontVariantNumeric: 'tabular-nums',
    },
    '.cm-activeLine': {
      backgroundColor: 'var(--surface-editor-active-line)',
    },
    '.cm-activeLineGutter': {
      backgroundColor: 'var(--surface-editor-active-line-number)',
      borderRadius: '6px 0 0 6px',
      color: 'var(--text-secondary)',
    },
    '.cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection': {
      backgroundColor: 'var(--surface-editor-selection)',
    },
    '.cm-cursor, .cm-dropCursor': {
      borderLeftColor: 'var(--accent)',
      borderLeftWidth: '2px',
      height: '1.7em !important',
      marginTop: '-0.35em',
    },
    '.cm-foldGutter': {
      display: 'none',
    },
    '.cm-panels': {
      display: 'block',
      padding: '0',
      borderBottom: '1px solid var(--border-subtle)',
      backgroundColor: 'var(--surface-editor-panel)',
      color: 'var(--text-primary)',
    },
    '.cm-panel.hub-search-panel, .cm-panel.hub-goto-line-panel': {
      '--hub-panel-row-height': '24px',
      '--hub-panel-button-size': '20px',
      width: '100%',
      boxSizing: 'border-box',
      margin: '0',
      border: 'none',
      borderRadius: '0',
      backgroundColor: 'transparent',
      boxShadow: 'none',
      padding: '0 10px',
    },
    '.cm-search.hub-search-panel, .hub-goto-line-panel': {
      display: 'grid',
      gap: '0',
      padding: '2px 0',
    },
    '.hub-search-row': {
      display: 'flex',
      alignItems: 'center',
      gap: '4px',
      minWidth: 0,
      height: 'var(--hub-panel-row-height)',
      minHeight: 'var(--hub-panel-row-height)',
      fontSize: 'var(--font-size-ui-sm)',
    },
    '.hub-search-row-primary': {
      minWidth: 0,
    },
    '.hub-search-row-replace': {
      display: 'none',
      minWidth: 0,
      paddingTop: '2px',
    },
    '.hub-search-panel-replace-expanded .hub-search-row-replace': {
      display: 'flex',
    },
    '.hub-search-field': {
      minWidth: 0,
      height: 'var(--hub-panel-row-height)',
      minHeight: 'var(--hub-panel-row-height)',
      padding: '0 6px 0 0',
      border: 'none',
      borderRadius: '0',
      backgroundColor: 'transparent',
      color: 'var(--text-primary)',
      fontFamily: 'var(--font-family-mono)',
      fontSize: 'var(--font-size-ui-sm)',
      lineHeight: 'var(--hub-panel-row-height)',
    },
    '.hub-search-field:focus': {
      outline: 'none',
      boxShadow: 'none',
    },
    '.hub-search-field-find': {
      flex: '1 1 auto',
    },
    '.hub-goto-line-field': {
      flex: '1 1 auto',
      width: '100%',
    },
    '.hub-search-field-replace': {
      flex: '1 1 auto',
    },
    '.hub-search-button': {
      width: 'var(--hub-panel-button-size)',
      height: 'var(--hub-panel-button-size)',
      minWidth: 'var(--hub-panel-button-size)',
      minHeight: 'var(--hub-panel-button-size)',
      padding: '0',
      border: 'none',
      backgroundColor: 'transparent',
      color: 'var(--text-muted)',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: '0',
      boxShadow: 'none',
      fontFamily: 'var(--font-family-ui)',
      fontSize: '14px',
      lineHeight: '1',
    },
    '.hub-search-button:hover': {
      color: 'var(--text-primary)',
      backgroundColor: 'transparent',
    },
    '.hub-search-button:focus': {
      outline: 'none',
      color: 'var(--text-primary)',
    },
    '.hub-search-button-active': {
      color: 'var(--text-primary)',
    },
    '.hub-search-button-case': {
      fontSize: '12px',
      fontWeight: '700',
      letterSpacing: '-0.01em',
    },
    '.hub-search-button-regexp': {
      fontSize: '12px',
      fontWeight: '700',
      letterSpacing: '-0.02em',
    },
    '.hub-search-button-word': {
      width: '22px',
      minWidth: '22px',
    },
    '.hub-search-button-nav': {
      fontSize: '15px',
    },
    '.hub-search-button-expand, .hub-search-button-close': {
      fontSize: '15px',
    },
    '.hub-search-button-replace-action': {
      fontSize: '14px',
    },
    '.hub-search-word-glyph': {
      position: 'relative',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: '16px',
      minHeight: '13px',
      padding: '0 4px',
      boxSizing: 'border-box',
      fontSize: '10px',
      fontWeight: '700',
      letterSpacing: '-0.02em',
    },
    '.hub-search-word-glyph::before, .hub-search-word-glyph::after': {
      content: '""',
      position: 'absolute',
      top: '1px',
      bottom: '1px',
      width: '1px',
      backgroundColor: 'currentColor',
      opacity: '0.92',
    },
    '.hub-search-word-glyph::before': {
      left: '1px',
    },
    '.hub-search-word-glyph::after': {
      right: '1px',
    },
    '.hub-search-word-glyph-text': {
      transform: 'translateY(-0.25px)',
    },
    '.cm-matchingBracket': {
      backgroundColor: 'var(--surface-editor-bracket)',
      outline: '1px solid var(--border-subtle)',
    },
  },
  {
    dark: false,
  },
);

const hubSyntaxHighlightStyle = HighlightStyle.define([
  {
    tag: [
      t.keyword,
      t.modifier,
      t.operatorKeyword,
      t.controlKeyword,
      t.definitionKeyword,
      t.moduleKeyword,
    ],
    color: 'var(--editor-syntax-keyword)',
    fontWeight: '600',
  },
  {
    tag: [t.name, t.deleted, t.macroName],
    color: 'var(--editor-syntax-name)',
  },
  {
    tag: [t.propertyName],
    color: 'var(--editor-syntax-property)',
  },
  {
    tag: [
      t.string,
      t.docString,
      t.character,
      t.attributeValue,
      t.inserted,
      t.special(t.string),
    ],
    color: 'var(--editor-syntax-string)',
  },
  {
    tag: [t.function(t.variableName), t.function(t.propertyName)],
    color: 'var(--editor-syntax-function)',
  },
  {
    tag: [t.labelName],
    color: 'var(--editor-syntax-label)',
  },
  {
    tag: [t.color, t.constant(t.name), t.standard(t.name), t.annotation],
    color: 'var(--editor-syntax-constant)',
  },
  {
    tag: [t.definition(t.variableName), t.definition(t.propertyName)],
    color: 'var(--editor-syntax-definition)',
  },
  {
    tag: [t.className, t.typeName, t.namespace, t.self, t.typeOperator],
    color: 'var(--editor-syntax-type)',
  },
  {
    tag: [t.url, t.escape, t.regexp, t.link],
    color: 'var(--editor-syntax-link)',
  },
  {
    tag: [t.meta, t.comment, t.quote, t.processingInstruction],
    color: 'var(--editor-syntax-comment)',
    fontStyle: 'italic',
  },
  {
    tag: [t.atom, t.bool, t.special(t.variableName), t.null, t.unit],
    color: 'var(--editor-syntax-atom)',
  },
  {
    tag: [t.number, t.changed],
    color: 'var(--editor-syntax-number)',
  },
  {
    tag: [t.operator, t.derefOperator, t.arithmeticOperator, t.logicOperator],
    color: 'var(--editor-syntax-operator)',
  },
  {
    tag: [t.tagName, t.angleBracket],
    color: 'var(--editor-syntax-tag)',
  },
  {
    tag: [t.attributeName],
    color: 'var(--editor-syntax-attribute)',
  },
  {
    tag: [t.separator, t.squareBracket, t.brace, t.paren, t.punctuation],
    color: 'var(--editor-syntax-punctuation)',
  },
  {
    tag: [t.heading],
    color: 'var(--editor-syntax-heading)',
    fontWeight: '700',
  },
  {
    tag: [t.emphasis],
    fontStyle: 'italic',
  },
  {
    tag: [t.strong],
    fontWeight: '700',
  },
  {
    tag: [t.strikethrough],
    textDecoration: 'line-through',
  },
  {
    tag: [t.invalid],
    color: 'var(--editor-syntax-invalid)',
  },
]);

function getLanguageDescription(filePath: string): LanguageDescription | null {
  const fileName = filePath.split('/').filter(Boolean).at(-1) ?? filePath;
  const directMatch = LanguageDescription.matchFilename(languages, fileName);

  if (directMatch) {
    return directMatch;
  }

  const lowerCaseFileName = fileName.toLowerCase();

  if (lowerCaseFileName !== fileName) {
    return LanguageDescription.matchFilename(languages, lowerCaseFileName);
  }

  return null;
}

function createEditorState(
  documentContent: string,
  languageCompartment: Compartment,
  languageExtension: Extension,
  wordWrapCompartment: Compartment,
  isWordWrapEnabled: boolean,
  onSaveRef: RefObject<FilePreviewPaneProps['onSave']>,
  onChangeRef: RefObject<FilePreviewPaneProps['onChange']>,
  onToggleWordWrapRef: RefObject<FilePreviewPaneProps['onToggleWordWrap']>,
  isSyncingRef: RefObject<boolean>,
): EditorState {
  return EditorState.create({
    doc: documentContent,
    extensions: [
      basicSetup,
      search({
        top: true,
        createPanel: createHubSearchPanel,
      }),
      gotoLinePanelExtension,
      keymap.of([
        {
          key: 'Mod-s',
          preventDefault: true,
          run: () => {
            void onSaveRef.current?.();
            return true;
          },
        },
        {
          key: 'Mod-f',
          scope: 'editor search-panel',
          preventDefault: true,
          run: (view) => {
            openHubSearchPanel(view);
            return true;
          },
        },
        {
          key: 'Mod-g',
          scope: 'editor search-panel',
          preventDefault: true,
          run: (view) => {
            findNext(view);
            return true;
          },
          shift: (view) => {
            findPrevious(view);
            return true;
          },
        },
        {
          key: 'Mod-Alt-f',
          scope: 'editor search-panel',
          preventDefault: true,
          run: (view) => {
            openHubReplacePanel(view);
            return true;
          },
        },
        {
          key: 'Ctrl-g',
          scope: 'editor search-panel',
          preventDefault: true,
          run: (view) => {
            openHubGotoLine(view);
            return true;
          },
        },
        {
          key: 'Mod-/',
          scope: 'editor',
          preventDefault: true,
          run: (view) => {
            toggleComment(view);
            return true;
          },
        },
        {
          key: 'Alt-z',
          preventDefault: true,
          run: () => {
            onToggleWordWrapRef.current?.();
            return true;
          },
        },
      ]),
      hubEditorTheme,
      syntaxHighlighting(hubSyntaxHighlightStyle),
      languageCompartment.of(languageExtension),
      wordWrapCompartment.of(isWordWrapEnabled ? EditorView.lineWrapping : []),
      EditorView.updateListener.of((update) => {
        if (!update.docChanged || isSyncingRef.current) {
          return;
        }

        onChangeRef.current?.(update.state.doc.toString());
      }),
    ],
  });
}

function formatByteSize(byteSize: number | null): string | null {
  if (byteSize === null) {
    return null;
  }

  if (byteSize < 1024) {
    return `${byteSize} B`;
  }

  if (byteSize < 1024 * 1024) {
    return `${(byteSize / 1024).toFixed(byteSize < 10 * 1024 ? 1 : 0)} KB`;
  }

  return `${(byteSize / (1024 * 1024)).toFixed(byteSize < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

function getFileExtensionLabel(filePath: string): string {
  const fileName = filePath.split('/').at(-1)?.trim() ?? '';
  const extension = fileName.includes('.') ? fileName.split('.').at(-1)?.trim() ?? '' : '';

  if (!extension) {
    return 'FILE';
  }

  return extension.toUpperCase();
}

function getUnsupportedStatusLabel(filePath: string, fileContent: WorkspaceUnsupportedFileContent): string {
  const metaSegments = [getFileExtensionLabel(filePath), formatByteSize(fileContent.byteSize)].filter(
    (segment): segment is string => typeof segment === 'string' && segment.length > 0,
  );

  return metaSegments.join(' / ');
}

function runEditorMenuCommand(view: EditorView, command: WorkspaceEditorMenuCommand): void {
  switch (command) {
    case 'workspace.find':
      openHubSearchPanel(view);
      break;
    case 'workspace.find-next':
      findNext(view);
      break;
    case 'workspace.find-previous':
      findPrevious(view);
      break;
    case 'workspace.replace':
      openHubReplacePanel(view);
      break;
    case 'workspace.go-to-line':
      openHubGotoLine(view);
      break;
    case 'workspace.toggle-comment':
      toggleComment(view);
      break;
    default:
      break;
  }
}

export function FilePreviewPane({
  filePath,
  menuCommandEvent,
  fileContent,
  draftContent,
  isWordWrapEnabled,
  isLoading,
  isSaving,
  saveError,
  onChange,
  onSave,
  onToggleWordWrap,
}: FilePreviewPaneProps): ReactElement {
  const editorHostRef = useRef<HTMLDivElement | null>(null);
  const editorViewRef = useRef<EditorView | null>(null);
  const languageCompartmentRef = useRef<Compartment | null>(null);
  const wordWrapCompartmentRef = useRef<Compartment | null>(null);
  const isSyncingRef = useRef(false);
  const onChangeRef = useRef(onChange);
  const onSaveRef = useRef(onSave);
  const onToggleWordWrapRef = useRef(onToggleWordWrap);
  const languageDescription = useMemo(() => getLanguageDescription(filePath), [filePath]);
  const canEditText = fileContent?.kind === 'text';
  const hasInlineNotes = isSaving || saveError !== null;

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  useEffect(() => {
    onToggleWordWrapRef.current = onToggleWordWrap;
  }, [onToggleWordWrap]);

  useEffect(() => {
    if (!editorHostRef.current || !canEditText) {
      editorViewRef.current?.destroy();
      editorViewRef.current = null;
      languageCompartmentRef.current = null;
      wordWrapCompartmentRef.current = null;
      return;
    }

    const languageCompartment = new Compartment();
    const wordWrapCompartment = new Compartment();
    const initialLanguageExtension = languageDescription?.support?.extension ?? [];
    languageCompartmentRef.current = languageCompartment;
    wordWrapCompartmentRef.current = wordWrapCompartment;
    const editorView = new EditorView({
      state: createEditorState(
        draftContent,
        languageCompartment,
        initialLanguageExtension,
        wordWrapCompartment,
        isWordWrapEnabled,
        onSaveRef,
        onChangeRef,
        onToggleWordWrapRef,
        isSyncingRef,
      ),
      parent: editorHostRef.current,
    });

    editorView.focus();
    editorViewRef.current = editorView;
    let cancelled = false;

    async function loadLanguage(): Promise<void> {
      if (!languageDescription) {
        return;
      }

      try {
        const support = languageDescription.support ?? (await languageDescription.load());

        if (cancelled || editorViewRef.current !== editorView) {
          return;
        }

        editorView.dispatch({
          effects: languageCompartment.reconfigure(support.extension),
        });
      } catch {
        if (cancelled || editorViewRef.current !== editorView) {
          return;
        }

        editorView.dispatch({
          effects: languageCompartment.reconfigure([]),
        });
      }
    }

    void loadLanguage();

    return () => {
      cancelled = true;
      editorView.destroy();

      if (editorViewRef.current === editorView) {
        editorViewRef.current = null;
      }

      if (languageCompartmentRef.current === languageCompartment) {
        languageCompartmentRef.current = null;
      }

      if (wordWrapCompartmentRef.current === wordWrapCompartment) {
        wordWrapCompartmentRef.current = null;
      }
    };
  }, [canEditText, filePath, languageDescription]);

  useEffect(() => {
    const editorView = editorViewRef.current;

    if (!editorView || !canEditText) {
      return;
    }

    const currentDocument = editorView.state.doc.toString();

    if (currentDocument === draftContent) {
      return;
    }

    isSyncingRef.current = true;
    editorView.dispatch({
      changes: {
        from: 0,
        to: currentDocument.length,
        insert: draftContent,
      },
    });
    isSyncingRef.current = false;
  }, [canEditText, draftContent]);

  useEffect(() => {
    const editorView = editorViewRef.current;
    const wordWrapCompartment = wordWrapCompartmentRef.current;

    if (!editorView || !wordWrapCompartment || !canEditText) {
      return;
    }

    editorView.dispatch({
      effects: wordWrapCompartment.reconfigure(
        isWordWrapEnabled ? EditorView.lineWrapping : [],
      ),
    });
  }, [canEditText, isWordWrapEnabled]);

  useEffect(() => {
    const editorView = editorViewRef.current;

    if (!editorView || !canEditText || !menuCommandEvent) {
      return;
    }

    editorView.focus();
    runEditorMenuCommand(editorView, menuCommandEvent.command);
  }, [canEditText, menuCommandEvent]);

  return (
    <section className={`hub-preview-shell ${canEditText ? 'hub-preview-shell-text' : ''}`}>
      <div className="hub-preview-body">
        {hasInlineNotes ? (
          <div className="hub-preview-notes">
            {isSaving ? <p className="hub-preview-inline-note">{tRenderer('hub.preview.saving')}</p> : null}
            {saveError ? (
              <p className="hub-preview-inline-note hub-preview-inline-note-error">{saveError}</p>
            ) : null}
          </div>
        ) : null}

        <div className="hub-preview-content">
          {isLoading ? (
            <article className="hub-preview-message hub-preview-message-centered">
              <div className="hub-preview-message-stack">
                <h3 className="hub-preview-message-title">{tRenderer('hub.preview.loadingTitle')}</h3>
                <p className="body-copy">{tRenderer('hub.preview.loadingDetail')}</p>
              </div>
            </article>
          ) : canEditText ? (
            <article className="hub-editor-surface">
              <div ref={editorHostRef} className="hub-code-editor" />
            </article>
          ) : fileContent?.kind === 'image' ? (
            <article className="hub-image-surface">
              <div className="hub-image-stage">
                <img
                  className="hub-image-preview"
                  src={fileContent.dataUrl}
                  alt={filePath}
                  draggable={false}
                />
              </div>
            </article>
          ) : (
            <article className="hub-preview-message hub-preview-message-centered">
              <div className="hub-preview-message-stack">
                <h3 className="hub-preview-message-title">
                  {fileContent?.kind === 'unsupported'
                    ? fileContent.title
                    : tRenderer('workspace.notPreviewableTitle')}
                </h3>
                <p className="body-copy">
                  {fileContent?.kind === 'unsupported'
                    ? fileContent.message
                    : tRenderer('workspace.notPreviewableMessage')}
                </p>
                {fileContent?.kind === 'unsupported' ? (
                  <p className="caption-copy">
                    {getUnsupportedStatusLabel(filePath, fileContent)}
                  </p>
                ) : null}
              </div>
            </article>
          )}
        </div>
      </div>
    </section>
  );
}
