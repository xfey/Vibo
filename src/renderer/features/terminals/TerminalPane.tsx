import '@xterm/xterm/css/xterm.css';
import type { ReactElement } from 'react';
import { useEffect, useLayoutEffect, useRef } from 'react';

import type { TerminalSessionRuntime } from './terminal-runtime';

interface TerminalPaneProps {
  runtime: TerminalSessionRuntime;
  isActive: boolean;
}

export function TerminalPane({ runtime, isActive }: TerminalPaneProps): ReactElement {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    if (!containerRef.current) {
      return;
    }

    runtime.attach(containerRef.current);
  }, [runtime]);

  useEffect(() => {
    runtime.setActive(isActive);
  }, [isActive, runtime]);

  return (
    <section
      className={`terminal-pane-shell ${isActive ? 'terminal-pane-active' : 'terminal-pane-hidden'}`}
      aria-hidden={!isActive}
    >
      <div ref={containerRef} className="terminal-pane-container" />
    </section>
  );
}
