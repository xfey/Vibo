import { FitAddon } from '@xterm/addon-fit';
import { Terminal } from '@xterm/xterm';

import type { TerminalSessionSnapshot } from '@shared/contracts/terminal';
import {
  parseTerminalSessionActivityPayload,
  TERMINAL_SESSION_ACTIVITY_OSC,
  type TerminalSessionActivity,
} from '@shared/domain/terminal';
import { DEFAULT_MONO_FONT_STACK } from '@renderer/theme/appearance';

interface TerminalRuntimeLinkResolver {
  onOpenWorkspaceLink: (rawText: string) => Promise<void>;
}

interface TerminalSessionRuntimeOptions extends TerminalRuntimeLinkResolver {
  sessionId: string;
  loadSnapshot: (sessionId: string) => Promise<TerminalSessionSnapshot | null>;
  onAgentActivityChange: (sessionId: string, activity: TerminalSessionActivity) => void;
  onInput: (sessionId: string, data: string) => void;
  onResize: (sessionId: string, cols: number, rows: number) => void;
}

interface PendingOutputChunk {
  chunk: string;
  sequence: number;
}

interface DisposableLike {
  dispose: () => void;
}

const TERMINAL_PATH_TOKEN_PATTERN = /\S+/g;
const TERMINAL_PROTOCOL_REPLY_SUPPRESS_AFTER_CTRL_C_MS = 180;
const KNOWN_FILE_BASENAMES = new Set([
  'dockerfile',
  'gemfile',
  'license',
  'makefile',
  'procfile',
  'readme',
]);

const TERMINAL_PROTOCOL_REPLY_PATTERNS = [
  /^\u001b\](10|11|12);rgb:[0-9a-f/]+(?:\u0007|\u001b\\)/iu,
  /^\u001b\[(?:\?\d+;)?\d+;\d+R/u,
  /^\u001b\[\??\d+(?:;\d+)*\$y/u,
  /^\u001b\[\??\d+(?:;\d+)*c/u,
  /^\u001bP(?:0|1)\$r.*?\u001b\\/us,
];

function formatControlSequenceForLog(value: string): string {
  return value
    .replace(/\u001b/g, '<ESC>')
    .replace(/\u0007/g, '<BEL>')
    .replace(/\r/g, '<CR>')
    .replace(/\n/g, '<LF>');
}

function isLikelyTerminalProtocolReply(value: string): boolean {
  if (!value.startsWith('\u001b')) {
    return false;
  }

  let remaining = value;

  while (remaining.length > 0) {
    let matched = false;

    for (const pattern of TERMINAL_PROTOCOL_REPLY_PATTERNS) {
      const match = pattern.exec(remaining);

      if (!match || match.index !== 0) {
        continue;
      }

      remaining = remaining.slice(match[0].length);
      matched = true;
      break;
    }

    if (!matched) {
      return false;
    }
  }

  return true;
}

function readCssVariable(element: HTMLElement, variableName: string, fallback: string): string {
  const value = getComputedStyle(element).getPropertyValue(variableName).trim();
  return value.length > 0 ? value : fallback;
}

function readCssNumberVariable(element: HTMLElement, variableName: string, fallback: number): number {
  const value = Number.parseFloat(readCssVariable(element, variableName, `${fallback}`));
  return Number.isFinite(value) ? value : fallback;
}

function buildTerminalTheme(element: HTMLElement) {
  return {
    background: readCssVariable(element, '--terminal-background', '#fcfcfd'),
    foreground: readCssVariable(element, '--terminal-foreground', '#1f2328'),
    cursor: readCssVariable(element, '--terminal-cursor', '#1f2328'),
    cursorAccent: readCssVariable(element, '--terminal-cursor-accent', '#fcfcfd'),
    selectionBackground: readCssVariable(
      element,
      '--terminal-selection-background',
      'rgba(9, 105, 218, 0.16)',
    ),
    black: readCssVariable(element, '--terminal-ansi-black', '#1f2328'),
    red: readCssVariable(element, '--terminal-ansi-red', '#cf222e'),
    green: readCssVariable(element, '--terminal-ansi-green', '#1a7f37'),
    yellow: readCssVariable(element, '--terminal-ansi-yellow', '#9a6700'),
    blue: readCssVariable(element, '--terminal-ansi-blue', '#0969da'),
    magenta: readCssVariable(element, '--terminal-ansi-magenta', '#8250df'),
    cyan: readCssVariable(element, '--terminal-ansi-cyan', '#1b7c83'),
    white: readCssVariable(element, '--terminal-ansi-white', '#6e7781'),
    brightBlack: readCssVariable(element, '--terminal-ansi-bright-black', '#57606a'),
    brightRed: readCssVariable(element, '--terminal-ansi-bright-red', '#a40e26'),
    brightGreen: readCssVariable(element, '--terminal-ansi-bright-green', '#29903b'),
    brightYellow: readCssVariable(element, '--terminal-ansi-bright-yellow', '#bf8700'),
    brightBlue: readCssVariable(element, '--terminal-ansi-bright-blue', '#218bff'),
    brightMagenta: readCssVariable(element, '--terminal-ansi-bright-magenta', '#a475f9'),
    brightCyan: readCssVariable(element, '--terminal-ansi-bright-cyan', '#3192aa'),
    brightWhite: readCssVariable(element, '--terminal-ansi-bright-white', '#8c959f'),
  };
}

function buildTerminalFontFamily(element: HTMLElement): string {
  return readCssVariable(element, '--font-family-mono', DEFAULT_MONO_FONT_STACK);
}

function buildTerminalFontSize(element: HTMLElement): number {
  return readCssNumberVariable(element, '--font-size-mono', 12);
}

function trimLinkToken(rawToken: string): {
  text: string;
  leadingTrimLength: number;
} {
  const withoutLeading = rawToken.replace(/^[([{'"`<]+/, '');
  const withoutTrailing = withoutLeading
    .replace(/[)\]}'"`>,]+$/, '')
    .replace(/[.,;]+$/, '')
    .replace(/:+$/, '');

  return {
    text: withoutTrailing,
    leadingTrimLength: rawToken.length - withoutLeading.length,
  };
}

function stripLineColumnSuffix(rawText: string): string {
  const match = /^(.*?)(?::\d+)?(?::\d+)?$/.exec(rawText);
  return match?.[1] ?? rawText;
}

function isLikelyWorkspacePath(rawText: string): boolean {
  if (rawText.length === 0 || rawText.includes('://') || rawText.startsWith('~/')) {
    return false;
  }

  const pathText = stripLineColumnSuffix(rawText);
  const lastSegment = pathText.split('/').filter(Boolean).at(-1) ?? pathText;

  if (pathText.startsWith('/') || pathText.startsWith('./') || pathText.startsWith('../')) {
    return true;
  }

  if (pathText.includes('/')) {
    return true;
  }

  if (lastSegment.startsWith('.') && lastSegment.length > 1) {
    return true;
  }

  if (lastSegment.includes('.') && !lastSegment.endsWith('.')) {
    return true;
  }

  return KNOWN_FILE_BASENAMES.has(lastSegment.toLowerCase());
}

// Terminal link ranges are cell-based, so we need a UTF-16 index -> buffer column map.
function getTerminalLineTextWithColumns(line: NonNullable<ReturnType<Terminal['buffer']['active']['getLine']>>): {
  text: string;
  columns: number[];
} {
  let trimmedLength = 0;

  for (let column = 0; column < line.length; column += 1) {
    const cell = line.getCell(column);

    if (!cell) {
      continue;
    }

    if (cell.getChars().length === 0) {
      continue;
    }

    trimmedLength = Math.max(trimmedLength, column + Math.max(cell.getWidth(), 1));
  }

  let text = '';
  const columns: number[] = [];

  for (let column = 0; column < trimmedLength;) {
    const cell = line.getCell(column);

    if (!cell) {
      text += ' ';
      columns.push(column);
      column += 1;
      continue;
    }

    const chars = cell.getChars() || ' ';
    const width = Math.max(cell.getWidth(), 1);
    text += chars;

    for (let index = 0; index < chars.length; index += 1) {
      columns.push(column);
    }

    column += width;
  }

  columns.push(trimmedLength);

  return {
    text,
    columns,
  };
}

function getTerminalLineLinks(terminal: Terminal, bufferLineNumber: number): Array<{
  text: string;
  startColumn: number;
  endColumn: number;
}> {
  const line = terminal.buffer.active.getLine(bufferLineNumber - 1);

  if (!line) {
    return [];
  }

  const { text: lineText, columns } = getTerminalLineTextWithColumns(line);
  const links: Array<{
    text: string;
    startColumn: number;
    endColumn: number;
  }> = [];

  for (const match of lineText.matchAll(TERMINAL_PATH_TOKEN_PATTERN)) {
    if (typeof match.index !== 'number') {
      continue;
    }

    const { text, leadingTrimLength } = trimLinkToken(match[0]);

    if (!isLikelyWorkspacePath(text)) {
      continue;
    }

    const tokenStart = match.index + leadingTrimLength;
    const tokenEnd = tokenStart + text.length;

    const startColumn = columns[tokenStart];
    const endColumn = columns[tokenEnd];

    if (typeof startColumn !== 'number' || typeof endColumn !== 'number') {
      continue;
    }

    links.push({
      text,
      startColumn: startColumn + 1,
      endColumn,
    });
  }

  return links;
}

export class TerminalSessionRuntime {
  private terminal: Terminal | null = null;
  private fitAddon: FitAddon | null = null;
  private container: HTMLDivElement | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private readonly disposables: DisposableLike[] = [];
  private readonly pendingOutput: PendingOutputChunk[] = [];
  private readonly seenPendingSequences = new Set<number>();
  private snapshotLoadStarted = false;
  private snapshotHydrated = false;
  private lastAppliedSequence = 0;
  private isDisposed = false;
  private suppressProtocolRepliesUntil = 0;
  private lastMeasuredSize = {
    width: 0,
    height: 0,
  };

  constructor(private readonly options: TerminalSessionRuntimeOptions) {}

  attach(container: HTMLDivElement): void {
    if (this.isDisposed) {
      return;
    }

    if (this.terminal && this.container === container) {
      this.refreshTheme();
      return;
    }

    if (this.terminal) {
      throw new Error(`Terminal runtime ${this.options.sessionId} cannot be attached twice.`);
    }

    this.container = container;

    const terminal = new Terminal({
      cursorBlink: true,
      fontFamily: buildTerminalFontFamily(container),
      fontSize: buildTerminalFontSize(container),
      theme: buildTerminalTheme(container),
    });
    const fitAddon = new FitAddon();

    terminal.loadAddon(fitAddon);
    terminal.open(container);

    this.terminal = terminal;
    this.fitAddon = fitAddon;

    this.disposables.push(
      terminal.onData((data) => {
        if (data.includes('\u0003')) {
          this.suppressProtocolRepliesUntil =
            Date.now() + TERMINAL_PROTOCOL_REPLY_SUPPRESS_AFTER_CTRL_C_MS;
          console.info(`[terminal:${this.options.sessionId}] control-c sent to pty`);
        }

        if (isLikelyTerminalProtocolReply(data)) {
          const logPayload = {
            data: formatControlSequenceForLog(data),
          };

          if (Date.now() < this.suppressProtocolRepliesUntil) {
            console.warn(
              `[terminal:${this.options.sessionId}] dropped protocol reply after control-c`,
              logPayload,
            );
            return;
          }

          console.info(`[terminal:${this.options.sessionId}] forwarded protocol reply`, logPayload);
        }

        this.options.onInput(this.options.sessionId, data);
      }),
    );
    this.registerProtocolLogging(terminal);
    this.registerAgentActivityHandler(terminal);
    this.disposables.push(this.registerWorkspaceLinkProvider(terminal));

    this.resizeObserver = new ResizeObserver(() => {
      this.pushResize();
    });
    this.resizeObserver.observe(container);

    requestAnimationFrame(() => {
      this.pushResize();
      this.beginSnapshotHydration();
    });
  }

  setActive(isActive: boolean): void {
    if (!isActive || this.isDisposed) {
      return;
    }

    this.refreshAppearance();
    this.pushResize();
  }

  refreshAppearance(): void {
    if (!this.terminal || !this.container) {
      return;
    }

    this.terminal.options.theme = buildTerminalTheme(this.container);
    this.terminal.options.fontFamily = buildTerminalFontFamily(this.container);
    this.terminal.options.fontSize = buildTerminalFontSize(this.container);
    this.pushResize();
  }

  appendOutput(chunk: string, sequence: number): void {
    if (this.isDisposed || sequence <= this.lastAppliedSequence) {
      return;
    }

    if (!this.terminal || !this.snapshotHydrated) {
      this.enqueuePendingOutput(chunk, sequence);
      return;
    }

    this.writeChunk(chunk, sequence);
  }

  dispose(): void {
    if (this.isDisposed) {
      return;
    }

    this.isDisposed = true;
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;

    for (const disposable of this.disposables) {
      disposable.dispose();
    }

    this.disposables.length = 0;
    this.pendingOutput.length = 0;
    this.seenPendingSequences.clear();
    this.terminal?.dispose();
    this.terminal = null;
    this.fitAddon = null;
    this.container = null;
  }

  private enqueuePendingOutput(chunk: string, sequence: number): void {
    if (this.seenPendingSequences.has(sequence)) {
      return;
    }

    this.pendingOutput.push({
      chunk,
      sequence,
    });
    this.seenPendingSequences.add(sequence);
    this.pendingOutput.sort((left, right) => left.sequence - right.sequence);
  }

  private beginSnapshotHydration(): void {
    if (this.snapshotLoadStarted || !this.terminal) {
      return;
    }

    this.snapshotLoadStarted = true;

    void this.options
      .loadSnapshot(this.options.sessionId)
      .then((snapshot) => {
        if (this.isDisposed || !this.terminal) {
          return;
        }

        if (snapshot && snapshot.output.length > 0) {
          this.terminal.write(snapshot.output);
        }

        this.lastAppliedSequence = snapshot?.lastSequence ?? 0;
        this.snapshotHydrated = true;
        this.flushPendingOutput();
      })
      .catch((error: unknown) => {
        console.warn(`Failed to hydrate terminal snapshot ${this.options.sessionId}.`, error);
        this.snapshotHydrated = true;
        this.flushPendingOutput();
      });
  }

  private flushPendingOutput(): void {
    if (!this.terminal) {
      return;
    }

    const pendingOutput = [...this.pendingOutput].sort((left, right) => left.sequence - right.sequence);

    this.pendingOutput.length = 0;
    this.seenPendingSequences.clear();

    for (const pendingChunk of pendingOutput) {
      if (pendingChunk.sequence <= this.lastAppliedSequence) {
        continue;
      }

      this.writeChunk(pendingChunk.chunk, pendingChunk.sequence);
    }
  }

  private writeChunk(chunk: string, sequence: number): void {
    if (!this.terminal || sequence <= this.lastAppliedSequence) {
      return;
    }

    this.terminal.write(chunk);
    this.lastAppliedSequence = sequence;
  }

  private refreshTheme(): void {
    if (!this.terminal || !this.container) {
      return;
    }

    this.refreshAppearance();
  }

  private pushResize(): void {
    if (!this.container || !this.fitAddon || !this.terminal) {
      return;
    }

    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    if (width <= 0 || height <= 0) {
      return;
    }

    if (
      width === this.lastMeasuredSize.width &&
      height === this.lastMeasuredSize.height
    ) {
      return;
    }

    this.lastMeasuredSize = {
      width,
      height,
    };

    this.fitAddon.fit();

    if (this.terminal.cols > 0 && this.terminal.rows > 0) {
      this.options.onResize(this.options.sessionId, this.terminal.cols, this.terminal.rows);
    }
  }

  private registerWorkspaceLinkProvider(terminal: Terminal): DisposableLike {
    return terminal.registerLinkProvider({
      provideLinks: (bufferLineNumber, callback) => {
        const links = getTerminalLineLinks(terminal, bufferLineNumber).map((link) => ({
          range: {
            start: {
              x: link.startColumn,
              y: bufferLineNumber,
            },
            end: {
              x: link.endColumn,
              y: bufferLineNumber,
            },
          },
          text: link.text,
          decorations: {
            underline: true,
            pointerCursor: true,
          },
          activate: (event: MouseEvent, text: string) => {
            if (!event.metaKey && !event.ctrlKey) {
              return;
            }

            void this.options.onOpenWorkspaceLink(text);
          },
        }));

        callback(links.length > 0 ? links : undefined);
      },
    });
  }

  private registerProtocolLogging(terminal: Terminal): void {
    this.disposables.push(
      terminal.parser.registerOscHandler(10, (data) => {
        console.info(`[terminal:${this.options.sessionId}] received OSC 10 query`, {
          data,
        });
        return false;
      }),
    );
    this.disposables.push(
      terminal.parser.registerOscHandler(11, (data) => {
        console.info(`[terminal:${this.options.sessionId}] received OSC 11 query`, {
          data,
        });
        return false;
      }),
    );
    this.disposables.push(
      terminal.parser.registerOscHandler(12, (data) => {
        console.info(`[terminal:${this.options.sessionId}] received OSC 12 query`, {
          data,
        });
        return false;
      }),
    );
    this.disposables.push(
      terminal.parser.registerCsiHandler({ final: 'n' }, (params) => {
        console.info(`[terminal:${this.options.sessionId}] received CSI n query`, {
          params,
        });
        return false;
      }),
    );
    this.disposables.push(
      terminal.parser.registerCsiHandler({ final: 'c' }, (params) => {
        console.info(`[terminal:${this.options.sessionId}] received CSI c query`, {
          params,
        });
        return false;
      }),
    );
    this.disposables.push(
      terminal.parser.registerCsiHandler({ intermediates: '$', final: 'p' }, (params) => {
        console.info(`[terminal:${this.options.sessionId}] received CSI $p query`, {
          params,
        });
        return false;
      }),
    );
    this.disposables.push(
      terminal.parser.registerDcsHandler({ intermediates: '$', final: 'q' }, (data, params) => {
        console.info(`[terminal:${this.options.sessionId}] received DCS $q query`, {
          data,
          params,
        });
        return false;
      }),
    );
  }

  private registerAgentActivityHandler(terminal: Terminal): void {
    this.disposables.push(
      terminal.parser.registerOscHandler(TERMINAL_SESSION_ACTIVITY_OSC, (data) => {
        const activity = parseTerminalSessionActivityPayload(data);

        if (!activity) {
          return false;
        }

        console.info(`[terminal:${this.options.sessionId}] received agent activity`, {
          activity,
        });
        this.options.onAgentActivityChange(this.options.sessionId, activity);
        return true;
      }),
    );
  }
}

export class TerminalRuntimeStore {
  private readonly runtimes = new Map<string, TerminalSessionRuntime>();
  private readonly pendingOutputBySessionId = new Map<string, PendingOutputChunk[]>();

  constructor(
    private readonly options: Omit<TerminalSessionRuntimeOptions, 'sessionId'>,
  ) {}

  getOrCreateRuntime(sessionId: string): TerminalSessionRuntime {
    const existingRuntime = this.runtimes.get(sessionId);

    if (existingRuntime) {
      return existingRuntime;
    }

    const runtime = new TerminalSessionRuntime({
      ...this.options,
      sessionId,
    });
    const pendingOutput = this.pendingOutputBySessionId.get(sessionId);

    if (pendingOutput) {
      for (const pendingChunk of pendingOutput) {
        runtime.appendOutput(pendingChunk.chunk, pendingChunk.sequence);
      }

      this.pendingOutputBySessionId.delete(sessionId);
    }

    this.runtimes.set(sessionId, runtime);
    return runtime;
  }

  appendOutput(sessionId: string, chunk: string, sequence: number): void {
    const runtime = this.runtimes.get(sessionId);

    if (runtime) {
      runtime.appendOutput(chunk, sequence);
      return;
    }

    const pendingOutput = this.pendingOutputBySessionId.get(sessionId) ?? [];
    pendingOutput.push({
      chunk,
      sequence,
    });
    this.pendingOutputBySessionId.set(sessionId, pendingOutput);
  }

  disposeRuntime(sessionId: string): void {
    this.runtimes.get(sessionId)?.dispose();
    this.runtimes.delete(sessionId);
    this.pendingOutputBySessionId.delete(sessionId);
  }

  disposeAll(): void {
    for (const runtime of this.runtimes.values()) {
      runtime.dispose();
    }

    this.runtimes.clear();
    this.pendingOutputBySessionId.clear();
  }

  refreshAll(): void {
    for (const runtime of this.runtimes.values()) {
      runtime.refreshAppearance();
    }
  }
}
