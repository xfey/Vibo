import { EditorSelection, StateEffect, StateField } from '@codemirror/state';
import {
  SearchQuery,
  closeSearchPanel,
  findNext,
  findPrevious,
  getSearchQuery,
  openSearchPanel,
  replaceNext,
  setSearchQuery,
} from '@codemirror/search';
import {
  EditorView,
  getPanel,
  runScopeHandlers,
  showPanel,
  type Command,
  type Panel,
  type ViewUpdate,
} from '@codemirror/view';

import { tRenderer } from '@renderer/app/i18n';

type FocusTarget = 'search' | 'replace';

interface GotoLinePanelState {
  value: string;
}

const openGotoLinePanelEffect = StateEffect.define<GotoLinePanelState>();
const closeGotoLinePanelEffect = StateEffect.define<null>();

function createIconButton(options: {
  label: string | HTMLElement;
  className: string;
  ariaLabel: string;
  title: string;
  onClick: () => void;
}): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `hub-search-button ${options.className}`;
  button.setAttribute('aria-label', options.ariaLabel);
  button.title = options.title;
  button.addEventListener('click', options.onClick);

  if (typeof options.label === 'string') {
    button.textContent = options.label;
  } else {
    button.append(options.label);
  }

  return button;
}

function createTextInput(options: {
  className: string;
  placeholder: string;
  ariaLabel: string;
  name: string;
  mainField?: boolean;
}): HTMLInputElement {
  const input = document.createElement('input');
  input.type = 'text';
  input.className = `hub-search-field ${options.className}`;
  input.placeholder = options.placeholder;
  input.setAttribute('aria-label', options.ariaLabel);
  input.name = options.name;
  input.setAttribute('form', '');

  if (options.mainField) {
    input.setAttribute('main-field', 'true');
  }

  return input;
}

function createWholeWordGlyph(): HTMLElement {
  const glyph = document.createElement('span');
  glyph.className = 'hub-search-word-glyph';

  const label = document.createElement('span');
  label.className = 'hub-search-word-glyph-text';
  label.textContent = 'ab';
  glyph.append(label);

  return glyph;
}

function focusAndSelect(input: HTMLInputElement): void {
  input.focus();
  input.select();
}

function runOnNextFrame(view: EditorView, callback: () => void): void {
  requestAnimationFrame(() => {
    if (!view.dom.isConnected) {
      return;
    }

    callback();
  });
}

function closeHubGotoLinePanel(view: EditorView): boolean {
  const panel = getPanel(view, createHubGotoLinePanel);

  if (!(panel instanceof HubGotoLinePanel)) {
    return false;
  }

  if (panel.dom.contains(view.root.activeElement)) {
    view.focus();
  }

  view.dispatch({
    effects: closeGotoLinePanelEffect.of(null),
  });

  return true;
}

function applyGotoLine(view: EditorView, rawValue: string): boolean {
  const state = view.state;
  const match = /^([+-])?(\d+)?(:\d+)?(%)?$/.exec(rawValue.trim());

  if (!match) {
    return false;
  }

  const startLine = state.doc.lineAt(state.selection.main.head);
  const [, sign, ln, cl, percent] = match;
  const column = cl ? Number.parseInt(cl.slice(1), 10) : 0;
  let lineNumber = ln ? Number.parseInt(ln, 10) : startLine.number;

  if (ln && percent) {
    let ratio = lineNumber / 100;

    if (sign) {
      ratio = ratio * (sign === '-' ? -1 : 1) + startLine.number / state.doc.lines;
    }

    lineNumber = Math.round(state.doc.lines * ratio);
  } else if (ln && sign) {
    lineNumber = lineNumber * (sign === '-' ? -1 : 1) + startLine.number;
  }

  const targetLine = state.doc.line(Math.max(1, Math.min(state.doc.lines, lineNumber)));
  const selection = EditorSelection.cursor(
    targetLine.from + Math.max(0, Math.min(column, targetLine.length)),
  );

  view.dispatch({
    effects: [
      closeGotoLinePanelEffect.of(null),
      EditorView.scrollIntoView(selection.from, { y: 'center' }),
    ],
    selection,
  });

  return true;
}

export class HubSearchPanel implements Panel {
  readonly dom: HTMLElement;
  readonly top = true;

  private query: SearchQuery;
  private isReplaceExpanded = false;
  private readonly searchField: HTMLInputElement;
  private readonly replaceField: HTMLInputElement;
  private readonly caseButton: HTMLButtonElement;
  private readonly regexpButton: HTMLButtonElement;
  private readonly wholeWordButton: HTMLButtonElement;
  private readonly replaceToggleButton: HTMLButtonElement;
  private readonly replaceRow: HTMLDivElement;

  constructor(private readonly view: EditorView) {
    this.query = getSearchQuery(view.state);

    this.searchField = createTextInput({
      className: 'hub-search-field-find',
      placeholder: tRenderer('search.find'),
      ariaLabel: tRenderer('search.find'),
      name: 'search',
      mainField: true,
    });
    this.searchField.value = this.query.search;
    this.searchField.addEventListener('input', () => {
      this.commit();
    });

    this.replaceField = createTextInput({
      className: 'hub-search-field-replace',
      placeholder: tRenderer('search.replace'),
      ariaLabel: tRenderer('search.replace'),
      name: 'replace',
    });
    this.replaceField.value = this.query.replace;
    this.replaceField.addEventListener('input', () => {
      this.commit();
    });

    const previousButton = createIconButton({
      label: '↑',
      className: 'hub-search-button-nav',
      ariaLabel: tRenderer('search.previousMatch'),
      title: tRenderer('search.previousMatch'),
      onClick: () => {
        findPrevious(this.view);
      },
    });

    const nextButton = createIconButton({
      label: '↓',
      className: 'hub-search-button-nav',
      ariaLabel: tRenderer('search.nextMatch'),
      title: tRenderer('search.nextMatch'),
      onClick: () => {
        findNext(this.view);
      },
    });

    this.caseButton = createIconButton({
      label: 'Aa',
      className: 'hub-search-button-toggle hub-search-button-case',
      ariaLabel: tRenderer('search.matchCase'),
      title: tRenderer('search.matchCase'),
      onClick: () => {
        this.updateQuery({
          caseSensitive: !this.query.caseSensitive,
        });
      },
    });

    this.regexpButton = createIconButton({
      label: '.*',
      className: 'hub-search-button-toggle hub-search-button-regexp',
      ariaLabel: tRenderer('search.regex'),
      title: tRenderer('search.regex'),
      onClick: () => {
        this.updateQuery({
          regexp: !this.query.regexp,
        });
      },
    });

    this.wholeWordButton = createIconButton({
      label: createWholeWordGlyph(),
      className: 'hub-search-button-toggle hub-search-button-word',
      ariaLabel: tRenderer('search.wholeWord'),
      title: tRenderer('search.wholeWord'),
      onClick: () => {
        this.updateQuery({
          wholeWord: !this.query.wholeWord,
        });
      },
    });

    this.replaceToggleButton = createIconButton({
      label: '▾',
      className: 'hub-search-button-toggle hub-search-button-expand',
      ariaLabel: tRenderer('search.toggleReplace'),
      title: tRenderer('search.toggleReplace'),
      onClick: () => {
        this.setReplaceExpanded(!this.isReplaceExpanded, 'replace');
      },
    });

    const closeButton = createIconButton({
      label: '×',
      className: 'hub-search-button-close',
      ariaLabel: tRenderer('search.closeSearch'),
      title: tRenderer('search.closeSearch'),
      onClick: () => {
        closeSearchPanel(this.view);
      },
    });

    const replaceButton = createIconButton({
      label: '↵',
      className: 'hub-search-button-replace-action',
      ariaLabel: tRenderer('search.replace'),
      title: tRenderer('search.replace'),
      onClick: () => {
        replaceNext(this.view);
      },
    });

    const topRow = document.createElement('div');
    topRow.className = 'hub-search-row hub-search-row-primary';
    topRow.append(
      this.searchField,
      previousButton,
      nextButton,
      this.caseButton,
      this.regexpButton,
      this.wholeWordButton,
      this.replaceToggleButton,
      closeButton,
    );

    this.replaceRow = document.createElement('div');
    this.replaceRow.className = 'hub-search-row hub-search-row-replace';
    this.replaceRow.append(this.replaceField, replaceButton);

    this.dom = document.createElement('div');
    this.dom.className = 'cm-search hub-search-panel';
    this.dom.addEventListener('keydown', (event) => {
      this.handleKeyDown(event);
    });
    this.dom.append(topRow, this.replaceRow);

    this.syncUiFromQuery();
  }

  mount(): void {
    focusAndSelect(this.searchField);
  }

  update(update: ViewUpdate): void {
    const nextQuery = getSearchQuery(update.state);

    if (!nextQuery.eq(this.query)) {
      this.query = nextQuery;
      this.syncUiFromQuery();
    }
  }

  setReplaceExpanded(expanded: boolean, focusTarget: FocusTarget = 'search'): void {
    this.isReplaceExpanded = expanded;
    this.dom.classList.toggle('hub-search-panel-replace-expanded', expanded);
    this.replaceToggleButton.textContent = expanded ? '▴' : '▾';
    this.replaceToggleButton.setAttribute('aria-pressed', String(expanded));

    if (focusTarget === 'replace' && expanded) {
      requestAnimationFrame(() => {
        focusAndSelect(this.replaceField);
      });
      return;
    }

    if (focusTarget === 'search') {
      requestAnimationFrame(() => {
        focusAndSelect(this.searchField);
      });
    }
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (runScopeHandlers(this.view, event, 'search-panel')) {
      event.preventDefault();
      return;
    }

    if (event.key === 'Enter' && event.target === this.searchField) {
      event.preventDefault();
      (event.shiftKey ? findPrevious : findNext)(this.view);
      return;
    }

    if (event.key === 'Enter' && event.target === this.replaceField) {
      event.preventDefault();
      replaceNext(this.view);
    }
  }

  private commit(): void {
    this.dispatchQuery({
      search: this.searchField.value,
      replace: this.replaceField.value,
      caseSensitive: this.query.caseSensitive,
      regexp: this.query.regexp,
      wholeWord: this.query.wholeWord,
    });
  }

  private updateQuery(
    partial: Partial<{
      search: string;
      replace: string;
      caseSensitive: boolean;
      regexp: boolean;
      wholeWord: boolean;
    }>,
  ): void {
    this.dispatchQuery({
      search: partial.search ?? this.searchField.value,
      replace: partial.replace ?? this.replaceField.value,
      caseSensitive: partial.caseSensitive ?? this.query.caseSensitive,
      regexp: partial.regexp ?? this.query.regexp,
      wholeWord: partial.wholeWord ?? this.query.wholeWord,
    });
  }

  private dispatchQuery(config: {
    search: string;
    replace: string;
    caseSensitive: boolean;
    regexp: boolean;
    wholeWord: boolean;
  }): void {
    const nextQuery = new SearchQuery({
      search: config.search,
      replace: config.replace,
      caseSensitive: config.caseSensitive,
      regexp: config.regexp,
      wholeWord: config.wholeWord,
    });

    if (nextQuery.eq(this.query)) {
      this.syncUiFromQuery();
      return;
    }

    this.query = nextQuery;
    this.syncUiFromQuery();
    this.view.dispatch({
      effects: setSearchQuery.of(nextQuery),
    });
  }

  private syncUiFromQuery(): void {
    if (this.searchField.value !== this.query.search) {
      this.searchField.value = this.query.search;
    }

    if (this.replaceField.value !== this.query.replace) {
      this.replaceField.value = this.query.replace;
    }

    this.caseButton.classList.toggle('hub-search-button-active', this.query.caseSensitive);
    this.caseButton.setAttribute('aria-pressed', String(this.query.caseSensitive));

    this.regexpButton.classList.toggle('hub-search-button-active', this.query.regexp);
    this.regexpButton.setAttribute('aria-pressed', String(this.query.regexp));

    this.wholeWordButton.classList.toggle('hub-search-button-active', this.query.wholeWord);
    this.wholeWordButton.setAttribute('aria-pressed', String(this.query.wholeWord));
  }
}

class HubGotoLinePanel implements Panel {
  readonly dom: HTMLElement;
  readonly top = true;

  private readonly input: HTMLInputElement;

  constructor(private readonly view: EditorView) {
    this.input = createTextInput({
      className: 'hub-search-field-find hub-goto-line-field',
      placeholder: tRenderer('search.gotoLinePlaceholder'),
      ariaLabel: tRenderer('search.gotoLine'),
      name: 'line',
      mainField: true,
    });
    this.input.value = view.state.field(gotoLinePanelState)?.value ?? '';

    const closeButton = createIconButton({
      label: '×',
      className: 'hub-search-button-close',
      ariaLabel: tRenderer('search.closeGotoLine'),
      title: tRenderer('search.closeGotoLine'),
      onClick: () => {
        this.close();
      },
    });

    const row = document.createElement('div');
    row.className = 'hub-search-row hub-search-row-primary';
    row.append(this.input, closeButton);

    this.dom = document.createElement('div');
    this.dom.className = 'hub-goto-line-panel';
    this.dom.addEventListener('keydown', (event) => {
      this.handleKeyDown(event);
    });
    this.dom.append(row);
  }

  mount(): void {
    focusAndSelect(this.input);
  }

  update(update: ViewUpdate): void {
    const nextState = update.state.field(gotoLinePanelState, false);

    if (!nextState) {
      return;
    }

    if (this.input.value !== nextState.value) {
      this.input.value = nextState.value;
    }
  }

  private handleKeyDown(event: KeyboardEvent): void {
    if (runScopeHandlers(this.view, event, 'search-panel')) {
      event.preventDefault();
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      applyGotoLine(this.view, this.input.value);
    }
  }

  private close(): void {
    this.view.dispatch({
      effects: closeGotoLinePanelEffect.of(null),
    });
  }
}

const gotoLinePanelState = StateField.define<GotoLinePanelState | null>({
  create() {
    return null;
  },
  update(value, transaction) {
    for (const effect of transaction.effects) {
      if (effect.is(openGotoLinePanelEffect)) {
        return effect.value;
      }

      if (effect.is(closeGotoLinePanelEffect)) {
        return null;
      }
    }

    return value;
  },
  provide: (field) =>
    showPanel.from(field, (value) => (value ? createHubGotoLinePanel : null)),
});

export const gotoLinePanelExtension = gotoLinePanelState;

export function createHubSearchPanel(view: EditorView): Panel {
  return new HubSearchPanel(view);
}

export function createHubGotoLinePanel(view: EditorView): Panel {
  return new HubGotoLinePanel(view);
}

export const openHubSearchPanel: Command = (view) => {
  const didCloseGotoLine = closeHubGotoLinePanel(view);

  if (didCloseGotoLine) {
    runOnNextFrame(view, () => {
      openSearchPanel(view);
    });
    return true;
  }

  openSearchPanel(view);
  return true;
};

export const openHubReplacePanel: Command = (view) => {
  const syncReplaceState = (): void => {
    const panel = getPanel(view, createHubSearchPanel);

    if (panel instanceof HubSearchPanel) {
      panel.setReplaceExpanded(true, 'replace');
    }
  };

  const openReplacePanel = (): void => {
    openSearchPanel(view);
    syncReplaceState();
    runOnNextFrame(view, syncReplaceState);
  };

  const didCloseGotoLine = closeHubGotoLinePanel(view);

  if (didCloseGotoLine) {
    runOnNextFrame(view, openReplacePanel);
    return true;
  }

  openReplacePanel();
  return true;
};

export const openHubGotoLine: Command = (view) => {
  const panel = getPanel(view, createHubGotoLinePanel);

  if (panel instanceof HubGotoLinePanel) {
    panel.mount();
    return true;
  }

  const openGotoLinePanel = (): void => {
    view.dispatch({
      effects: openGotoLinePanelEffect.of({
        value: '',
      }),
    });
  };

  const didCloseSearchPanel = closeSearchPanel(view);

  if (didCloseSearchPanel) {
    runOnNextFrame(view, openGotoLinePanel);
    return true;
  }

  openGotoLinePanel();

  return true;
};
